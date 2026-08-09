import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkCompromisedPassword,
  enforcePasswordPolicy,
} from '../auth-service/src/services/password-policy.service';

const securePassword = 'orbit meadow copper lantern 47';

describe('password policy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects passwords shorter than the default minimum', async () => {
    await expect(enforcePasswordPolicy('short-value')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('rejects common passwords without relying on composition rules', async () => {
    await expect(enforcePasswordPolicy('Password123!')).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('Түгээмэл'),
    });
  });

  it('rejects passwords derived from user information', async () => {
    await expect(enforcePasswordPolicy('Alice-school-account-47', {
      userInfo: {
        email: 'alice@example.test',
        firstName: 'Alice',
      },
    })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('хувийн мэдээлэл'),
    });
  });

  it('accepts a valid long passphrase', async () => {
    await expect(enforcePasswordPolicy(securePassword)).resolves.toBe(securePassword);
  });

  it('uses only a SHA-1 prefix for a compromised-password lookup', async () => {
    const digest = '308BBC014070DCA6C93731D4C2A4A7C8F374A31C';
    const fetchImpl = vi.fn(async () => new Response(`${digest.slice(5)}:42\r\nOTHER:0`));

    await expect(checkCompromisedPassword(securePassword, {
      compromisedCheckEnabled: true,
      fetchImpl,
    })).resolves.toBe(true);

    const requestedUrl = String(fetchImpl.mock.calls[0][0]);
    expect(requestedUrl).toContain(`/range/${digest.slice(0, 5)}`);
    expect(requestedUrl).not.toContain(securePassword);
    expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({ 'Add-Padding': 'true' });
  });

  it('fails open on service outage by default and can be configured to deny', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network unavailable');
    });

    await expect(enforcePasswordPolicy(securePassword, {
      compromisedCheckEnabled: true,
      fetchImpl,
    })).resolves.toBe(securePassword);

    await expect(enforcePasswordPolicy(securePassword, {
      compromisedCheckEnabled: true,
      compromisedFailureMode: 'deny',
      fetchImpl,
    })).rejects.toMatchObject({ statusCode: 500 });
  });

  it('never includes the password in errors or logs', async () => {
    const secret = 'Alice-private-password-47';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    let error: unknown;
    try {
      await enforcePasswordPolicy(secret, {
        userInfo: { firstName: 'Alice' },
      });
    } catch (caught) {
      error = caught;
    }

    expect(JSON.stringify(error)).not.toContain(secret);
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
