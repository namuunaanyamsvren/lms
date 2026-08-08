import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AppError,
  createSignedFileUrl,
  inspectUpload,
  scanUploadForMalware,
  validateFileSecurityEnvironment,
  validateTransportSecurity,
  verifySignedFileRequest,
} from '@lms/shared';
import { parseRetentionDays } from '../auth-service/src/services/auth-retention.service';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe('file admission security', () => {
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
  ]);

  it('accepts an allowlisted file only when extension, MIME, and magic bytes agree', () => {
    const result = inspectUpload(png, 'image/png', '../../course-cover.png');
    expect(result).toMatchObject({
      filename: 'course-cover.png',
      declaredMime: 'image/png',
      detectedMime: 'image/png',
      size: png.length,
    });
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects MIME spoofing and executable content', () => {
    expect(() => inspectUpload(png, 'image/jpeg', 'cover.jpg')).toThrow(AppError);
    expect(() =>
      inspectUpload(Buffer.from('MZ executable'), 'application/pdf', 'notes.pdf'),
    ).toThrow(/content does not match/i);
  });

  it('fails closed when required malware scanning is unavailable', async () => {
    process.env.MALWARE_SCAN_MODE = 'required';
    delete process.env.MALWARE_SCANNER_URL;
    await expect(scanUploadForMalware(png, 'cover.png', 'a'.repeat(64)))
      .rejects.toMatchObject({ statusCode: 503 });
  });

  it('rejects a scanner finding', async () => {
    process.env.MALWARE_SCAN_MODE = 'required';
    process.env.MALWARE_SCANNER_URL = 'https://scanner.example.test/scan';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ clean: false, threat: 'test-signature' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ));
    await expect(scanUploadForMalware(png, 'cover.png', 'a'.repeat(64)))
      .rejects.toMatchObject({ statusCode: 422 });
  });
});

describe('tenant-bound signed file URLs', () => {
  it('expires, detects tampering, and rejects another tenant key', () => {
    process.env.FILE_SIGNING_SECRET = 's'.repeat(48);
    process.env.FILE_DOWNLOAD_BASE_URL = 'https://api.example.test/api/uploads/download';
    const now = new Date('2026-07-30T00:00:00.000Z');
    const signed = createSignedFileUrl({
      organizationId: 'org-a',
      fileKey: 'org-a/course/cover.png',
      expiresInSeconds: 60,
      now,
    });
    const parsed = new URL(signed.url);
    const input = {
      organizationId: 'org-a',
      fileKey: 'org-a/course/cover.png',
      expiresAt: Number(parsed.searchParams.get('expires')),
      signature: parsed.searchParams.get('signature')!,
    };
    expect(verifySignedFileRequest({ ...input, now })).toBe(true);
    expect(verifySignedFileRequest({
      ...input,
      signature: `${input.signature.slice(0, -1)}x`,
      now,
    })).toBe(false);
    expect(verifySignedFileRequest({
      ...input,
      now: new Date('2026-07-30T00:01:01.000Z'),
    })).toBe(false);
    expect(() => createSignedFileUrl({
      organizationId: 'org-a',
      fileKey: 'org-b/course/cover.png',
      now,
    })).toThrow(/does not belong/i);
  });
});

describe('production transport and retention policies', () => {
  it('fails closed if production internal TLS enforcement is not enabled', () => {
    expect(() => validateTransportSecurity('gateway', {
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://app.example.test',
    })).toThrow(/REQUIRE_INTERNAL_TLS must be true/);
  });

  it('requires TLS URLs when internal TLS enforcement is enabled', () => {
    expect(() => validateTransportSecurity('auth', {
      NODE_ENV: 'production',
      REQUIRE_INTERNAL_TLS: 'true',
      ALLOWED_ORIGINS: 'https://app.example.test',
      FRONTEND_URL: 'https://app.example.test',
      ORGANIZATION_SERVICE_URL: 'http://organization-service:8002',
      REDIS_URL: 'redis://redis:6379',
      RABBITMQ_URL: 'amqp://rabbitmq:5672',
      DATABASE_URL: 'postgresql://db/lms',
    })).toThrow(/ORGANIZATION_SERVICE_URL must use HTTPS/);
  });

  it('accepts verified TLS transport settings and validates file security startup', () => {
    expect(() => validateTransportSecurity('academic', {
      NODE_ENV: 'production',
      REQUIRE_INTERNAL_TLS: 'true',
      ALLOWED_ORIGINS: 'https://app.example.test',
      AUTH_SERVICE_URL: 'https://auth.internal',
      REDIS_URL: 'rediss://redis.internal:6380',
      RABBITMQ_URL: 'amqps://rabbit.internal:5671',
      DATABASE_URL: 'postgresql://db/lms?sslmode=verify-full',
    })).not.toThrow();
    expect(() => validateFileSecurityEnvironment({
      NODE_ENV: 'production',
      FILE_SIGNING_SECRET: 'f'.repeat(48),
      FILE_DOWNLOAD_BASE_URL: 'https://api.example.test/api/uploads/download',
      FILE_STORAGE_DIRECTORY: '/var/lib/lms/private-uploads',
      FILE_STORAGE_AT_REST_ENCRYPTED: 'true',
      MALWARE_SCAN_MODE: 'required',
      MALWARE_SCANNER_URL: 'https://scanner.internal/scan',
    })).not.toThrow();
  });

  it('bounds retention configuration', () => {
    expect(parseRetentionDays(undefined, 365, 'TEST_RETENTION')).toBe(365);
    expect(() => parseRetentionDays('0', 365, 'TEST_RETENTION')).toThrow();
    expect(() => parseRetentionDays('3651', 365, 'TEST_RETENTION')).toThrow();
  });
});

describe('tenant and SQL injection regression guardrails', () => {
  it('requires organizationId on every tenant academic resource model', () => {
    const schema = fs.readFileSync(
      path.resolve(__dirname, '../academic-service/src/prisma/schema.prisma'),
      'utf8',
    );
    const infrastructureModels = new Set(['EventInbox', 'AcademicOutboxEvent']);
    const models = [...schema.matchAll(/model\s+(\w+)\s+\{([\s\S]*?)\n\}/g)];
    const missing = models
      .filter(([, name]) => !infrastructureModels.has(name))
      .filter(([, , body]) => !/^\s*organizationId\s+String/m.test(body))
      .map(([, name]) => name);
    expect(missing).toEqual([]);
  });

  it('does not use unsafe raw SQL execution APIs in service source', () => {
    const serviceDirectories = fs.readdirSync(path.resolve(__dirname, '..'), {
      withFileTypes: true,
    })
      .filter(entry => entry.isDirectory() && (entry.name === 'shared' || entry.name.endsWith('-service')))
      .map(entry => path.resolve(__dirname, '..', entry.name, 'src'));
    const sourceFiles: string[] = [];
    const walk = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(target);
        else if (entry.isFile() && target.endsWith('.ts')) sourceFiles.push(target);
      }
    };
    serviceDirectories.forEach(walk);
    const forbidden = ['$queryRaw' + 'Unsafe', '$executeRaw' + 'Unsafe'];
    const violations = sourceFiles.filter(file => {
      const source = fs.readFileSync(file, 'utf8');
      return forbidden.some(api => source.includes(api));
    });
    expect(violations).toEqual([]);
  });
});
