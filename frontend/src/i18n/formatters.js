import { DEFAULT_LOCALE, DEFAULT_TIME_ZONE } from './catalog';

const numberFormatter = new Intl.NumberFormat(DEFAULT_LOCALE);
const currencyFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  style: 'currency',
  currency: 'MNT',
  maximumFractionDigits: 0,
});
const gpaFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  return numberFormatter.format(Number(value));
}

export function formatMoney(value, currency = 'MNT') {
  if (value === null || value === undefined || value === '') return '';
  if (currency === 'MNT') return currencyFormatter.format(Number(value));
  return new Intl.NumberFormat(DEFAULT_LOCALE, { style: 'currency', currency }).format(Number(value));
}

export function formatGpa(value) {
  if (value === null || value === undefined || value === '') return '';
  return gpaFormatter.format(Number(value));
}

export function formatDate(value, options = {}) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(DEFAULT_LOCALE, {
    timeZone: DEFAULT_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

export function formatDateTime(value, options = {}) {
  if (!value) return '';
  return new Date(value).toLocaleString(DEFAULT_LOCALE, {
    timeZone: DEFAULT_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}
