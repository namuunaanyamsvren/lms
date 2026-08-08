import { expect, test } from '@playwright/test';
import { ids, installCommonApi, users } from './helpers/mockApi.js';

test('admin can invite teacher and student in mocked user-management flow', async ({ page, context }) => {
  const created = [];
  await installCommonApi(page, context, { user: users.admin });
  await page.route('**/api/v1/users?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: created, pagination: { page: 1, totalPages: 1, total: created.length } }),
  }));
  await page.route('**/api/v1/users', async route => {
    created.push({ id: `u-${created.length + 1}`, status: 'INVITED', ...route.request().postDataJSON() });
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: created.at(-1) }) });
  });

  await page.goto('/admin/users');
  for (const invite of [
    { email: 'teacher@example.test', firstName: 'Болд', lastName: 'Багш', role: 'INSTRUCTOR' },
    { email: 'student@example.test', firstName: 'Сараа', lastName: 'Сурагч', role: 'STUDENT', studentId: 'STU-E2E-001' },
  ]) {
    await page.locator('button').filter({ hasText: 'Хэрэглэгч урих' }).click();
    await page.locator('input[type="email"]').fill(invite.email);
    await page.locator('input').nth(2).fill(invite.firstName);
    await page.locator('input').nth(3).fill(invite.lastName);
    await page.locator('select').nth(2).selectOption(invite.role);
    if (invite.studentId) await page.locator('input').nth(4).fill(invite.studentId);
    await page.getByRole('button', { name: /Урих|Хадгалах|Үүсгэх/ }).last().click();
  }

  await expect(page.getByText('teacher@example.test')).toBeVisible();
  await expect(page.getByText('student@example.test')).toBeVisible();
});

test('teacher can enroll a student into a cohort', async ({ page, context }) => {
  const cohort = {
    id: ids.cohort,
    name: '2026 намар А',
    course: { title: 'Математик' },
    enrollments: [],
  };
  await installCommonApi(page, context, { user: users.teacher });
  await page.route('**/api/v1/cohorts', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [cohort] }) }));
  await page.route('**/api/v1/courses?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [{ id: ids.course, title: 'Математик' }] } }) }));
  await page.route('**/api/v1/students/available', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [users.student] }) }));
  await page.route(`**/api/v1/cohorts/${ids.cohort}/enrollments`, async route => {
    cohort.enrollments.push({ id: 'enrollment-1', userId: ids.student, user: users.student });
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });

  await page.goto('/teacher/cohorts');
  await page.getByText('2026 намар А').click();
  await page.locator('select').filter({ hasText: 'Шинэ сурагч сонгох' }).selectOption(ids.student);
  await page.getByRole('button', { name: /Нэмэх/ }).click();
  await expect(page.getByText(/Сурагч ангид бүртгэгдлээ/)).toBeVisible();
});

test('teacher assignment page can create an assignment and keep it visible', async ({ page, context }) => {
  const assignments = [];
  await installCommonApi(page, context, { user: users.teacher });
  await page.route('**/api/v1/assignments', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: assignments }) });
    }
    const payload = route.request().postDataJSON();
    assignments.push({ id: ids.assignment, ...payload, dueDate: payload.dueDate, maxPoints: payload.maxPoints });
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: assignments[0] }) });
  });
  await page.route('**/api/v1/courses?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [{ id: ids.course, title: 'Математик' }] } }) }));
  await page.route(`**/api/v1/courses/${ids.course}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { id: ids.course, title: 'Математик', modules: [{ id: ids.module, title: 'Алгебр' }] } }),
  }));

  await page.goto('/teacher/assignments');
  await page.locator('button').filter({ hasText: 'Даалгавар үүсгэх' }).click();
  await page.locator('select').nth(0).selectOption(ids.course);
  await expect(page.locator('select').nth(1)).toContainText('Алгебр');
  await page.locator('select').nth(1).selectOption(ids.module);
  await page.locator('input').nth(0).fill('E2E даалгавар');
  await page.locator('textarea').fill('Сурагч илгээх даалгавар');
  await page.locator('input[type="datetime-local"]').fill('2026-08-20T10:00');
  await page.locator('input[type="number"]').fill('100');
  await page.getByRole('button', { name: 'Хадгалах' }).click();
  await expect(page.getByText('E2E даалгавар')).toBeVisible();
});

test('student submits assignment, teacher grades it, and student sees the grade', async ({ browser }) => {
  test.setTimeout(60_000);
  const assignment = {
    id: ids.assignment,
    title: 'E2E үнэлгээтэй даалгавар',
    description: 'Илгээж дүгнүүлэх даалгавар',
    dueDate: '2026-08-20T10:00:00.000Z',
    maxPoints: 100,
    module: { title: 'Алгебр', course: { title: 'Математик' } },
  };
  const submissions = [];

  const installAssignmentApi = async (page, context, user) => {
    await installCommonApi(page, context, { user });
    await page.route('**/api/v1/assignments', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [assignment] }),
    }));
    await page.route(`**/api/v1/assignments/${ids.assignment}/submissions`, route => {
      const created = {
        id: 'submission-1',
        assignmentId: ids.assignment,
        studentId: ids.student,
        student: users.student,
        assignment,
        status: 'DRAFT',
        content: '',
        fileUrl: '',
        isLatest: true,
        attemptNumber: 1,
        submittedAt: new Date().toISOString(),
        attachments: [],
        grades: [],
      };
      submissions.splice(0, submissions.length, created);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: created }) });
    });
    await page.route('**/api/v1/submissions', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: submissions }),
    }));
    await page.route('**/api/v1/submissions/submission-1', route => {
      Object.assign(submissions[0], route.request().postDataJSON(), { submittedAt: new Date().toISOString() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: submissions[0] }) });
    });
    await page.route('**/api/v1/submissions/submission-1/grades', route => {
      const grade = { id: 'grade-1', submissionId: 'submission-1', score: route.request().postDataJSON().score, feedback: route.request().postDataJSON().feedback };
      submissions[0].grades = [grade];
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: grade }) });
    });
  };

  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await installAssignmentApi(studentPage, studentContext, users.student);
  await studentPage.goto('/student/assignments');
  await studentPage.getByText('E2E үнэлгээтэй даалгавар').click();
  await studentPage.getByRole('button', { name: 'Хариулт бэлтгэж эхлэх' }).click();
  await expect(studentPage.getByPlaceholder('Даалгаврын хариултаа энд бичнэ үү...')).toBeVisible();
  await studentPage.getByPlaceholder('Даалгаврын хариултаа энд бичнэ үү...').fill('Бодлогын хариу: 42');
  await studentPage.getByRole('button', { name: 'Илгээх' }).click();
  await expect(studentPage.getByText(/Даалгавар амжилттай илгээгдлээ/)).toBeVisible();
  await studentContext.close();

  const teacherContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();
  await installAssignmentApi(teacherPage, teacherContext, users.teacher);
  await teacherPage.goto('/teacher/grading');
  await expect(teacherPage.getByText('Бодлогын хариу: 42')).toBeVisible();
  await teacherPage.getByRole('spinbutton').fill('95');
  await teacherPage.getByRole('textbox').fill('Маш сайн');
  await teacherPage.getByRole('button', { name: 'Дүгнэх' }).click();
  await expect(teacherPage.getByText(/Дүн амжилттай нийтлэгдлээ/)).toBeVisible();
  await teacherContext.close();

  const gradedStudentContext = await browser.newContext();
  const gradedStudentPage = await gradedStudentContext.newPage();
  await installAssignmentApi(gradedStudentPage, gradedStudentContext, users.student);
  await gradedStudentPage.goto('/student/assignments');
  await expect(gradedStudentPage.getByText(/Дүгнэгдсэн: 95\/100/)).toBeVisible();
  await gradedStudentPage.getByText('E2E үнэлгээтэй даалгавар').click();
  await expect(gradedStudentPage.getByText(/Оноо: 95\/100/)).toBeVisible();
  await expect(gradedStudentPage.getByText(/Маш сайн/)).toBeVisible();
  await gradedStudentContext.close();
});

test('student quiz attempt can be started, answered, and submitted', async ({ page, context }) => {
  await installCommonApi(page, context, { user: users.student });
  await page.route('**/api/v1/quizzes', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [{ id: ids.quiz, title: 'E2E шалгалт', timeLimitMins: 10, maxAttempts: 1, module: { course: { title: 'Математик' } }, _count: { questionLinks: 1 } }] }),
  }));
  await page.route(`**/api/v1/quizzes/${ids.quiz}/attempts/me`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
  await page.route(`**/api/v1/quizzes/${ids.quiz}/attempts`, route => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: ids.attempt } }) }));
  await page.route(`**/api/v1/quiz-attempts/${ids.attempt}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { id: ids.attempt, answers: [], quiz: { title: 'E2E шалгалт', questions: [{ id: 'q-1', text: '2+2?', type: 'SINGLE_CHOICE', points: 1, options: [{ id: 'a', text: '4' }, { id: 'b', text: '5' }] }] } } }),
  }));
  await page.route(`**/api/v1/quiz-attempts/${ids.attempt}/answers/q-1`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }));
  await page.route(`**/api/v1/quiz-attempts/${ids.attempt}/submit`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { score: 100 } }) }));

  await page.goto('/student/quizzes');
  await page.getByRole('button', { name: /Эхлэх/ }).click();
  await expect(page.getByRole('heading', { name: 'E2E шалгалт' })).toBeVisible();
  await page.getByLabel('4').check();
  await page.getByRole('button', { name: /Илгээх/ }).click();
  await page.getByRole('button', { name: 'Тийм' }).click();
  await expect(page).toHaveURL(/\/student\/quizzes$/);
});

test('attendance route lets parent see linked child attendance', async ({ page, context }) => {
  await installCommonApi(page, context, { user: users.parent });
  await page.route('**/api/v1/guardians?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [{ id: 'guardian-link-1', status: 'APPROVED', permissions: ['VIEW_ATTENDANCE'], studentUser: users.student }] }),
  }));
  await page.route('**/api/v1/dashboards/parent**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { children: [users.student], attendance: [{ id: 'att-1', studentId: ids.student, status: 'PRESENT', date: '2026-08-05T00:00:00.000Z' }] } }),
  }));
  await page.route('**/api/v1/attendance**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [{ id: 'att-1', status: 'PRESENT', date: '2026-08-05T00:00:00.000Z', student: users.student }] }),
  }));

  await page.goto('/parent/attendance');
  await expect(page.locator('body')).toContainText(/PRESENT|Ирсэн|Сараа/);
});
