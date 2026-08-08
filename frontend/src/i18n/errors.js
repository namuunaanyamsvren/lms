import { t } from './catalog';

export function translateErrorCode(code, fallback) {
  if (!code) return fallback || t('errors.default');
  return t(`errors.${code}`, {}, 'mn-MN') === `errors.${code}`
    ? fallback || t('errors.default')
    : t(`errors.${code}`);
}
