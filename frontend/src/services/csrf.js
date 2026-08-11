const BASE_API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const CSRF_COOKIE_NAME = import.meta.env.VITE_CSRF_COOKIE_NAME || 'lms_csrf';
const CSRF_HEADER_NAME = import.meta.env.VITE_CSRF_HEADER_NAME || 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const CSRF_RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000, 12000];
let cachedCsrfToken = null;
let csrfRequestPromise = null;

const readCookie = name => {
  const prefix = `${encodeURIComponent(name)}=`;
  const part = document.cookie
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : null;
};

export const getCsrfToken = () => readCookie(CSRF_COOKIE_NAME);
export const getCsrfHeaderName = () => CSRF_HEADER_NAME;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const shouldRetryCsrfBootstrap = (response, error) => {
  if (response) return RETRYABLE_STATUSES.has(response.status);
  return Boolean(error);
};

const fetchCsrfToken = async () => {
  let lastError = null;
  for (let attempt = 0; attempt <= CSRF_RETRY_DELAYS_MS.length; attempt += 1) {
    let response = null;
    try {
      response = await fetch(`${BASE_API_URL}/auth/csrf-token`, {
        method: 'GET',
        credentials: 'include',
      });
      if (response.ok) return response;
      lastError = new Error('CSRF token авахад алдаа гарлаа.');
      lastError.status = response.status;
    } catch (error) {
      lastError = error;
    }

    if (
      attempt === CSRF_RETRY_DELAYS_MS.length ||
      !shouldRetryCsrfBootstrap(response, lastError)
    ) {
      throw lastError;
    }
    await delay(CSRF_RETRY_DELAYS_MS[attempt]);
  }
  throw lastError || new Error('CSRF token авахад алдаа гарлаа.');
};

export const ensureCsrfToken = async (forceRefresh = false) => {
  const existing = getCsrfToken() || cachedCsrfToken;
  if (existing && !forceRefresh) return existing;

  if (!csrfRequestPromise) {
    csrfRequestPromise = (async () => {
      const response = await fetchCsrfToken();
      if (!response.ok) throw new Error('CSRF token авахад алдаа гарлаа.');
      const data = typeof response.json === 'function'
        ? await response.json().catch(() => ({}))
        : {};
      const token = getCsrfToken() || data?.data?.token || data?.token;
      if (!token) throw new Error('CSRF cookie тохируулагдсангүй.');
      cachedCsrfToken = token;
      return token;
    })().finally(() => {
      csrfRequestPromise = null;
    });
  }

  return csrfRequestPromise;
};

export const withCsrf = async (options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  if (SAFE_METHODS.has(method)) {
    return { ...options, credentials: 'include' };
  }
  const token = await ensureCsrfToken();
  return {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
      [CSRF_HEADER_NAME]: token,
    },
  };
};
