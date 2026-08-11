#!/usr/bin/env node
/**
 * Upsert demo users into an existing organization.
 *
 * This script is intentionally separate from seed-dev.js because deployed
 * demo/staging databases may already have a real organization UUID. The
 * development seed uses fixed fixture IDs, which would not match that tenant.
 */
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { PrismaClient: AuthPrismaClient } = require('@prisma/client-auth');
const { PrismaClient: AcademicPrismaClient } = require('@prisma/client-academic');
const { PrismaClient: OrganizationPrismaClient } = require('@prisma/client-organization');

for (const envPath of [
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '..', '..', 'deploy.env'),
]) {
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
}

if (process.env.ALLOW_DEMO_SEED !== 'true') {
  throw new Error('Refusing to seed demo users unless ALLOW_DEMO_SEED=true is set');
}

const required = ['AUTH_DATABASE_URL', 'ACADEMIC_DATABASE_URL', 'ORGANIZATION_DATABASE_URL'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) throw new Error(`Missing required env values: ${missing.join(', ')}`);

const clientOptions = url => ({ datasources: { db: { url } } });
const auth = new AuthPrismaClient(clientOptions(process.env.AUTH_DATABASE_URL));
const academic = new AcademicPrismaClient(clientOptions(process.env.ACADEMIC_DATABASE_URL));
const organization = new OrganizationPrismaClient(clientOptions(process.env.ORGANIZATION_DATABASE_URL));

const slug = process.env.DEMO_ORGANIZATION_SLUG || 'mongol-erdem';
const password = process.env.DEMO_SEED_PASSWORD || 'password123';

const demoUsers = [
  {
    key: 'admin',
    email: 'admin@lms.mn',
    username: 'admin',
    phone: '99112233',
    firstName: 'Demo',
    lastName: 'Admin',
    role: 'ORG_ADMIN',
  },
  {
    key: 'teacher',
    email: 'teacher@lms.mn',
    username: 'teacher',
    phone: '99223344',
    firstName: 'Demo',
    lastName: 'Teacher',
    role: 'INSTRUCTOR',
  },
  {
    key: 'student',
    email: 'student@lms.mn',
    username: 'student',
    phone: '99334455',
    firstName: 'Demo',
    lastName: 'Student',
    role: 'STUDENT',
    studentId: 'STU-DEMO-0001',
    guardianLinkCode: 'PARENT-DEMO-0001',
  },
  {
    key: 'parent',
    email: 'parent@lms.mn',
    username: 'parent',
    phone: '99445566',
    firstName: 'Demo',
    lastName: 'Parent',
    role: 'PARENT',
  },
  {
    key: 'principal',
    email: 'principal@lms.mn',
    username: 'principal',
    phone: '99556677',
    firstName: 'Demo',
    lastName: 'Principal',
    role: 'PRINCIPAL',
  },
  {
    key: 'user',
    email: 'user@lms.mn',
    username: 'user',
    phone: '99667788',
    firstName: 'Demo',
    lastName: 'User',
    role: 'USER',
  },
];

const demoId = key => `demo-${slug}-${key}`;

async function main() {
  const org = await organization.organization.findFirst({
    where: { slug, deletedAt: null, status: 'ACTIVE' },
    include: { settings: true },
  });
  if (!org) throw new Error(`Active organization not found for slug: ${slug}`);

  await academic.organization.upsert({
    where: { slug: org.slug },
    create: {
      id: org.id,
      organizationId: org.id,
      name: org.name,
      slug: org.slug,
      domain: org.domain,
      logoUrl: org.logoUrl,
    },
    update: {
      organizationId: org.id,
      name: org.name,
      domain: org.domain,
      logoUrl: org.logoUrl,
      deletedAt: null,
    },
  });

  const passwordHash = await bcrypt.hash(password, 10);
  const authUsers = new Map();

  for (const user of demoUsers) {
    const authUser = await auth.userAccount.upsert({
      where: {
        organizationId_email: {
          organizationId: org.id,
          email: user.email,
        },
      },
      create: {
        id: demoId(user.key),
        organizationId: org.id,
        email: user.email,
        username: user.username,
        phone: user.phone,
        passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: 'ACTIVE',
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        studentId: user.studentId || null,
        guardianLinkCode: user.guardianLinkCode || null,
      },
      update: {
        username: user.username,
        phone: user.phone,
        passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: 'ACTIVE',
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        studentId: user.studentId || null,
        guardianLinkCode: user.guardianLinkCode || null,
        deletedAt: null,
      },
    });
    authUsers.set(user.key, authUser);

    await auth.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: authUser.id,
        },
      },
      create: {
        organizationId: org.id,
        userId: authUser.id,
        role: user.role,
        status: 'ACTIVE',
        source: 'DEMO_SEED',
        approvedAt: new Date(),
      },
      update: {
        role: user.role,
        status: 'ACTIVE',
        source: 'DEMO_SEED',
        approvedAt: new Date(),
      },
    });

    const academicUser = await academic.user.upsert({
      where: {
        organizationId_email: {
          organizationId: org.id,
          email: user.email,
        },
      },
      create: {
        id: authUser.id,
        organizationId: org.id,
        email: user.email,
        username: user.username,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: 'ACTIVE',
        isActive: true,
        passwordHash: null,
        studentId: user.studentId || null,
        guardianLinkCode: user.guardianLinkCode || null,
      },
      update: {
        username: user.username,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: 'ACTIVE',
        isActive: true,
        studentId: user.studentId || null,
        guardianLinkCode: user.guardianLinkCode || null,
        deletedAt: null,
      },
    });
    if (academicUser.id !== authUser.id) {
      throw new Error(`Academic/auth ID mismatch for ${user.email}`);
    }
  }

  const parent = authUsers.get('parent');
  const student = authUsers.get('student');
  const admin = authUsers.get('admin');
  if (parent && student) {
    await academic.guardian.upsert({
      where: {
        organizationId_parentUserId_studentUserId: {
          organizationId: org.id,
          parentUserId: parent.id,
          studentUserId: student.id,
        },
      },
      create: {
        organizationId: org.id,
        parentUserId: parent.id,
        studentUserId: student.id,
        relationship: 'LEGAL_GUARDIAN',
        status: 'APPROVED',
        invitedById: admin?.id,
        respondedAt: new Date(),
      },
      update: {
        relationship: 'LEGAL_GUARDIAN',
        status: 'APPROVED',
        invitedById: admin?.id,
        respondedAt: new Date(),
      },
    });
  }

  console.log(JSON.stringify({
    organizationId: org.id,
    slug: org.slug,
    users: demoUsers.map(user => ({ email: user.email, role: user.role })),
  }, null, 2));
}

main()
  .catch(error => {
    console.error('[demo-seed] Failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([
      auth.$disconnect(),
      academic.$disconnect(),
      organization.$disconnect(),
    ]);
  });
