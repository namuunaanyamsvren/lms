import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  applyCors,
  createCsrfToken,
  csrfProtection,
  errorHandler,
  getCsrfCookieName,
  getCsrfHeaderName,
  issueCsrfToken,
} from '@lms/shared';

const buildCsrfApp = () => {
  const app = express();
  app.get('/csrf-token', issueCsrfToken);
  app.use(csrfProtection);
  app.get('/safe', (_req, res) => res.json({ success: true }));
  app.post('/state', (_req, res) => res.json({ success: true }));
  app.use(errorHandler);
  return app;
};

const csrfCookie = (token: string) =>
  `${getCsrfCookieName()}=${encodeURIComponent(token)}`;

describe('CSRF protection', () => {
  it('rejects a missing CSRF token', async () => {
    const response = await request(buildCsrfApp()).post('/state');
    expect(response.status).toBe(403);
  });

  it('rejects invalid and length-mismatched tokens without throwing', async () => {
    const token = createCsrfToken();
    const invalid = await request(buildCsrfApp())
      .post('/state')
      .set('Cookie', csrfCookie(token))
      .set(getCsrfHeaderName(), `${token.slice(0, -1)}x`);
    const lengthMismatch = await request(buildCsrfApp())
      .post('/state')
      .set('Cookie', csrfCookie(token))
      .set(getCsrfHeaderName(), 'short');

    expect(invalid.status).toBe(403);
    expect(lengthMismatch.status).toBe(403);
  });

  it('accepts a valid double-submit token and safe GET requests', async () => {
    const token = createCsrfToken();
    const stateChange = await request(buildCsrfApp())
      .post('/state')
      .set('Cookie', csrfCookie(token))
      .set(getCsrfHeaderName(), token);
    const safeGet = await request(buildCsrfApp()).get('/safe');
    const bootstrap = await request(buildCsrfApp()).get('/csrf-token');

    expect(stateChange.status).toBe(200);
    expect(safeGet.status).toBe(200);
    expect(bootstrap.status).toBe(200);
    expect(bootstrap.headers['set-cookie']?.[0]).toContain(`${getCsrfCookieName()}=`);
    expect(bootstrap.headers['set-cookie']?.[0]).not.toContain('HttpOnly');
  });

  it('reuses a valid CSRF cookie instead of rotating it during concurrent bootstrap', async () => {
    const token = createCsrfToken();
    const bootstrap = await request(buildCsrfApp())
      .get('/csrf-token')
      .set('Cookie', csrfCookie(token));

    expect(bootstrap.status).toBe(200);
    expect(bootstrap.body.data.token).toBe(token);
    expect(bootstrap.headers['set-cookie']).toBeUndefined();
  });
});

describe('credentialed exact-origin CORS', () => {
  const buildCorsApp = () => {
    const app = express();
    applyCors(app);
    app.get('/resource', (_req, res) => res.json({ success: true }));
    app.use(errorHandler);
    return app;
  };

  it('rejects an invalid cross-origin request', async () => {
    const response = await request(buildCorsApp())
      .get('/resource')
      .set('Origin', 'https://evil.example');
    expect(response.status).toBe(403);
  });

  it('accepts an allowed credentialed origin', async () => {
    const response = await request(buildCorsApp())
      .get('/resource')
      .set('Origin', 'http://localhost:5173');
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
