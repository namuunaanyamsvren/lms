import { afterEach, describe, expect, it, vi } from 'vitest';
import { provisionOrganization } from '../academic-service/src/controllers/internal-organization.controller';
import { prisma } from '../academic-service/src/lib/prisma';

const responseMock = () => {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  return res;
};

describe('academic organization provisioning', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates a tenant projection on first provisioning', async () => {
    vi.spyOn(prisma.organization, 'findUnique')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const create = vi.spyOn(prisma.organization, 'create').mockResolvedValue({
      id: 'org-1',
      organizationId: 'org-1',
      name: 'School',
      slug: 'school',
      deletedAt: null,
    } as any);
    const res = responseMock();

    await provisionOrganization({
      body: { id: 'org-1', name: 'School', slug: 'school', domain: null, logoUrl: null },
    } as any, res as any);

    expect(create).toHaveBeenCalledWith({
      data: {
        id: 'org-1',
        organizationId: 'org-1',
        name: 'School',
        slug: 'school',
        domain: null,
        logoUrl: null,
        deletedAt: null,
      },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('revives a soft-deleted projection with the same slug instead of failing unique constraints', async () => {
    vi.spyOn(prisma.organization, 'findUnique')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'old-org',
        organizationId: 'old-org',
        name: 'Old School',
        slug: 'mongol-erdem',
        deletedAt: new Date('2026-08-09T00:00:00Z'),
      } as any);
    const update = vi.spyOn(prisma.organization, 'update').mockResolvedValue({
      id: 'old-org',
      organizationId: 'new-org',
      name: 'Монгол Эрдэм',
      slug: 'mongol-erdem',
      deletedAt: null,
    } as any);
    const create = vi.spyOn(prisma.organization, 'create');
    const res = responseMock();

    await provisionOrganization({
      body: { id: 'new-org', name: 'Монгол Эрдэм', slug: 'mongol-erdem', domain: null, logoUrl: null },
    } as any, res as any);

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'old-org' },
      data: {
        id: 'new-org',
        organizationId: 'new-org',
        name: 'Монгол Эрдэм',
        slug: 'mongol-erdem',
        domain: null,
        logoUrl: null,
        deletedAt: null,
      },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('is idempotent for an existing projection with the same id and slug', async () => {
    vi.spyOn(prisma.organization, 'findUnique').mockResolvedValueOnce({
      id: 'org-1',
      organizationId: 'org-1',
      name: 'School',
      slug: 'school',
      deletedAt: null,
    } as any);
    const update = vi.spyOn(prisma.organization, 'update').mockResolvedValue({
      id: 'org-1',
      organizationId: 'org-1',
      name: 'School',
      slug: 'school',
      deletedAt: null,
    } as any);
    const create = vi.spyOn(prisma.organization, 'create');
    const res = responseMock();

    await provisionOrganization({
      body: { id: 'org-1', name: 'School', slug: 'school', domain: null, logoUrl: null },
    } as any, res as any);

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: {
        organizationId: 'org-1',
        name: 'School',
        slug: 'school',
        domain: null,
        logoUrl: null,
        deletedAt: null,
      },
    });
  });

  it('does not revive or overwrite an active projection owned by another organization id', async () => {
    vi.spyOn(prisma.organization, 'findUnique')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'other-org',
        organizationId: 'other-org',
        name: 'Other School',
        slug: 'mongol-erdem',
        deletedAt: null,
      } as any);
    const update = vi.spyOn(prisma.organization, 'update');
    const create = vi.spyOn(prisma.organization, 'create');
    const res = responseMock();

    await expect(provisionOrganization({
      body: { id: 'new-org', name: 'Монгол Эрдэм', slug: 'mongol-erdem', domain: null, logoUrl: null },
    } as any, res as any)).rejects.toThrow('Organization slug is already provisioned');

    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a request whose id and new slug conflict with another projection', async () => {
    vi.spyOn(prisma.organization, 'findUnique')
      .mockResolvedValueOnce({
        id: 'org-1',
        organizationId: 'org-1',
        name: 'School',
        slug: 'school',
        deletedAt: null,
      } as any)
      .mockResolvedValueOnce({
        id: 'other-org',
        organizationId: 'other-org',
        name: 'Other School',
        slug: 'other-school',
        deletedAt: null,
      } as any);
    const update = vi.spyOn(prisma.organization, 'update');

    await expect(provisionOrganization({
      body: { id: 'org-1', name: 'School', slug: 'other-school', domain: null, logoUrl: null },
    } as any, responseMock() as any)).rejects.toThrow('Organization slug is already provisioned');

    expect(update).not.toHaveBeenCalled();
  });
});
