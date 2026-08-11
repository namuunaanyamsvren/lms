import { afterEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client-auth';

import {
  demoUserDefinitions,
  isDeployDemoUserSeedEnabled,
  resolveDemoOrganization,
} from '../auth-service/src/services/deploy-demo-users.service';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('deploy demo user seed service', () => {
  it('is enabled for Render staging unless explicitly disabled', () => {
    expect(isDeployDemoUserSeedEnabled({ NODE_ENV: 'staging' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isDeployDemoUserSeedEnabled({
      NODE_ENV: 'staging',
      ENABLE_DEMO_USERS_SEED: 'false',
    } as NodeJS.ProcessEnv)).toBe(false);
    expect(isDeployDemoUserSeedEnabled({
      NODE_ENV: 'production',
      ENABLE_DEMO_USERS_SEED: 'true',
    } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('uses privileged demo roles that public registration cannot create', () => {
    expect(demoUserDefinitions().map(user => [user.email, user.role])).toEqual([
      ['admin@lms.mn', Role.ORG_ADMIN],
      ['teacher@lms.mn', Role.INSTRUCTOR],
      ['student@lms.mn', Role.STUDENT],
      ['parent@lms.mn', Role.PARENT],
      ['principal@lms.mn', Role.PRINCIPAL],
      ['user@lms.mn', Role.USER],
    ]);
  });

  it('resolves the demo tenant through the organization service public route', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { id: 'org-1', slug: 'mongol-erdem' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveDemoOrganization('mongol-erdem', 'https://organization.example.com/'))
      .resolves.toEqual({ id: 'org-1', slug: 'mongol-erdem' });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestedUrl.origin).toBe('https://organization.example.com');
    expect(requestedUrl.pathname).toBe('/api/organizations/resolve');
    expect(requestedUrl.searchParams.get('host')).toBe('mongol-erdem');
  });
});
