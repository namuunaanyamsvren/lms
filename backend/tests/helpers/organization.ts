import { PrismaClient as OrganizationPrismaClient } from '@prisma/client-organization';

const getOrganizationDatabaseUrl = () => {
  if (process.env.ORGANIZATION_DATABASE_URL) {
    return process.env.ORGANIZATION_DATABASE_URL;
  }
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('schema', 'organization');
    return url.toString();
  }
  return 'postgresql://postgres:postgrespassword@localhost:5432/lms_db?schema=organization';
};

export const createTestOrganization = async (
  organizationId: string,
  slugPrefix: string,
) => {
  const prisma = new OrganizationPrismaClient({
    datasources: { db: { url: getOrganizationDatabaseUrl() } },
  });
  await prisma.organization.create({
    data: {
      id: organizationId,
      name: `Authentication test ${organizationId}`,
      slug: `${slugPrefix}-${organizationId}`.slice(0, 100),
      settings: {
        create: {
          allowRegister: true,
          requireEmailVerification: false,
          requirePhoneVerification: false,
          maxUsers: 100,
        },
      },
    },
  });

  return async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.$disconnect();
  };
};
