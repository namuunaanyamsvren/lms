import type { Request, Response, NextFunction } from 'express';

type Labels = Record<string, string | number | boolean | undefined | null>;

type CounterSample = {
  help: string;
  labels: Labels;
  value: number;
};

type HistogramSample = {
  help: string;
  labels: Labels;
  values: number[];
};

const counters = new Map<string, CounterSample>();
const histograms = new Map<string, HistogramSample>();

const sanitizeMetric = (value: string) => value.replace(/[^a-zA-Z0-9_:]/g, '_');
const labelKey = (labels: Labels = {}) =>
  Object.entries(labels)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(',');
const sampleKey = (name: string, labels: Labels = {}) => `${name}{${labelKey(labels)}}`;
const escapeLabel = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
const renderLabels = (labels: Labels = {}) => {
  const entries = Object.entries(labels).filter(([, value]) => value !== undefined && value !== null);
  if (!entries.length) return '';
  return `{${entries.map(([key, value]) => `${sanitizeMetric(key)}="${escapeLabel(String(value))}"`).join(',')}}`;
};
const withExtraLabel = (labels: Labels, key: string, value: string) => renderLabels({ [key]: value, ...labels });

export function incrementCounter(name: string, help: string, labels: Labels = {}, value = 1): void {
  const metric = sanitizeMetric(name);
  const key = sampleKey(metric, labels);
  const sample = counters.get(key) || { help, labels, value: 0 };
  sample.value += value;
  counters.set(key, sample);
}

export function observeHistogram(name: string, help: string, labels: Labels = {}, value: number): void {
  const metric = sanitizeMetric(name);
  const key = sampleKey(metric, labels);
  const sample = histograms.get(key) || { help, labels, values: [] };
  sample.values.push(value);
  if (sample.values.length > 1000) sample.values.splice(0, sample.values.length - 1000);
  histograms.set(key, sample);
}

export function recordBusinessMetric(event: 'registration' | 'active_user' | 'submission' | 'attempt' | 'payment', labels: Labels = {}): void {
  incrementCounter('lms_business_events_total', 'Business-domain event count.', { event, ...labels });
}

export function recordQueueMetric(queue: string, ready: number, unacked = 0): void {
  incrementCounter('lms_queue_samples_total', 'RabbitMQ queue metric samples.', { queue });
  observeHistogram('lms_queue_ready_messages', 'RabbitMQ ready message samples.', { queue }, ready);
  observeHistogram('lms_queue_unacked_messages', 'RabbitMQ unacked message samples.', { queue }, unacked);
}

export function requestMetricsMiddleware(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      const labels = {
        service: serviceName,
        method: req.method,
        route: req.route?.path || req.path || req.originalUrl,
        status: res.statusCode,
      };
      incrementCounter('http_requests_total', 'HTTP request count.', labels);
      observeHistogram('http_request_duration_ms', 'HTTP request duration in milliseconds.', labels, durationMs);
      if (res.statusCode >= 500) incrementCounter('http_errors_total', 'HTTP 5xx error count.', labels);
    });
    next();
  };
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

export function renderPrometheusMetrics(serviceName: string): string {
  const lines = [
    '# HELP lms_process_uptime_seconds Process uptime in seconds.',
    '# TYPE lms_process_uptime_seconds gauge',
    `lms_process_uptime_seconds{service="${escapeLabel(serviceName)}"} ${process.uptime().toFixed(3)}`,
    '# HELP lms_process_memory_rss_bytes Process RSS memory in bytes.',
    '# TYPE lms_process_memory_rss_bytes gauge',
    `lms_process_memory_rss_bytes{service="${escapeLabel(serviceName)}"} ${process.memoryUsage().rss}`,
  ];

  const emittedCounters = new Set<string>();
  for (const [key, sample] of counters) {
    const name = key.slice(0, key.indexOf('{'));
    if (!emittedCounters.has(name)) {
      lines.push(`# HELP ${name} ${sample.help}`, `# TYPE ${name} counter`);
      emittedCounters.add(name);
    }
    lines.push(`${name}${renderLabels(sample.labels)} ${sample.value}`);
  }

  const emittedHistograms = new Set<string>();
  for (const [key, sample] of histograms) {
    const name = key.slice(0, key.indexOf('{'));
    if (!emittedHistograms.has(name)) {
      lines.push(`# HELP ${name} ${sample.help}`, `# TYPE ${name} summary`);
      emittedHistograms.add(name);
    }
    const labels = renderLabels(sample.labels);
    lines.push(`${name}_count${labels} ${sample.values.length}`);
    lines.push(`${name}_sum${labels} ${sample.values.reduce((sum, value) => sum + value, 0).toFixed(3)}`);
    lines.push(`${name}${withExtraLabel(sample.labels, 'quantile', '0.5')} ${percentile(sample.values, 50).toFixed(3)}`);
    lines.push(`${name}${withExtraLabel(sample.labels, 'quantile', '0.95')} ${percentile(sample.values, 95).toFixed(3)}`);
  }
  return `${lines.join('\n')}\n`;
}

export function registerMetricsRoute(app: { get: Function }, serviceName: string): void {
  app.get('/metrics', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(renderPrometheusMetrics(serviceName));
  });
}
