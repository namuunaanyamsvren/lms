/* @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { resolveLoginTenantKey } from './Login';

describe('login tenant selection', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('uses the onboarding tenant slug for login and OAuth', () => {
    expect(resolveLoginTenantKey({ tenantSlug: 'New School' })).toBe('new-school');
  });

  it('falls back to the current tenant query instead of hardcoding the demo tenant', () => {
    window.history.replaceState({}, '', '/login?tenant=school-one');

    expect(resolveLoginTenantKey(null)).toBe('school-one');
  });
});
