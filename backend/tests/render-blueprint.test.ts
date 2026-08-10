import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const blueprint = fs.readFileSync(path.resolve(__dirname, '../render.yaml'), 'utf8');

describe('Render Blueprint service wiring', () => {
  it('does not hardcode Render service hostnames', () => {
    expect(blueprint).not.toMatch(/value:\s+https:\/\/lms-[\w-]+\.onrender\.com/);
  });

  it('resolves every cross-service URL from Render service metadata', () => {
    const serviceUrlBlocks = blueprint.match(
      /- key: [A-Z_]+_SERVICE_URL\n(?:\s{8,}.+\n){1,5}/g,
    ) ?? [];

    expect(serviceUrlBlocks.length).toBeGreaterThan(0);
    for (const block of serviceUrlBlocks) {
      expect(block).toContain('fromService:');
      expect(block).toContain('envVarKey: RENDER_EXTERNAL_URL');
    }
  });

  it('uses cross-site cookies on the public versioned auth path', () => {
    expect(blueprint).toMatch(
      /- key: REFRESH_COOKIE_PATH\n\s+value: \/api\/v1\/auth/,
    );
    expect(blueprint).toMatch(
      /- key: REFRESH_COOKIE_SAME_SITE\n\s+value: none/,
    );
  });
});
