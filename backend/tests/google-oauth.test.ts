import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  getGoogleOAuthConfig,
  stateCookiePath,
} from '../auth-service/src/services/google-oauth.service';

const config = {
  clientId: 'google-client-id.apps.googleusercontent.com',
  clientSecret: 'google-client-secret',
  redirectUri: 'http://localhost:5173/auth/callback',
  frontendUrl: 'http://localhost:5173',
};

describe('Google OAuth security flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('builds an authorization-code URL with state and without the client secret', () => {
    const authorizationUrl = new URL(
      buildGoogleAuthorizationUrl('random-state', 'pkce-code-challenge', config),
    );
    expect(authorizationUrl.origin).toBe('https://accounts.google.com');
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(authorizationUrl.searchParams.get('scope')).toContain('openid');
    expect(authorizationUrl.searchParams.get('scope')).toContain('email');
    expect(authorizationUrl.searchParams.get('state')).toBe('random-state');
    expect(authorizationUrl.searchParams.get('code_challenge')).toBe('pkce-code-challenge');
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorizationUrl.toString()).not.toContain(config.clientSecret);
  });

  it('accepts the frontend relay callback and rejects unrelated paths', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('GOOGLE_CLIENT_ID', config.clientId);
    vi.stubEnv('GOOGLE_CLIENT_SECRET', config.clientSecret);
    vi.stubEnv('GOOGLE_REDIRECT_URI', 'http://localhost:5173/not-an-oauth-callback');
    vi.stubEnv('FRONTEND_URL', config.frontendUrl);
    expect(() => getGoogleOAuthConfig()).toThrow(
      'GOOGLE_REDIRECT_URI must use /auth/callback, /api/auth/google/callback, or /api/v1/auth/google/callback',
    );
  });

  it('accepts the versioned gateway callback path', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('GOOGLE_CLIENT_ID', config.clientId);
    vi.stubEnv('GOOGLE_CLIENT_SECRET', config.clientSecret);
    vi.stubEnv('GOOGLE_REDIRECT_URI', 'http://localhost:5173/api/v1/auth/google/callback');
    vi.stubEnv('FRONTEND_URL', config.frontendUrl);

    expect(getGoogleOAuthConfig().redirectUri).toBe('http://localhost:5173/api/v1/auth/google/callback');
  });

  it('uses a root state cookie path so the frontend relay and API callback share state', () => {
    expect(stateCookiePath()).toBe('/');
    vi.stubEnv('GOOGLE_OAUTH_STATE_COOKIE_PATH', '/api/auth/google');
    expect(stateCookiePath()).toBe('/api/auth/google');
  });

  it('exchanges the code server-side and accepts only a verified Google email', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'google-access-token',
        token_type: 'Bearer',
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        sub: 'google-user-123',
        email: 'USER@Example.COM',
        email_verified: true,
        given_name: 'Test',
        family_name: 'User',
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const profile = await exchangeGoogleAuthorizationCode(
      'authorization-code',
      'pkce-code-verifier',
      config,
    );

    expect(profile).toMatchObject({
      provider: 'google',
      providerAccountId: 'google-user-123',
      email: 'user@example.com',
      emailVerified: true,
      firstName: 'Test',
      lastName: 'User',
    });
    const tokenRequest = fetchMock.mock.calls[0];
    expect(tokenRequest[0]).toBe('https://oauth2.googleapis.com/token');
    expect(String(tokenRequest[1]?.body)).toContain('grant_type=authorization_code');
    expect(String(tokenRequest[1]?.body)).toContain('code_verifier=pkce-code-verifier');
    expect(String(tokenRequest[1]?.body)).toContain('client_secret=google-client-secret');
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual({
      authorization: 'Bearer google-access-token',
    });
  });

  it('rejects a Google profile whose email is not verified', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'google-access-token',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        sub: 'google-user-123',
        email: 'user@example.com',
        email_verified: false,
      }), { status: 200 })));

    await expect(
      exchangeGoogleAuthorizationCode('authorization-code', 'pkce-code-verifier', config),
    ).rejects.toThrow('Google account must have a verified email address');
  });
});
