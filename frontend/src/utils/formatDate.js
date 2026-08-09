import { formatDate as formatLocalizedDate, formatDateTime as formatLocalizedDateTime } from '../i18n';

export function formatRelativeDate(date) {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return 'Дөнгөж сая';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} минутын өмнө`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} цагийн өмнө`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} өдрийн өмнө`;

  return formatLocalizedDate(past);
}

export const formatDate = formatRelativeDate;

export function formatDateTime(date) {
  return formatLocalizedDateTime(date);
}
