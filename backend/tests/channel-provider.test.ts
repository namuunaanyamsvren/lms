import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendChannel, validateSmsProviderConfiguration } from '../notification-service/src/services/channel-provider.service';

const smsContent = { recipient: '+97699112233', subject: '', text: 'hi', html: '' };

describe('sendChannel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('delegates EMAIL to the SMTP transporter and reports its dev-skip fallback when unconfigured', async () => {
    vi.stubEnv('SMTP_HOST', '');
    vi.stubEnv('NODE_ENV', 'test');
    const result = await sendChannel('EMAIL', { recipient: 'a@b.mn', subject: 'Hi', text: 'body', html: '<p>body</p>' });
    expect(result).toEqual({ provider: 'smtp', messageId: 'development-skipped' });
  });

  it('throws when SMS is not configured', async () => {
    vi.stubEnv('SMS_PROVIDER_URL', '');
    await expect(sendChannel('SMS', smsContent)).rejects.toThrow('SMS provider is not configured');
  });

  it('sends SMS via the configured HTTP bridge with a bearer token', async () => {
    vi.stubEnv('SMS_PROVIDER_URL', 'https://sms.example.com/send');
    vi.stubEnv('SMS_PROVIDER_TOKEN', 'token-123');
    vi.stubEnv('SMS_PROVIDER', 'http-sms');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'sms-1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendChannel('SMS', smsContent);

    expect(result).toEqual({ provider: 'http-sms', messageId: 'sms-1' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('https://sms.example.com/send');
    expect(init.headers.authorization).toBe('Bearer token-123');
    expect(JSON.parse(init.body as string)).toEqual({ to: smsContent.recipient, message: smsContent.text });
  });

  it('throws when the SMS provider responds with a non-2xx status', async () => {
    vi.stubEnv('SMS_PROVIDER_URL', 'https://sms.example.com/send');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    await expect(sendChannel('SMS', smsContent)).rejects.toThrow('SMS provider returned 500');
  });

  it('throws when Web Push is not configured', async () => {
    vi.stubEnv('WEB_PUSH_PROVIDER_URL', '');
    await expect(sendChannel('PUSH', { recipient: '', subject: 'Hi', text: 'hi', html: '' })).rejects.toThrow('Web Push provider is not configured');
  });

  it('falls back to in-app/stored for unrecognized channels', async () => {
    const result = await sendChannel('IN_APP', { recipient: 'x', subject: '', text: '', html: '' });
    expect(result).toEqual({ provider: 'in-app', messageId: 'stored' });
  });
});

describe('validateSmsProviderConfiguration', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is a no-op when SMS is not configured at all (opt-in channel, not every org uses it)', () => {
    vi.stubEnv('SMS_PROVIDER_URL', '');
    vi.stubEnv('SMS_PROVIDER_TOKEN', '');
    expect(() => validateSmsProviderConfiguration()).not.toThrow();
  });

  it('throws when only the URL is set (half-entered config)', () => {
    vi.stubEnv('SMS_PROVIDER_URL', 'https://sms.example.com/send');
    vi.stubEnv('SMS_PROVIDER_TOKEN', '');
    expect(() => validateSmsProviderConfiguration()).toThrow(/incomplete/);
  });

  it('throws when only the token is set (half-entered config)', () => {
    vi.stubEnv('SMS_PROVIDER_URL', '');
    vi.stubEnv('SMS_PROVIDER_TOKEN', 'token-123');
    expect(() => validateSmsProviderConfiguration()).toThrow(/incomplete/);
  });

  it('accepts a complete config', () => {
    vi.stubEnv('SMS_PROVIDER_URL', 'https://sms.example.com/send');
    vi.stubEnv('SMS_PROVIDER_TOKEN', 'token-123');
    expect(() => validateSmsProviderConfiguration()).not.toThrow();
  });

  it('requires HTTPS in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SMS_PROVIDER_URL', 'http://sms.example.com/send');
    vi.stubEnv('SMS_PROVIDER_TOKEN', 'token-123');
    expect(() => validateSmsProviderConfiguration()).toThrow(/HTTPS/);
  });
});
