/**
 * LOCAL DEV-ONLY SEED SCRIPT — never run against a production database.
 * Not wired into any start/build/docker command; run manually with:
 *   node backend/scripts/seed-dev.js
 * Seeds matching rows into both auth-service's and academic-service's schemas
 * (same org id/email per user) so every seeded account can actually log in.
 */
const bcrypt = require('bcrypt');
const { PrismaClient: AuthPrismaClient } = require('@prisma/client-auth');
const { PrismaClient: AcademicPrismaClient } = require('@prisma/client-academic');

const authPrisma = new AuthPrismaClient({
  datasources: {
    db: {
      url: process.env.AUTH_DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/lms_db?schema=auth',
    },
  },
});

const academicPrisma = new AcademicPrismaClient({
  datasources: {
    db: {
      url: process.env.ACADEMIC_DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/lms_db?schema=academic',
    },
  },
});

async function seed() {
  console.log('🌱 Starting Database Seeding for PostgreSQL...');

  const organizationId = 'org_main';
  const commonPasswordHash = await bcrypt.hash('password123', 10);

  // 1. Create Organization in Academic DB
  console.log('Building Organization...');
  await academicPrisma.organization.upsert({
    where: { slug: 'mongol-erdem' },
    update: { name: 'Монгол Эрдэм Их Сургууль' },
    create: {
      id: organizationId,
      organizationId,
      name: 'Монгол Эрдэм Их Сургууль',
      slug: 'mongol-erdem',
      domain: 'lms.mn',
    },
  });

  const usersData = [
    {
      id: 'usr_admin_1',
      email: 'admin@lms.mn',
      username: 'admin',
      phone: '99112233',
      firstName: 'Бат-Эрдэнэ',
      lastName: 'Ганболд',
      role: 'ORG_ADMIN',
    },
    {
      id: 'usr_teacher_1',
      email: 'teacher@lms.mn',
      username: 'teacher',
      phone: '99223344',
      firstName: 'Энхмаа',
      lastName: 'Дорж',
      role: 'INSTRUCTOR',
    },
    {
      id: 'usr_student_1',
      email: 'student@lms.mn',
      username: 'student',
      phone: '99334455',
      firstName: 'Болд',
      lastName: 'Сувд',
      role: 'STUDENT',
    },
    {
      id: 'usr_parent_1',
      email: 'parent@lms.mn',
      username: 'parent',
      phone: '99445566',
      firstName: 'Наранцэцэг',
      lastName: 'Болд',
      role: 'PARENT',
    },
    {
      id: 'usr_staff_1',
      email: 'staff@lms.mn',
      username: 'staff',
      phone: '99556677',
      firstName: 'Төмөр',
      lastName: 'Цогт',
      role: 'STAFF',
    },
    {
      id: 'usr_principal_1',
      email: 'principal@lms.mn',
      username: 'principal',
      phone: '99667788',
      firstName: 'Баатар',
      lastName: 'Мөнх',
      role: 'PRINCIPAL',
    },
  ];

  console.log('Seeding Users in Auth and Academic schemas...');

  for (const u of usersData) {
    // Auth DB
    const existingAuth = await authPrisma.userAccount.findFirst({
      where: { organizationId, email: u.email },
    });
    if (!existingAuth) {
      await authPrisma.userAccount.create({
        data: {
          id: u.id,
          organizationId,
          email: u.email,
          username: u.username,
          phone: u.phone,
          firstName: u.firstName,
          lastName: u.lastName,
          passwordHash: commonPasswordHash,
          role: u.role,
          isActive: true,
        },
      });
    } else {
      await authPrisma.userAccount.update({
        where: { id: existingAuth.id },
        data: {
          username: u.username,
          phone: u.phone,
          passwordHash: commonPasswordHash,
          firstName: u.firstName,
          lastName: u.lastName,
        },
      });
    }

    // Academic DB
    const existingAcademic = await academicPrisma.user.findFirst({
      where: { organizationId, email: u.email },
    });
    if (!existingAcademic) {
      await academicPrisma.user.create({
        data: {
          id: u.id,
          organizationId,
          email: u.email,
          username: u.username,
          phone: u.phone,
          firstName: u.firstName,
          lastName: u.lastName,
          passwordHash: commonPasswordHash,
          role: u.role,
        },
      });
    } else {
      await academicPrisma.user.update({
        where: { id: existingAcademic.id },
        data: {
          username: u.username,
          phone: u.phone,
          firstName: u.firstName,
          lastName: u.lastName,
          passwordHash: commonPasswordHash,
        },
      });
    }
  }

  // 2. Guardian link — lets the seeded parent account see a real child on their dashboard
  console.log('Linking parent to child (Guardian)...');
  const existingGuardian = await academicPrisma.guardian.findFirst({
    where: { organizationId, parentUserId: 'usr_parent_1', studentUserId: 'usr_student_1' },
  });
  if (!existingGuardian) {
    await academicPrisma.guardian.create({
      data: { organizationId, parentUserId: 'usr_parent_1', studentUserId: 'usr_student_1' },
    });
  }

  // 3. Courses, Modules, Lessons
  console.log('Seeding Courses and Modules...');
  const course1 = await academicPrisma.course.create({
    data: {
      organizationId,
      title: 'Calculus I (Математик шинжилгээ I)',
      description: 'Дифференциал болон интеграл тооллын үндэс',
      department: 'Mathematics',
      instructorId: 'usr_teacher_1',
      isPublished: true,
      modules: {
        create: [
          {
            organizationId,
            title: 'Нэгж 1: Лимит ба уламжлал',
            order: 1,
            lessons: {
              create: [
                { organizationId, title: 'Функцийн хязгаар', content: 'Лекц 1: Хязгаарын тодорхойлолт', order: 1 },
                { organizationId, title: 'Уламжлалын дүрмүүд', content: 'Лекц 2: Уламжлал олох аргууд', order: 2 },
              ],
            },
          },
        ],
      },
    },
  });

  await academicPrisma.course.create({
    data: {
      organizationId,
      title: 'Intro to Programming (Програмчлалын үндэс)',
      description: 'Python ба JavaScript програмчлалын суурь',
      department: 'Computer Science',
      instructorId: 'usr_teacher_1',
      isPublished: true,
      modules: {
        create: [
          {
            organizationId,
            title: 'Нэгж 1: Алгоритм ба өгөгдлийн төрөл',
            order: 1,
            lessons: {
              create: [
                { organizationId, title: 'Хувьсагчид ба нөхцөлт шалгалт', content: 'Бараа бүтээгдэхүүний логик', order: 1 },
              ],
            },
          },
        ],
      },
    },
  });

  // 4. Cohorts & Enrollments
  console.log('Seeding Cohorts & Enrollments...');
  const cohort1 = await academicPrisma.cohort.create({
    data: {
      organizationId,
      courseId: course1.id,
      name: '2026 Хаврын улирал - Group A',
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-06-30'),
    },
  });

  await academicPrisma.enrollment.create({
    data: {
      organizationId,
      userId: 'usr_student_1',
      cohortId: cohort1.id,
    },
  });

  // 5. Assignments & Submissions
  console.log('Seeding Assignments...');
  const module1 = await academicPrisma.module.findFirst({ where: { courseId: course1.id } });
  if (module1) {
    const assign1 = await academicPrisma.assignment.create({
      data: {
        organizationId,
        moduleId: module1.id,
        title: 'Assignment 1: Linear Algebra & Matrix Operation',
        description: 'Матрицын үржвэр ба детерминант олох бодлогууд',
        dueDate: new Date(Date.now() + 86400000 * 3),
        maxPoints: 100,
      },
    });

    const sub1 = await academicPrisma.submission.create({
      data: {
        organizationId,
        assignmentId: assign1.id,
        studentId: 'usr_student_1',
        content: 'Миний илгээсэн бодолт PDF',
        submittedAt: new Date(),
      },
    });

    await academicPrisma.grade.create({
      data: {
        organizationId,
        studentId: 'usr_student_1',
        submissionId: sub1.id,
        score: 95,
        feedback: 'Маш сайн бодсон байна. Оновчтой шийдэл.',
      },
    });
  }

  // 6. Quizzes
  console.log('Seeding Quizzes...');
  if (module1) {
    const quiz1 = await academicPrisma.quiz.create({
      data: {
        organizationId,
        moduleId: module1.id,
        title: 'Quiz: JS Fundamentals',
        timeLimitMins: 30,
        passingScore: 70,
        questions: {
          create: [
            {
              organizationId,
              text: 'JavaScript-д хувьсагч зарлахад аль түлхүүр үгийг ашигладаг вэ?',
              type: 'SINGLE_CHOICE',
              optionsJson: JSON.stringify(['let', 'var', 'const', 'Бусад бүгд']),
              correctAnswer: 'Бусад бүгд',
              points: 10,
            },
          ],
        },
      },
    });

    await academicPrisma.quizAttempt.create({
      data: {
        organizationId,
        quizId: quiz1.id,
        studentId: 'usr_student_1',
        score: 90,
        passed: true,
        startedAt: new Date(Date.now() - 3600000),
        completedAt: new Date(),
      },
    });
  }

  // 7. Attendance
  console.log('Seeding Attendance...');
  await academicPrisma.attendance.create({
    data: {
      organizationId,
      cohortId: cohort1.id,
      studentId: 'usr_student_1',
      date: new Date(),
      status: 'PRESENT',
    },
  });

  // 8. Notifications
  console.log('Seeding Notifications...');
  await academicPrisma.notification.createMany({
    data: [
      {
        organizationId,
        userId: 'usr_student_1',
        title: 'Prof. Энхмаагаас шинэ мэдээлэл',
        body: 'Математик шинжилгээ I хичээлийн дүн системд орлоо.',
      },
      {
        organizationId,
        userId: 'usr_student_1',
        title: 'Шалгалтын тов гарагдлаа',
        body: 'Ирэх 7 хоногийн Даваа гарагт JS Fundamentals шалгалттай.',
      },
      {
        organizationId,
        userId: 'usr_parent_1',
        title: 'Ms. Bilegt-ээс шинэ мэдэгдэл',
        body: 'Erdene хичээлдээ идэвхтэй оролцож байна.',
      },
    ],
  });

  // 9. Announcements (org-wide broadcast — Staff/Principal/Parent dashboards)
  console.log('Seeding Announcements...');
  await academicPrisma.announcement.createMany({
    data: [
      {
        organizationId,
        authorId: 'usr_staff_1',
        title: 'Зун амралтын хуваарь',
        body: 'Сургууль 8 сарын 1-нд хаагдаж, 8 сарын 15-нд нээгдэнэ.',
      },
      {
        organizationId,
        authorId: 'usr_staff_1',
        title: 'Номын сангийн цаг',
        body: 'Мягмар, пүрэв гарагт нэмэлт цагаар нээлттэй.',
      },
    ],
  });

  // 10. Document & Scholarship requests (Staff dashboard)
  console.log('Seeding Document & Scholarship requests...');
  await academicPrisma.documentRequest.create({
    data: {
      organizationId,
      studentId: 'usr_student_1',
      title: 'Transcript Request',
      status: 'PENDING',
    },
  });

  await academicPrisma.scholarshipRequest.create({
    data: {
      organizationId,
      studentId: 'usr_student_1',
      program: 'STEM Excellence',
      status: 'NEW',
    },
  });

  console.log('✅ Seeding completed successfully!');
  console.log('\n--- Test User Credentials ---');
  console.log('Admin:     admin@lms.mn / admin / 99112233 | password: password123');
  console.log('Teacher:   teacher@lms.mn / teacher / 99223344 | password: password123');
  console.log('Student:   student@lms.mn / student / 99334455 | password: password123');
  console.log('Parent:    parent@lms.mn / parent / 99445566 | password: password123');
  console.log('Staff:     staff@lms.mn / staff / 99556677 | password: password123');
  console.log('Principal: principal@lms.mn / principal / 99667788 | password: password123');
}

seed()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await authPrisma.$disconnect();
    await academicPrisma.$disconnect();
  });
