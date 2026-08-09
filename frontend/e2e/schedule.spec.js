import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

const ids = {
  course: '11111111-1111-4111-8111-111111111111',
  term: '22222222-2222-4222-8222-222222222222',
  room: '33333333-3333-4333-8333-333333333333',
  schedule: '44444444-4444-4444-8444-444444444444',
  teacher: '55555555-5555-4555-8555-555555555555',
};
const accessToken = [
  Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: ids.teacher, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
  'e2e',
].join('.');

const options = {
  timezone: 'Asia/Ulaanbaatar',
  courses: [{ id: ids.course, code: 'MATH101', title: 'Математик', instructorId: ids.teacher }],
  terms: [{ id: ids.term, code: '2026-FALL', name: 'Намрын улирал', startDate: '2026-08-20T00:00:00.000Z', endDate: '2026-12-20T00:00:00.000Z', status: 'ACTIVE' }],
  rooms: [{ id: ids.room, code: '201', name: 'Лекцийн танхим', building: { name: 'А байр', campus: { name: 'Төв кампус' } } }],
  teachers: [],
  children: [],
};

const withRelations = input => ({
  ...input,
  organizationId: 'org_1',
  teacherId: ids.teacher,
  semester: '2026-FALL',
  course: { id: ids.course, code: 'MATH101', title: 'Математик', department: 'ШУС' },
  teacher: { id: ids.teacher, firstName: 'Болд', lastName: 'Багш', email: 'teacher@example.com' },
  term: options.terms[0],
  roomRelation: options.rooms[0],
});

test('teacher can list, create, edit, switch calendar, and delete a schedule', async ({ page, context }) => {
  let schedules = [withRelations({
    id: ids.schedule,
    courseId: ids.course,
    termId: ids.term,
    roomId: ids.room,
    title: 'Математикийн лекц',
    dayOfWeek: 'MONDAY',
    startTime: '09:00',
    endTime: '10:30',
    room: 'Лекцийн танхим',
  })];

  await context.addCookies([{ name: 'lms_csrf', value: 'e2e-csrf', domain: '127.0.0.1', path: '/' }]);
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '/api');
    const method = request.method();
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/api/auth/refresh') return json({ success: true, data: { token: accessToken } });
    if (path === '/api/auth/me') return json({ success: true, data: { id: ids.teacher, role: 'INSTRUCTOR', firstName: 'Болд', lastName: 'Багш', email: 'teacher@example.com' } });
    if (path === '/api/organizations/current') return json({ success: true, data: { id: 'org_1', name: 'E2E сургууль', settings: {} } });
    if (path === '/api/notifications') return json({ success: true, data: [] });
    if (path === '/api/schedules/options') return json({ success: true, data: options });
    if (path === '/api/schedules' && method === 'GET') return json({ success: true, data: schedules, meta: { timezone: options.timezone } });
    if (path === '/api/schedules' && method === 'POST') {
      const payload = request.postDataJSON();
      const created = withRelations({ ...payload, id: ids.schedule, semester: '2026-FALL', room: 'Лекцийн танхим' });
      schedules = [created];
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: created }) });
    }
    if (path === `/api/schedules/${ids.schedule}` && method === 'GET') return json({ success: true, data: schedules[0] });
    if (path === `/api/schedules/${ids.schedule}` && method === 'PUT') {
      schedules = [withRelations({ ...schedules[0], ...request.postDataJSON() })];
      return json({ success: true, data: schedules[0] });
    }
    if (path === `/api/schedules/${ids.schedule}` && method === 'DELETE') {
      schedules = [];
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: `Unhandled ${method} ${path}` }) });
  });

  await page.goto('/teacher/schedules');
  await expect(page.getByRole('heading', { name: 'Хичээлийн хуваарь' })).toBeVisible();
  await expect(page.getByText('Математикийн лекц').first()).toBeVisible();

  await page.getByRole('button', { name: '7 хоног' }).click();
  await expect(page.getByRole('region', { name: 'Хуваарийн харагдац' })).toContainText('Даваа');

  await page.getByRole('button', { name: 'Хуваарь нэмэх' }).click();
  await expect(page.getByRole('heading', { name: 'Шинэ хуваарь' })).toBeVisible();
  await page.getByLabel('Хичээл', { exact: true }).selectOption(ids.course);
  await page.getByLabel('Гарчиг').fill('Шинэ семинар');
  await page.getByLabel('Семестр').selectOption(ids.term);
  await page.getByLabel('Өрөө').selectOption(ids.room);
  await page.getByRole('button', { name: 'Хадгалах' }).click();
  await expect(page).toHaveURL(/\/teacher\/schedules$/);
  await expect(page.getByText('Шинэ семинар').first()).toBeVisible();

  await page.getByRole('button', { name: 'Шинэ семинар засах' }).click();
  await expect(page.getByRole('heading', { name: 'Хуваарь засах' })).toBeVisible();
  await page.getByLabel('Гарчиг').fill('Зассан семинар');
  await page.getByRole('button', { name: 'Хадгалах' }).click();
  await expect(page.getByText('Зассан семинар').first()).toBeVisible();

  await page.getByRole('button', { name: 'Зассан семинар устгах' }).click();
  await expect(page.getByRole('dialog', { name: 'Хуваарь устгах уу?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Устгах' }).click();
  await expect(page.getByText('Хуваарь олдсонгүй')).toBeVisible();
});

test('teacher schedule create is visible to the enrolled student', async ({ browser }) => {
  const schedules = [];
  const installScheduleApi = async (page, context, role = 'INSTRUCTOR') => {
    await context.addCookies([{ name: 'lms_csrf', value: 'e2e-csrf', domain: '127.0.0.1', path: '/' }]);
    await page.route('**/api/v1/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api\/v1/, '/api');
      const method = request.method();
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/auth/refresh') return json({ success: true, data: { token: accessToken } });
      if (path === '/api/auth/me') return json({ success: true, data: { id: ids.teacher, role, firstName: 'Болд', lastName: 'Багш', email: `${role.toLowerCase()}@example.test` } });
      if (path === '/api/organizations/current') return json({ success: true, data: { id: 'org_1', name: 'E2E сургууль', settings: {} } });
      if (path === '/api/notifications') return json({ success: true, data: [] });
      if (path === '/api/notifications/unread-count') return json({ success: true, data: { count: 0 } });
      if (path === '/api/schedules/options') return json({ success: true, data: options });
      if (path === '/api/schedules' && method === 'GET') return json({ success: true, data: schedules, meta: { timezone: options.timezone } });
      if (path === '/api/schedules/me' && method === 'GET') return json({ success: true, data: schedules, meta: { timezone: options.timezone } });
      if (path === '/api/schedules' && method === 'POST') {
        const created = withRelations({ ...request.postDataJSON(), id: ids.schedule, room: 'Лекцийн танхим' });
        schedules.splice(0, schedules.length, created);
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: created }) });
      }
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: `Unhandled ${method} ${path}` }) });
    });
  };

  const teacherContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();
  await installScheduleApi(teacherPage, teacherContext, 'INSTRUCTOR');
  await teacherPage.goto('/teacher/schedules');
  await teacherPage.getByRole('button', { name: 'Хуваарь нэмэх', exact: true }).click();
  await expect(teacherPage.getByRole('heading', { name: 'Шинэ хуваарь' })).toBeVisible();
  await teacherPage.getByLabel('Хичээл', { exact: true }).selectOption(ids.course);
  await teacherPage.getByLabel('Гарчиг').fill('Оюутанд харагдах семинар');
  await teacherPage.getByLabel('Семестр').selectOption(ids.term);
  await teacherPage.getByLabel('Өрөө').selectOption(ids.room);
  await teacherPage.getByRole('button', { name: 'Хадгалах' }).click();
  await expect(teacherPage).toHaveURL(/\/teacher\/schedules$/);
  await expect(teacherPage.getByText('Оюутанд харагдах семинар').first()).toBeVisible();
  await teacherContext.close();

  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await installScheduleApi(studentPage, studentContext, 'STUDENT');
  await studentPage.goto('/student/schedules');
  await expect(studentPage.getByRole('heading', { name: 'Миний хуваарь' })).toBeVisible();
  await expect(studentPage.getByText('Оюутанд харагдах семинар').first()).toBeVisible();
  await studentContext.close();
});
