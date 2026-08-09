import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  FIXTURE_CLOCK,
  makeCourseFixture,
  makeUserFixture,
} from './fixtures/factories';

const backendRoot = path.resolve(__dirname, '..');
const services = [
  'auth-service',
  'organization-service',
  'academic-service',
  'billing-service',
  'notification-service',
];

describe('database migration policy', () => {
  it('keeps an immutable timestamp-named baseline and migration lock per schema', () => {
    for (const service of services) {
      const migrationsDirectory = path.join(
        backendRoot,
        service,
        'src/prisma/migrations',
      );
      expect(
        fs.readFileSync(path.join(migrationsDirectory, 'migration_lock.toml'), 'utf8'),
      ).toContain('provider = "postgresql"');
      const names = fs.readdirSync(migrationsDirectory)
        .filter(name => fs.statSync(path.join(migrationsDirectory, name)).isDirectory());
      expect(names.length).toBeGreaterThan(0);
      expect(names.every(name => /^\d{14}_[a-z0-9_]+$/.test(name))).toBe(true);
      expect(names.some(name => /_(baseline|initial)$/.test(name))).toBe(true);
    }
  });

  it('never uses destructive schema synchronization in startup or workflows', () => {
    const files = [
      ...services.map(service => path.join(backendRoot, service, 'Dockerfile')),
      path.resolve(backendRoot, '../.github/workflows/security.yml'),
      path.resolve(backendRoot, '../.github/workflows/database-deploy.yml'),
    ];
    const forbidden = ['prisma db ' + 'push', 'migrate ' + 'reset', '--force-' + 'reset'];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(forbidden.filter(command => content.includes(command))).toEqual([]);
    }
  });

  it('uses Decimal plus an ISO currency and removes academic ownership duplicates', () => {
    const billing = fs.readFileSync(
      path.join(backendRoot, 'billing-service/src/prisma/schema.prisma'),
      'utf8',
    );
    expect(billing).not.toMatch(/\bamount\s+Float\b/);
    expect(billing.match(/\bamount\s+Decimal\b/g)?.length).toBe(3);
    expect(billing.match(/\bcurrency\s+String\b/g)?.length).toBe(3);

    const academic = fs.readFileSync(
      path.join(backendRoot, 'academic-service/src/prisma/schema.prisma'),
      'utf8',
    );
    for (const duplicate of ['Invoice', 'Payment', 'Notification']) {
      expect(academic).not.toMatch(new RegExp(`model\\s+${duplicate}\\s+\\{`));
    }
  });

  it('has soft-delete fields for authoritative organization, user, and course records', () => {
    const schemas = {
      organization: fs.readFileSync(
        path.join(backendRoot, 'organization-service/src/prisma/schema.prisma'),
        'utf8',
      ),
      auth: fs.readFileSync(
        path.join(backendRoot, 'auth-service/src/prisma/schema.prisma'),
        'utf8',
      ),
      academic: fs.readFileSync(
        path.join(backendRoot, 'academic-service/src/prisma/schema.prisma'),
        'utf8',
      ),
    };
    expect(schemas.organization).toMatch(/model Organization[\s\S]*?deletedAt\s+DateTime\?/);
    expect(schemas.auth).toMatch(/model UserAccount[\s\S]*?deletedAt\s+DateTime\?/);
    expect(schemas.academic).toMatch(/model Course[\s\S]*?deletedAt\s+DateTime\?/);
  });

  it('keeps seed execution dev/test-only and writes fixtures through upsert', () => {
    const seed = fs.readFileSync(path.join(backendRoot, 'scripts/seed-dev.js'), 'utf8');
    expect(seed).toContain("['development', 'test'].includes(runtimeEnvironment)");
    expect(seed).toContain('Development seed is forbidden');
    expect(seed).not.toMatch(/\.\s*createMany\s*\(/);
    expect(seed).not.toMatch(/\.\s*create\s*\(/);
    expect(seed.match(/\.upsert\s*\(/g)?.length).toBeGreaterThan(15);
  });

  it('configures physical backups, WAL archiving, retention, and a recovery startup drill', () => {
    const compose = fs.readFileSync(path.join(backendRoot, 'docker-compose.yml'), 'utf8');
    const backup = fs.readFileSync(
      path.join(backendRoot, 'config/postgres/backup-once.sh'),
      'utf8',
    );
    const restore = fs.readFileSync(
      path.join(backendRoot, 'config/postgres/restore-drill.sh'),
      'utf8',
    );
    expect(compose).toContain('archive_mode=on');
    expect(compose).toContain('archive_command=/usr/local/bin/archive-wal.sh %p %f');
    expect(backup).toContain('pg_basebackup');
    expect(backup).toContain('pg_verifybackup');
    expect(backup).toContain('POSTGRES_BACKUP_RETENTION_DAYS');
    expect(restore).toContain('recovery.signal');
    expect(restore).toContain('restore_command');
    expect(restore).toContain('schema_count');
  });
});

describe('deterministic fixture factories', () => {
  it('returns byte-for-byte stable identities and timestamps', () => {
    const first = makeUserFixture(7);
    const repeated = makeUserFixture(7);
    expect(repeated).toEqual(first);
    expect(first.createdAt).not.toBe(repeated.createdAt);
    expect(first.createdAt).toEqual(FIXTURE_CLOCK);
    expect(makeCourseFixture(3)).toEqual(makeCourseFixture(3));
  });
});
