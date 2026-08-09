const BASE_API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const CSRF_COOKIE_NAME = import.meta.env.VITE_CSRF_COOKIE_NAME || 'lms_csrf';
const CSRF_HEADER_NAME = import.meta.env.VITE_CSRF_HEADER_NAME || 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

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

export const ensureCsrfToken = async (forceRefresh = false) => {
  const existing = getCsrfToken();
  if (existing && !forceRefresh) return existing;

  const response = await fetch(`${BASE_API_URL}/auth/csrf-token`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('CSRF token авахад алдаа гарлаа.');
  const token = getCsrfToken();
  if (!token) throw new Error('CSRF cookie тохируулагдсангүй.');
  return token;
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
