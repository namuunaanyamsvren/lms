import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthAuditEventType } from '@prisma/client-auth';
import {
  AuthAuditWriter,
  getAuthAuditSeverity,
  recordAuthAudit,
  sanitizeAuthAuditMetadata,
} from '../auth-service/src/services/auth-audit.service';

const writer = (implementation?: () => Promise<unknown>) => {
  const create = vi.fn(implementation || (async () => ({ id: 'audit-1' })));
  return {
    client: { authAuditEvent: { create } } as AuthAuditWriter,
    create,
  };
};

afterEach(() => vi.restoreAllMocks());

describe('central authentication audit service', () => {
  it('creates an event with only safe contextual metadata', async () => {
    const audit = writer();
    await expect(recordAuthAudit(audit.client, {
      eventType: AuthAuditEventType.LOGIN_SUCCESS,
      userId: 'user-1',
      organizationId: 'org-1',
      ipAddress: '127.0.0.1',
      userAgent: 'Test browser',
      deviceName: 'Laptop',
      sessionId: 'session-1',
      reasonCode: 'CREDENTIALS_ACCEPTED',
    })).resolves.toBe(true);

    expect(audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        organizationId: 'org-1',
        eventType: AuthAuditEventType.LOGIN_SUCCESS,
        metadata: {
          deviceName: 'Laptop',
          reasonCode: 'CREDENTIALS_ACCEPTED',
          sessionId: 'session-1',
        },
      }),
    });
  });

  it('drops sensitive and unknown metadata fields', () => {
    expect(sanitizeAuthAuditMetadata({
      reasonCode: 'SAFE_REASON',
      password: 'do-not-store',
      rawRefreshToken: 'do-not-store',
      otp: '123456',
      cookieHeader: 'do-not-store',
      authorization: 'Bearer secret',
      arbitrary: 'not-allowlisted',
    })).toEqual({ reasonCode: 'SAFE_REASON' });
  });

  it('supports a userless failed-login event', async () => {
    const audit = writer();
    await recordAuthAudit(audit.client, {
      eventType: AuthAuditEventType.LOGIN_FAILURE,
      organizationId: 'org-1',
      reasonCode: 'INVALID_CREDENTIALS',
    });
    expect(audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        organizationId: 'org-1',
        eventType: AuthAuditEventType.LOGIN_FAILURE,
      }),
    });
  });

  it('records token reuse as a critical security event', async () => {
    const audit = writer();
    expect(getAuthAuditSeverity(AuthAuditEventType.TOKEN_REUSE_DETECTED))
      .toBe('critical');
    await recordAuthAudit(audit.client, {
      eventType: AuthAuditEventType.TOKEN_REUSE_DETECTED,
      userId: 'user-1',
      organizationId: 'org-1',
      reasonCode: 'ROTATED_TOKEN_REUSED',
    });
    expect(audit.create).toHaveBeenCalledOnce();
  });

  it('allows best-effort failures but fails closed for critical events', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = writer(async () => {
      throw new Error('database error with potentially sensitive context');
    });
    await expect(recordAuthAudit(failing.client, {
      eventType: AuthAuditEventType.LOGIN_FAILURE,
      organizationId: 'org-1',
    })).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith(
      '[AuthAudit] best-effort write failed for LOGIN_FAILURE',
    );

    await expect(recordAuthAudit(failing.client, {
      eventType: AuthAuditEventType.PASSWORD_RESET_COMPLETED,
      userId: 'user-1',
      organizationId: 'org-1',
    })).rejects.toThrow('Critical authentication audit write failed');
    expect(log.mock.calls.flat().join(' ')).not.toContain('database error');
  });
});
