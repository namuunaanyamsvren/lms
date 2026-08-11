import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const backendRoot = path.resolve(__dirname, '..');

describe('auth cookie deployment configuration', () => {
  it('uses the public versioned auth path for refresh cookies in compose configs', () => {
    for (const file of ['docker-compose.yml', 'docker-compose.managed-production.yml']) {
      const compose = fs.readFileSync(path.join(backendRoot, file), 'utf8');

      expect(compose).toContain('REFRESH_COOKIE_PATH: ${REFRESH_COOKIE_PATH:-/api/v1/auth}');
      expect(compose).not.toContain('REFRESH_COOKIE_PATH: ${REFRESH_COOKIE_PATH:-/api/auth}');
    }
  });
});
