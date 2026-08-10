import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTenant } from '../organization-service/src/controllers/organization.controller';
import { onboardOrganization, organizationPrisma } from '../organization-service/src/services/onboarding.service';

const responseMock = () => {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  return res;
};

describe('tenant resolution and OAuth contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('resolves an active organization by full hostname', async () => {
    vi.stubEnv('TENANT_BASE_DOMAIN', 'lms-i3ha.vercel.app');
    const findFirst = vi.spyOn(organizationPrisma.organization, 'findFirst').mockResolvedValue({
      id: 'org-1',
      name: 'Mongol Erdem',
      slug: 'mongol-erdem',
      domain: null,
      logoUrl: null,
      faviconUrl: null,
      settings: { primaryColor: '#4F46E5', locale: 'mn-MN', allowRegister: true },
    } as any);
    const res = responseMock();

    await resolveTenant({ query: { host: 'mongol-erdem.lms-i3ha.vercel.app' } } as any, res as any);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        deletedAt: null,
        status: { in: ['ACTIVE', 'TRIAL'] },
        OR: expect.arrayContaining([{ slug: 'mongol-erdem' }]),
      }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ id: 'org-1', slug: 'mongol-erdem' }),
    }));
  });

  it('resolves an active organization by tenant slug', async () => {
    vi.stubEnv('TENANT_BASE_DOMAIN', 'lms-i3ha.vercel.app');
    const findFirst = vi.spyOn(organizationPrisma.organization, 'findFirst').mockResolvedValue({
      id: 'org-2',
      name: 'School One',
      slug: 'school-one',
      domain: null,
      logoUrl: null,
      faviconUrl: null,
      settings: null,
    } as any);
    const res = responseMock();

    await resolveTenant({ query: { slug: 'school-one' } } as any, res as any);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([{ slug: 'school-one' }]),
      }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ id: 'org-2', slug: 'school-one' }),
    }));
  });

  it('resolves a newly onboarded organization after provisioning succeeds', async () => {
    vi.stubEnv('SERVICE_TOKEN_SECRET', 'test-service-token-secret-at-least-32-bytes');
    vi.stubEnv('FEATURE_BILLING_ENABLED', 'false');
    vi.spyOn(organizationPrisma.organization, 'findUnique').mockResolvedValue(null);
    vi.spyOn(organizationPrisma.organization, 'create').mockResolvedValue({
      id: 'org-new',
      name: 'New School',
      slug: 'new-school',
      domain: null,
      logoUrl: null,
      faviconUrl: null,
      status: 'ACTIVE',
      settings: { primaryColor: '#4F46E5', locale: 'mn-MN', allowRegister: true },
    } as any);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 201 }));

    const created = await onboardOrganization({
      name: 'New School',
      slug: 'new-school',
      admin: {
        email: 'admin@school.mn',
        password: 'StrongPass123!',
        firstName: 'Admin',
        lastName: 'User',
      },
    });

    vi.spyOn(organizationPrisma.organization, 'findFirst').mockResolvedValue(created as any);
    const res = responseMock();
    await resolveTenant({ query: { slug: 'new-school' } } as any, res as any);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ id: 'org-new', slug: 'new-school' }),
    }));
  });

  it('creates billing-enabled organizations as login-ready trials', async () => {
    vi.stubEnv('SERVICE_TOKEN_SECRET', 'test-service-token-secret-at-least-32-bytes');
    vi.stubEnv('FEATURE_BILLING_ENABLED', 'true');
    vi.spyOn(organizationPrisma.organization, 'findUnique').mockResolvedValue(null);
    const create = vi.spyOn(organizationPrisma.organization, 'create').mockResolvedValue({
      id: 'org-trial',
      name: 'Trial School',
      slug: 'trial-school',
      domain: null,
      logoUrl: null,
      faviconUrl: null,
      status: 'TRIAL',
      settings: {},
    } as any);
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 201 }));

    const created = await onboardOrganization({
      name: 'Trial School',
      slug: 'trial-school',
      admin: {
        email: 'admin@school.mn',
        password: 'StrongPass123!',
        firstName: 'Admin',
        lastName: 'User',
      },
    });

    expect(created).toMatchObject({ id: 'org-trial', status: 'TRIAL' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'TRIAL', slug: 'trial-school' }),
    }));
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain('"isActive":true');
  });
});
