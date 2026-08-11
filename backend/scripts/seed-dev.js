#!/usr/bin/env node
/**
 * Deterministic, idempotent development/test fixtures.
 *
 * Production is always rejected. Non-loopback databases require the explicit
 * ALLOW_NONLOCAL_DEV_SEED=true escape hatch for ephemeral shared test systems.
 * Every domain row uses an upsert and a stable natural key or fixture id.
 */
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { PrismaClient: AuthPrismaClient } = require('@prisma/client-auth');
const { PrismaClient: AcademicPrismaClient } = require('@prisma/client-academic');
const { PrismaClient: OrganizationPrismaClient } = require('@prisma/client-organization');
const { PrismaClient: BillingPrismaClient } = require('@prisma/client-billing');
const { PrismaClient: NotificationPrismaClient } = require('@prisma/client-notification');

const runtimeEnvironment = (process.env.NODE_ENV || 'development').toLowerCase();
if (!['development', 'test'].includes(runtimeEnvironment)) {
  throw new Error('Development seed is forbidden unless NODE_ENV is development or test');
}

function localDatabaseUrl(schema) {
  if (!process.env.POSTGRES_PASSWORD) {
    throw new Error(`${schema.toUpperCase()}_DATABASE_URL or POSTGRES_PASSWORD is required`);
  }
  const value = new URL('postgresql://localhost:5432/lms_db');
  value.username = process.env.POSTGRES_USER || 'postgres';
  value.password = process.env.POSTGRES_PASSWORD;
  value.searchParams.set('schema', schema);
  return value.toString();
}

const databaseUrls = {
  auth: process.env.AUTH_DATABASE_URL || localDatabaseUrl('auth'),
  academic: process.env.ACADEMIC_DATABASE_URL || localDatabaseUrl('academic'),
  organization: process.env.ORGANIZATION_DATABASE_URL || localDatabaseUrl('organization'),
  billing: process.env.BILLING_DATABASE_URL || localDatabaseUrl('billing'),
  notification: process.env.NOTIFICATION_DATABASE_URL || localDatabaseUrl('notification'),
};

if (process.env.ALLOW_NONLOCAL_DEV_SEED !== 'true') {
  const unsafe = Object.entries(databaseUrls).filter(([, value]) => {
    const hostname = new URL(value).hostname;
    return !['localhost', '127.0.0.1', '::1'].includes(hostname);
  });
  if (unsafe.length) {
    throw new Error(
      `Refusing non-local seed targets: ${unsafe.map(([name]) => name).join(', ')}. ` +
      'Use an ephemeral database and set ALLOW_NONLOCAL_DEV_SEED=true explicitly.',
    );
  }
}

const clientOptions = url => ({ datasources: { db: { url } } });
const auth = new AuthPrismaClient(clientOptions(databaseUrls.auth));
const academic = new AcademicPrismaClient(clientOptions(databaseUrls.academic));
const organization = new OrganizationPrismaClient(clientOptions(databaseUrls.organization));
const billing = new BillingPrismaClient(clientOptions(databaseUrls.billing));
const notification = new NotificationPrismaClient(clientOptions(databaseUrls.notification));

const FIXED_NOW = new Date('2026-07-30T00:00:00.000Z');
const ids = Object.freeze({
  organization: 'org_main',
  admin: 'usr_admin_1',
  teacher: 'usr_teacher_1',
  student: 'usr_student_1',
  parent: 'usr_parent_1',
  user: 'usr_user_1',
  principal: 'usr_principal_1',
  course: 'course_calculus_1',
  courseProgramming: 'course_programming_1',
  module: 'module_calculus_1',
  lesson: 'lesson_limits_1',
  lessonDerivative: 'lesson_derivatives_1',
  schedule: 'schedule_calculus_monday',
  academicYear: '71111111-1111-4111-8111-111111111111',
  academicTerm: '72222222-2222-4222-8222-222222222222',
  campus: '73333333-3333-4333-8333-333333333333',
  building: '74444444-4444-4444-8444-444444444444',
  room: '75555555-5555-4555-8555-555555555555',
  cohort: 'cohort_calculus_spring_2026',
  enrollment: 'enrollment_student_calculus',
  assignment: 'assignment_matrix_1',
  submission: 'submission_matrix_student_1',
  grade: 'grade_matrix_student_1',
  attendance: 'attendance_student_20260730',
  guardian: 'guardian_parent_student_1',
  certificate: 'certificate_calculus_student_1',
  announcement: 'announcement_library_hours',
  audit: 'audit_seed_completed',
  subscription: 'subscription_org_main',
  invoice: 'invoice_org_main_202607',
  payment: 'payment_org_main_202607',
  notificationStudent: 'notification_student_welcome',
  notificationParent: 'notification_parent_progress',
  notificationStudentDelivery: 'delivery_student_welcome',
  notificationParentDelivery: 'delivery_parent_progress',
});

const users = [
  {
    id: ids.admin, email: 'admin@lms.mn', username: 'admin', phone: '99112233',
    firstName: 'Бат-Эрдэнэ', lastName: 'Ганболд', role: 'ORG_ADMIN',
  },
  {
    id: ids.teacher, email: 'teacher@lms.mn', username: 'teacher', phone: '99223344',
    firstName: 'Энхмаа', lastName: 'Дорж', role: 'INSTRUCTOR',
  },
  {
    id: ids.student, email: 'student@lms.mn', username: 'student', phone: '99334455',
    firstName: 'Болд', lastName: 'Сувд', role: 'STUDENT', studentId: 'STU-2026-0001', guardianLinkCode: 'PARENT-0001',
  },
  {
    id: ids.parent, email: 'parent@lms.mn', username: 'parent', phone: '99445566',
    firstName: 'Наранцэцэг', lastName: 'Болд', role: 'PARENT',
  },
  {
    id: ids.principal, email: 'principal@lms.mn', username: 'principal', phone: '99667788',
    firstName: 'Баатар', lastName: 'Мөнх', role: 'PRINCIPAL',
  },
  {
    id: ids.user, email: 'user@lms.mn', username: 'user', phone: '99556677',
    firstName: 'Номин', lastName: 'Гэрэл', role: 'USER',
  },
];

async function seedOrganizations() {
  await organization.organization.upsert({
    where: { slug: 'mongol-erdem' },
    create: {
      id: ids.organization,
      name: 'Монгол Эрдэм Их Сургууль',
      slug: 'mongol-erdem',
      domain: 'lms.mn',
      settings: {
        create: {
          primaryColor: '#4F46E5',
          allowRegister: true,
          maxUsers: 500,
        },
      },
    },
    update: {
      name: 'Монгол Эрдэм Их Сургууль',
      domain: 'lms.mn',
      status: 'ACTIVE',
      deletedAt: null,
      settings: {
        upsert: {
          create: { primaryColor: '#4F46E5', allowRegister: true, maxUsers: 500 },
          update: { primaryColor: '#4F46E5', allowRegister: true, maxUsers: 500 },
        },
      },
    },
  });
  await academic.organization.upsert({
    where: { slug: 'mongol-erdem' },
    create: {
      id: ids.organization,
      organizationId: ids.organization,
      name: 'Монгол Эрдэм Их Сургууль',
      slug: 'mongol-erdem',
      domain: 'lms.mn',
    },
    update: {
      organizationId: ids.organization,
      name: 'Монгол Эрдэм Их Сургууль',
      domain: 'lms.mn',
      deletedAt: null,
    },
  });
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash(
    process.env.DEV_SEED_PASSWORD || 'password123',
    10,
  );
  for (const user of users) {
    const authUser = await auth.userAccount.upsert({
      where: {
        organizationId_email: {
          organizationId: ids.organization,
          email: user.email,
        },
      },
      create: {
        ...user,
        organizationId: ids.organization,
        passwordHash,
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
      },
      update: {
        username: user.username,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        studentId: user.studentId || null,
        guardianLinkCode: user.guardianLinkCode || null,
        employeeId: user.employeeId || null,
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        deletedAt: null,
        ...(process.env.RESET_DEV_SEED_PASSWORD === 'true' ? { passwordHash } : {}),
      },
    });
    if (authUser.id !== user.id) {
      throw new Error(`Fixture identity mismatch for ${user.email}: expected ${user.id}`);
    }
    const academicUser = await academic.user.upsert({
      where: {
        organizationId_email: {
          organizationId: ids.organization,
          email: user.email,
        },
      },
      create: {
        ...user,
        organizationId: ids.organization,
        passwordHash: null,
        isActive: true,
      },
      update: {
        username: user.username,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        studentId: user.studentId || null,
        guardianLinkCode: user.guardianLinkCode || null,
        employeeId: user.employeeId || null,
        isActive: true,
        deletedAt: null,
      },
    });
    if (academicUser.id !== authUser.id) {
      throw new Error(`Cross-service fixture identity mismatch for ${user.email}`);
    }
  }
}

async function seedAcademic() {
  const academicYear = await academic.academicYear.upsert({
    where: {
      organizationId_name: {
        organizationId: ids.organization,
        name: '2026–2027 хичээлийн жил',
      },
    },
    create: {
      id: ids.academicYear,
      organizationId: ids.organization,
      name: '2026–2027 хичээлийн жил',
      startDate: new Date('2026-08-20T00:00:00.000Z'),
      endDate: new Date('2027-06-30T00:00:00.000Z'),
      status: 'ACTIVE',
    },
    update: {
      startDate: new Date('2026-08-20T00:00:00.000Z'),
      endDate: new Date('2027-06-30T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  });
  const academicTerm = await academic.academicTerm.upsert({
    where: {
      organizationId_code: {
        organizationId: ids.organization,
        code: '2026-FALL',
      },
    },
    create: {
      id: ids.academicTerm,
      organizationId: ids.organization,
      academicYearId: academicYear.id,
      code: '2026-FALL',
      name: 'Намрын улирал',
      startDate: new Date('2026-08-20T00:00:00.000Z'),
      endDate: new Date('2026-12-20T00:00:00.000Z'),
      status: 'ACTIVE',
    },
    update: {
      academicYearId: academicYear.id,
      name: 'Намрын улирал',
      startDate: new Date('2026-08-20T00:00:00.000Z'),
      endDate: new Date('2026-12-20T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  });
  const campus = await academic.campus.upsert({
    where: {
      organizationId_code: { organizationId: ids.organization, code: 'MAIN' },
    },
    create: {
      id: ids.campus,
      organizationId: ids.organization,
      code: 'MAIN',
      name: 'Төв кампус',
      address: 'Улаанбаатар',
    },
    update: { name: 'Төв кампус', address: 'Улаанбаатар' },
  });
  const building = await academic.building.upsert({
    where: {
      organizationId_campusId_code: {
        organizationId: ids.organization,
        campusId: campus.id,
        code: 'A',
      },
    },
    create: {
      id: ids.building,
      organizationId: ids.organization,
      campusId: campus.id,
      code: 'A',
      name: 'А байр',
    },
    update: { name: 'А байр' },
  });
  const room = await academic.room.upsert({
    where: {
      organizationId_buildingId_code: {
        organizationId: ids.organization,
        buildingId: building.id,
        code: 'A-204',
      },
    },
    create: {
      id: ids.room,
      organizationId: ids.organization,
      buildingId: building.id,
      code: 'A-204',
      name: 'Лекцийн танхим',
      capacity: 40,
      type: 'CLASSROOM',
    },
    update: { name: 'Лекцийн танхим', capacity: 40, type: 'CLASSROOM' },
  });
  const course = await academic.course.upsert({
    where: {
      organizationId_code: { organizationId: ids.organization, code: 'MATH-101' },
    },
    create: {
      id: ids.course,
      organizationId: ids.organization,
      code: 'MATH-101',
      title: 'Математик шинжилгээ I',
      description: 'Дифференциал болон интеграл тооллын үндэс',
      credits: 3,
      level: 'UNDERGRADUATE',
      durationWeeks: 12,
      price: 450000,
      currency: 'MNT',
      capacity: 40,
      department: 'Математикийн тэнхим',
      instructorId: ids.teacher,
      status: 'PUBLISHED',
      publishedAt: FIXED_NOW,
    },
    update: {
      title: 'Математик шинжилгээ I',
      description: 'Дифференциал болон интеграл тооллын үндэс',
      credits: 3,
      durationWeeks: 12,
      price: 450000,
      currency: 'MNT',
      capacity: 40,
      instructorId: ids.teacher,
      status: 'PUBLISHED',
      deletedAt: null,
    },
  });
  await academic.course.upsert({
    where: {
      organizationId_code: { organizationId: ids.organization, code: 'CS-101' },
    },
    create: {
      id: ids.courseProgramming,
      organizationId: ids.organization,
      code: 'CS-101',
      title: 'Програмчлалын үндэс',
      description: 'Python ба JavaScript програмчлалын суурь',
      credits: 3,
      durationWeeks: 10,
      price: 650000,
      currency: 'MNT',
      department: 'Компьютерын ухааны тэнхим',
      instructorId: ids.teacher,
      status: 'PUBLISHED',
      publishedAt: FIXED_NOW,
    },
    update: {
      title: 'Програмчлалын үндэс',
      durationWeeks: 10,
      price: 650000,
      currency: 'MNT',
      instructorId: ids.teacher,
      status: 'PUBLISHED',
      deletedAt: null,
    },
  });
  await academic.courseInstructor.upsert({
    where: {
      organizationId_courseId_userId: {
        organizationId: ids.organization,
        courseId: course.id,
        userId: ids.teacher,
      },
    },
    create: {
      id: 'course_instructor_calculus_owner',
      organizationId: ids.organization,
      courseId: course.id,
      userId: ids.teacher,
      role: 'OWNER',
    },
    update: { role: 'OWNER' },
  });
  await academic.module.upsert({
    where: { id: ids.module },
    create: {
      id: ids.module,
      organizationId: ids.organization,
      courseId: course.id,
      title: 'Нэгж 1: Лимит ба уламжлал',
      order: 1,
    },
    update: { title: 'Нэгж 1: Лимит ба уламжлал', order: 1 },
  });
  await academic.lesson.upsert({
    where: { id: ids.lesson },
    create: {
      id: ids.lesson,
      organizationId: ids.organization,
      moduleId: ids.module,
      title: 'Функцийн хязгаар',
      content: '<p>Лекц 1: Хязгаарын тодорхойлолт</p>',
      order: 1,
    },
    update: { title: 'Функцийн хязгаар', order: 1 },
  });
  await academic.lesson.upsert({
    where: { id: ids.lessonDerivative },
    create: {
      id: ids.lessonDerivative,
      organizationId: ids.organization,
      moduleId: ids.module,
      title: 'Уламжлалын дүрмүүд',
      content: '<p>Лекц 2: Уламжлал олох аргууд</p>',
      order: 2,
    },
    update: { title: 'Уламжлалын дүрмүүд', order: 2 },
  });
  await academic.schedule.upsert({
    where: { id: ids.schedule },
    create: {
      id: ids.schedule,
      organizationId: ids.organization,
      courseId: course.id,
      teacherId: ids.teacher,
      title: 'Математик шинжилгээ I — Лекц',
      dayOfWeek: 'MONDAY',
      startTime: '09:00',
      endTime: '10:30',
      room: room.name,
      roomId: room.id,
      semester: academicTerm.code,
      termId: academicTerm.id,
    },
    update: {
      teacherId: ids.teacher,
      title: 'Математик шинжилгээ I — Лекц',
      dayOfWeek: 'MONDAY',
      startTime: '09:00',
      endTime: '10:30',
      room: room.name,
      roomId: room.id,
      semester: academicTerm.code,
      termId: academicTerm.id,
    },
  });
  await academic.cohort.upsert({
    where: { id: ids.cohort },
    create: {
      id: ids.cohort,
      organizationId: ids.organization,
      courseId: course.id,
      name: '2026 оны хаврын улирал — А бүлэг',
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T00:00:00.000Z'),
    },
    update: {
      name: '2026 оны хаврын улирал — А бүлэг',
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T00:00:00.000Z'),
    },
  });
  await academic.enrollment.upsert({
    where: {
      organizationId_userId_cohortId: {
        organizationId: ids.organization,
        userId: ids.student,
        cohortId: ids.cohort,
      },
    },
    create: {
      id: ids.enrollment,
      organizationId: ids.organization,
      userId: ids.student,
      cohortId: ids.cohort,
      enrolledAt: FIXED_NOW,
    },
    update: {},
  });
  await academic.guardian.upsert({
    where: {
      organizationId_parentUserId_studentUserId: {
        organizationId: ids.organization,
        parentUserId: ids.parent,
        studentUserId: ids.student,
      },
    },
    create: {
      id: ids.guardian,
      organizationId: ids.organization,
      parentUserId: ids.parent,
      studentUserId: ids.student,
    },
    update: {},
  });
  await academic.assignment.upsert({
    where: { id: ids.assignment },
    create: {
      id: ids.assignment,
      organizationId: ids.organization,
      moduleId: ids.module,
      title: 'Даалгавар 1: Матрицын үйлдэл',
      description: 'Матрицын үржвэр ба детерминант олох бодлогууд',
      dueDate: new Date('2026-08-02T00:00:00.000Z'),
      maxPoints: 100,
    },
    update: {
      title: 'Даалгавар 1: Матрицын үйлдэл',
      dueDate: new Date('2026-08-02T00:00:00.000Z'),
      maxPoints: 100,
    },
  });
  await academic.submission.upsert({
    where: { id: ids.submission },
    create: {
      id: ids.submission,
      organizationId: ids.organization,
      assignmentId: ids.assignment,
      studentId: ids.student,
      content: 'Seed demo даалгаврын илгээсэн хариу',
      submittedAt: FIXED_NOW,
    },
    update: { content: 'Seed demo даалгаврын илгээсэн хариу', submittedAt: FIXED_NOW },
  });
  await academic.grade.upsert({
    where: { id: ids.grade },
    create: {
      id: ids.grade,
      organizationId: ids.organization,
      studentId: ids.student,
      submissionId: ids.submission,
      courseId: ids.course,
      score: 95,
      feedback: 'Маш сайн.',
      gradedAt: FIXED_NOW,
    },
    update: { courseId: ids.course, score: 95, feedback: 'Маш сайн.', gradedAt: FIXED_NOW },
  });
  await academic.attendance.upsert({
    where: { id: ids.attendance },
    create: {
      id: ids.attendance,
      organizationId: ids.organization,
      cohortId: ids.cohort,
      studentId: ids.student,
      date: FIXED_NOW,
      status: 'PRESENT',
    },
    update: { status: 'PRESENT', date: FIXED_NOW },
  });
  await academic.certificate.upsert({
    where: { id: ids.certificate },
    create: {
      id: ids.certificate,
      organizationId: ids.organization,
      studentId: ids.student,
      courseId: course.id,
      verificationCode: 'CERT-SEED-CALC-1',
      storageKey: 'org_main/certificates/calculus-student-1.pdf',
      recipientName: 'Сувд Болд',
      courseTitle: course.title,
      issuedAt: FIXED_NOW,
    },
    update: {
      verificationCode: 'CERT-SEED-CALC-1',
      storageKey: 'org_main/certificates/calculus-student-1.pdf',
      recipientName: 'Сувд Болд',
      courseTitle: course.title,
      issuedAt: FIXED_NOW,
    },
  });
  await academic.announcement.upsert({
    where: { id: ids.announcement },
    create: {
      id: ids.announcement,
      organizationId: ids.organization,
      authorId: ids.principal,
      title: 'Номын сангийн цаг',
      body: 'Мягмар, пүрэв гарагт нэмэлт цагаар нээлттэй.',
    },
    update: {
      title: 'Номын сангийн цаг',
      body: 'Мягмар, пүрэв гарагт нэмэлт цагаар нээлттэй.',
    },
  });
  await academic.auditLog.upsert({
    where: { id: ids.audit },
    create: {
      id: ids.audit,
      organizationId: ids.organization,
      userId: ids.admin,
      action: 'SEED_COMPLETED',
      entity: 'Organization',
      entityId: ids.organization,
      details: JSON.stringify({ fixtureVersion: 2 }),
      ipAddress: '127.0.0.1',
    },
    update: { details: JSON.stringify({ fixtureVersion: 2 }) },
  });
}

async function seedBilling() {
  const subscription = await billing.subscription.upsert({
    where: { organizationId: ids.organization },
    create: {
      id: ids.subscription,
      organizationId: ids.organization,
      plan: 'BASIC',
      amount: '250000.0000',
      currency: 'MNT',
      billingCycle: 'monthly',
      isActive: true,
      nextBillingAt: new Date('2026-08-29T00:00:00.000Z'),
    },
    update: {
      plan: 'BASIC',
      amount: '250000.0000',
      currency: 'MNT',
      billingCycle: 'monthly',
      isActive: true,
      nextBillingAt: new Date('2026-08-29T00:00:00.000Z'),
    },
  });
  await billing.invoice.upsert({
    where: { id: ids.invoice },
    create: {
      id: ids.invoice,
      organizationId: ids.organization,
      subscriptionId: subscription.id,
      amount: '250000.0000',
      currency: 'MNT',
      status: 'COMPLETED',
      paidAt: FIXED_NOW,
      pdfR2Url: 'https://example.test/invoices/2026-07.pdf',
    },
    update: {
      amount: '250000.0000',
      currency: 'MNT',
      status: 'COMPLETED',
      paidAt: FIXED_NOW,
    },
  });
  await billing.payment.upsert({
    where: {
      organizationId_transactionId: {
        organizationId: ids.organization,
        transactionId: 'seed-payment-2026-07',
      },
    },
    create: {
      id: ids.payment,
      organizationId: ids.organization,
      invoiceId: ids.invoice,
      amount: '250000.0000',
      currency: 'MNT',
      method: 'BANK_TRANSFER',
      transactionId: 'seed-payment-2026-07',
      status: 'COMPLETED',
      createdAt: FIXED_NOW,
    },
    update: {
      amount: '250000.0000',
      currency: 'MNT',
      status: 'COMPLETED',
    },
  });
}

async function seedNotifications() {
  const recipients = [
    { userId: ids.admin, email: 'admin@lms.mn', phone: '99112233', firstName: 'Бат-Эрдэнэ', role: 'ORG_ADMIN' },
    { userId: ids.teacher, email: 'teacher@lms.mn', phone: '99223344', firstName: 'Энхмаа', role: 'INSTRUCTOR' },
    { userId: ids.student, email: 'student@lms.mn', phone: '99334455', firstName: 'Болд', role: 'STUDENT' },
    { userId: ids.parent, email: 'parent@lms.mn', phone: '99445566', firstName: 'Оюун', role: 'PARENT' },
  ];
  for (const recipient of recipients) {
    await notification.notificationRecipient.upsert({
      where: {
        organizationId_userId: {
          organizationId: ids.organization,
          userId: recipient.userId,
        },
      },
      create: {
        organizationId: ids.organization,
        ...recipient,
      },
      update: recipient,
    });
  }

  const fixtures = [
    {
      id: ids.notificationStudent,
      userId: ids.student,
      title: 'LMS-д тавтай морил',
      body: 'Таны сургалтын орчин бэлэн боллоо.',
      idempotencyKey: 'seed:student:welcome:v1',
    },
    {
      id: ids.notificationParent,
      userId: ids.parent,
      title: 'Хүүхдийн явцын мэдээлэл',
      body: 'Шинэ дүн болон ирцийн мэдээлэл нэмэгдлээ.',
      idempotencyKey: 'seed:parent:progress:v1',
    },
  ];
  for (const fixture of fixtures) {
    const row = await notification.notification.upsert({
      where: {
        organizationId_idempotencyKey: {
          organizationId: ids.organization,
          idempotencyKey: fixture.idempotencyKey,
        },
      },
      create: {
        ...fixture,
        organizationId: ids.organization,
        type: 'IN_APP',
        eventType: 'DEVELOPMENT_FIXTURE',
        createdAt: FIXED_NOW,
      },
      update: {
        userId: fixture.userId,
        title: fixture.title,
        body: fixture.body,
        type: 'IN_APP',
        eventType: 'DEVELOPMENT_FIXTURE',
      },
    });
    await notification.notificationDelivery.upsert({
      where: {
        notificationId_channel: {
          notificationId: row.id,
          channel: 'IN_APP',
        },
      },
      create: {
        id: fixture.userId === ids.student
          ? ids.notificationStudentDelivery
          : ids.notificationParentDelivery,
        organizationId: ids.organization,
        notificationId: row.id,
        channel: 'IN_APP',
        status: 'DELIVERED',
        deliveredAt: FIXED_NOW,
      },
      update: { status: 'DELIVERED', deliveredAt: FIXED_NOW },
    });
  }
}

async function main() {
  console.log(`[seed] Applying deterministic ${runtimeEnvironment} fixtures`);
  await seedOrganizations();
  await seedUsers();
  await seedAcademic();
  await seedBilling();
  await seedNotifications();
  console.log('[seed] Fixtures are ready');
}

main()
  .catch(error => {
    console.error('[seed] Failed:', error instanceof Error ? error.message : 'unknown error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([
      auth.$disconnect(),
      academic.$disconnect(),
      organization.$disconnect(),
      billing.$disconnect(),
      notification.$disconnect(),
    ]);
  });
