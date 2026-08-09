import {
  handleAuthFailure,
  requestAccessTokenRefresh,
} from './apiClient';
import {
  getAccessToken,
  subscribeAccessToken,
} from './tokenStore';

const DEFAULT_REFRESH_BUFFER_SECONDS = 90;
const MIN_REFRESH_BUFFER_SECONDS = 60;
const MAX_REFRESH_BUFFER_SECONDS = 120;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

let timerId = null;
let unsubscribeToken = null;
let started = false;
let refreshGeneration = 0;

const getRefreshBufferMs = () => {
  const configured = Number(import.meta.env.VITE_ACCESS_TOKEN_REFRESH_BUFFER_SECONDS);
  const seconds = Number.isFinite(configured) &&
    configured >= MIN_REFRESH_BUFFER_SECONDS &&
    configured <= MAX_REFRESH_BUFFER_SECONDS
    ? configured
    : DEFAULT_REFRESH_BUFFER_SECONDS;
  return seconds * 1000;
};

const decodeBase64Url = value => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return atob(padded);
};

export const getAccessTokenExpirationMs = token => {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    const expirationMs = Number(payload.exp) * 1000;
    return Number.isSafeInteger(expirationMs) && expirationMs > 0
      ? expirationMs
      : null;
  } catch {
    return null;
  }
};

const clearTimer = () => {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
};

export const clearSilentRefreshTimer = () => {
  refreshGeneration += 1;
  clearTimer();
};

const refreshScheduledToken = async (token, generation) => {
  if (
    !started ||
    generation !== refreshGeneration ||
    getAccessToken() !== token
  ) {
    return;
  }

  try {
    const refreshedToken = await requestAccessTokenRefresh();
    const expirationMs = getAccessTokenExpirationMs(refreshedToken);
    if (!expirationMs || expirationMs <= Date.now()) {
      handleAuthFailure(new Error('Refreshed access token expiration was invalid'));
    }
  } catch {
    // The shared refresh flow clears auth state and redirects exactly once.
  }
};

export const scheduleSilentRefresh = (token = getAccessToken()) => {
  clearTimer();
  refreshGeneration += 1;
  const generation = refreshGeneration;
  if (!started || !token) return;

  const expirationMs = getAccessTokenExpirationMs(token);
  if (!expirationMs) {
    handleAuthFailure(new Error('Access token expiration was invalid'));
    return;
  }

  const delay = expirationMs - Date.now() - getRefreshBufferMs();
  if (!Number.isFinite(delay) || delay <= 0) {
    queueMicrotask(() => refreshScheduledToken(token, generation));
    return;
  }

  timerId = setTimeout(
    () => refreshScheduledToken(token, generation),
    Math.min(delay, MAX_TIMER_DELAY_MS),
  );
};

const recheckTokenExpiration = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  scheduleSilentRefresh();
};

export const startSilentRefreshScheduler = () => {
  if (started) return stopSilentRefreshScheduler;
  started = true;
  unsubscribeToken = subscribeAccessToken(scheduleSilentRefresh);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', recheckTokenExpiration);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', recheckTokenExpiration);
  }
  scheduleSilentRefresh();
  return stopSilentRefreshScheduler;
};

export const stopSilentRefreshScheduler = () => {
  started = false;
  clearSilentRefreshTimer();
  unsubscribeToken?.();
  unsubscribeToken = null;
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', recheckTokenExpiration);
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('focus', recheckTokenExpiration);
  }
};

export const resetSilentRefreshSchedulerForTests = () => {
  stopSilentRefreshScheduler();
  refreshGeneration = 0;
};
