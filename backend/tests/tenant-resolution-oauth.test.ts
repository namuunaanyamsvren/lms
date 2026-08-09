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

  it('creates an active organization during successful onboarding', async () => {
    vi.stubEnv('SERVICE_TOKEN_SECRET', 'test-service-token-secret-at-least-32-bytes');
    vi.spyOn(organizationPrisma.organization, 'findUnique').mockResolvedValue(null);
    const create = vi.spyOn(organizationPrisma.organization, 'create').mockResolvedValue({
      id: 'org-new',
      name: 'New School',
      slug: 'new-school',
      domain: null,
      logoUrl: null,
      faviconUrl: null,
      status: 'ACTIVE',
      settings: {},
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

    expect(created).toMatchObject({ id: 'org-new', slug: 'new-school', status: 'ACTIVE' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ slug: 'new-school' }),
    }));
  });

  it('resolves an active organization by tenant slug', async () => {
    vi.stubEnv('TENANT_BASE_DOMAIN', 'lms-i3ha.vercel.app');
    const findFirst = vi.spyOn(organizationPrisma.organization, 'findFirst').mockResolvedValue({
      id: 'org-1',
      name: 'Mongol Erdem',
      slug: 'mongol-erdem',
      domain: null,
      logoUrl: null,
      faviconUrl: null,
      settings: null,
    } as any);
    const res = responseMock();

    await resolveTenant({ query: { host: 'mongol-erdem' } } as any, res as any);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        deletedAt: null,
        status: 'ACTIVE',
        OR: expect.arrayContaining([{ slug: 'mongol-erdem' }]),
      }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ id: 'org-1', slug: 'mongol-erdem' }),
    }));
  });

  it('resolves an active organization by full hostname', async () => {
    vi.stubEnv('TENANT_BASE_DOMAIN', 'lms-i3ha.vercel.app');
    const findFirst = vi.spyOn(organizationPrisma.organization, 'findFirst').mockResolvedValue({
      id: 'org-2',
      name: 'Mongol Erdem',
      slug: 'mongol-erdem',
      domain: null,
      logoUrl: null,
      faviconUrl: null,
      settings: null,
    } as any);
    const res = responseMock();

    await resolveTenant({ query: { host: 'mongol-erdem.lms-i3ha.vercel.app' } } as any, res as any);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([{ slug: 'mongol-erdem' }]),
      }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ id: 'org-2', slug: 'mongol-erdem' }),
    }));
  });

  it('rolls back the organization when downstream admin provisioning fails', async () => {
    vi.stubEnv('SERVICE_TOKEN_SECRET', 'test-service-token-secret-at-least-32-bytes');
    vi.spyOn(organizationPrisma.organization, 'findUnique').mockResolvedValue(null);
    vi.spyOn(organizationPrisma.organization, 'create').mockResolvedValue({
      id: 'org-rollback',
      name: 'Rollback School',
      slug: 'rollback-school',
      domain: null,
      logoUrl: null,
      settings: {},
    } as any);
    const rollback = vi.spyOn(organizationPrisma.organization, 'delete').mockResolvedValue({} as any);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'admin failed' }), { status: 502 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(onboardOrganization({
      name: 'Rollback School',
      slug: 'rollback-school',
      admin: {
        email: 'admin@school.mn',
        password: 'StrongPass123!',
        firstName: 'Admin',
        lastName: 'User',
      },
    })).rejects.toThrow('admin failed');

    expect(rollback).toHaveBeenCalledWith({ where: { id: 'org-rollback' } });
  });
});
