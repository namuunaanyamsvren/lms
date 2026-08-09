/* @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { buildGoogleLoginUrl } from './googleOAuth';

describe('Google OAuth URL builder', () => {
  it('starts OAuth with the resolved organization id', () => {
    const url = new URL(buildGoogleLoginUrl('org-new'));

    expect(url.pathname).toBe('/api/v1/auth/google');
    expect(url.searchParams.get('organizationId')).toBe('org-new');
  });
});
