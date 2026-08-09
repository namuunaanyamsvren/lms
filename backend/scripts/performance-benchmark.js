#!/usr/bin/env node

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};

const base = value('base', process.env.BENCHMARK_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const token = value('token', process.env.BENCHMARK_TOKEN || '');
const organization = value('organization', process.env.BENCHMARK_ORGANIZATION_ID || '');
const requests = Number(value('requests', process.env.BENCHMARK_REQUESTS || 50));
const concurrency = Number(value('concurrency', process.env.BENCHMARK_CONCURRENCY || 5));

const endpoints = [
  '/api/courses?page=1&limit=20',
  '/api/announcements?page=1&limit=20',
  '/api/reports/jobs?page=1&limit=20',
  '/api/notifications?page=1&limit=20',
];

const headers = {
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...(organization ? { 'x-organization-id': organization } : {}),
};

const percentile = (values, p) => values[Math.min(values.length - 1, Math.floor(values.length * p))] || 0;

async function runEndpoint(path) {
  const durations = [];
  let errors = 0;
  let completed = 0;
  const startedAt = Date.now();

  async function worker() {
    while (completed < requests) {
      completed += 1;
      const start = performance.now();
      try {
        const response = await fetch(`${base}${path}`, { headers });
        if (!response.ok) errors += 1;
        await response.arrayBuffer();
      } catch (_error) {
        errors += 1;
      }
      durations.push(performance.now() - start);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  durations.sort((a, b) => a - b);
  const seconds = (Date.now() - startedAt) / 1000;
  return {
    path,
    requests,
    errors,
    rps: Number((requests / seconds).toFixed(2)),
    p50: Number(percentile(durations, 0.5).toFixed(1)),
    p95: Number(percentile(durations, 0.95).toFixed(1)),
    p99: Number(percentile(durations, 0.99).toFixed(1)),
  };
}

(async () => {
  for (const endpoint of endpoints) {
    const result = await runEndpoint(endpoint);
    console.log(JSON.stringify(result));
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
