import { authRequest } from './apiClient';

const baseDomain = (import.meta.env.VITE_TENANT_BASE_DOMAIN || 'localhost').toLowerCase();
const demoLoginEnabled = import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';

export const normalizeTenantKey = value => (value || '')
  .trim()
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9.-]+/g, '-')
  .replace(/^-+|-+$/g, '');

export const inferredTenantKey = () => {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname.toLowerCase();
  if (host !== baseDomain && host.endsWith(`.${baseDomain}`)) return host;
  return normalizeTenantKey(new URLSearchParams(window.location.search).get('tenant'));
};

export const resolveTenant = async key => {
  const normalized = normalizeTenantKey(key || inferredTenantKey());
  if (!normalized) throw new Error('Байгууллагын богино нэрийг оруулна уу.');
  if (demoLoginEnabled && normalized === 'mongol-erdem') {
    return { id: 'org_main', name: 'Монгол Эрдэм Их Сургууль', slug: 'mongol-erdem' };
  }

  const response = await authRequest({
    url: `/organizations/resolve?host=${encodeURIComponent(normalized)}`,
    method: 'GET',
  });
  const tenant = response.data;
  if (!tenant?.id) throw new Error('Байгууллага олдсонгүй. Байгууллагын богино нэр зөв эсэхийг шалгана уу.');
  if (typeof document !== 'undefined' && tenant.primaryColor) {
    document.documentElement.style.setProperty('--organization-primary-color', tenant.primaryColor);
  }
  if (typeof document !== 'undefined' && tenant.faviconUrl) {
    let icon = document.querySelector("link[rel='icon']");
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    icon.href = tenant.faviconUrl;
  }
  return tenant;
};
