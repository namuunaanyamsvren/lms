type CircuitState = {
  failures: number;
  openedUntil: number;
};

export type ServiceHttpClientOptions = {
  baseUrl: string;
  defaultTimeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  circuitBreaker?: {
    failureThreshold?: number;
    cooldownMs?: number;
  };
  defaultHeaders?: Record<string, string>;
};

const circuits = new Map<string, CircuitState>();

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function createServiceHttpClient(options: ServiceHttpClientOptions) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 100;
  const timeoutMs = options.defaultTimeoutMs ?? 3000;
  const failureThreshold = options.circuitBreaker?.failureThreshold ?? 5;
  const cooldownMs = options.circuitBreaker?.cooldownMs ?? 30000;

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const circuit = circuits.get(baseUrl);
    if (circuit && circuit.openedUntil > Date.now()) {
      throw new Error(`Circuit open for ${baseUrl}`);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
          ...init,
          headers: { ...options.defaultHeaders, ...init.headers },
          signal: init.signal || controller.signal,
        });
        if (response.status < 500 || attempt === retries) {
          circuits.delete(baseUrl);
          return response;
        }
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
        if (attempt === retries) break;
      } finally {
        clearTimeout(timeout);
      }
      await sleep(retryDelayMs * (attempt + 1));
    }

    const state = circuits.get(baseUrl) || { failures: 0, openedUntil: 0 };
    state.failures += 1;
    if (state.failures >= failureThreshold) state.openedUntil = Date.now() + cooldownMs;
    circuits.set(baseUrl, state);
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  return {
    request,
    async json<T>(path: string, init: RequestInit = {}): Promise<T> {
      const response = await request(path, init);
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${baseUrl}${path}`);
      return response.json() as Promise<T>;
    },
  };
}
