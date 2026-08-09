import { Buffer } from 'node:buffer';

export const ids = {
  admin: '10000000-0000-4000-8000-000000000001',
  teacher: '10000000-0000-4000-8000-000000000002',
  student: '10000000-0000-4000-8000-000000000003',
  parent: '10000000-0000-4000-8000-000000000004',
  course: '20000000-0000-4000-8000-000000000001',
  module: '20000000-0000-4000-8000-000000000002',
  cohort: '30000000-0000-4000-8000-000000000001',
  assignment: '40000000-0000-4000-8000-000000000001',
  quiz: '50000000-0000-4000-8000-000000000001',
  attempt: '50000000-0000-4000-8000-000000000002',
  invoice: 'INV-2026-0001',
};

export const tokenFor = (userId = ids.student) => [
  Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
  'e2e',
].join('.');

export const users = {
  admin: { id: ids.admin, role: 'ORG_ADMIN', firstName: 'Админ', lastName: 'Хэрэглэгч', email: 'admin@example.test' },
  teacher: { id: ids.teacher, role: 'INSTRUCTOR', firstName: 'Болд', lastName: 'Багш', email: 'teacher@example.test' },
  student: { id: ids.student, role: 'STUDENT', firstName: 'Сараа', lastName: 'Сурагч', email: 'student@example.test' },
  parent: { id: ids.parent, role: 'PARENT', firstName: 'Эцэг', lastName: 'Эх', email: 'parent@example.test' },
};

export async function installCommonApi(page, context, { user = users.student, refreshStatus = 200 } = {}) {
  await context.addCookies([{ name: 'lms_csrf', value: 'e2e-csrf', domain: '127.0.0.1', path: '/' }]);
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '/api');
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/api/auth/refresh') {
      if (refreshStatus !== 200) return json({ success: false, message: 'expired' }, refreshStatus);
      return json({ success: true, data: { token: tokenFor(user.id) } });
    }
    if (path === '/api/auth/me') return json({ success: true, data: user });
    if (path === '/api/organizations/current') return json({ success: true, data: { id: 'org_e2e', name: 'E2E сургууль', settings: {} } });
    if (path === '/api/organizations/resolve') return json({ success: true, data: { id: 'org_e2e', slug: 'e2e-school', name: 'E2E сургууль' } });
    if (path === '/api/notifications/unread-count') return json({ success: true, data: { count: 1 } });
    if (path === '/api/notifications' && method === 'GET') return json({ success: true, data: [] });

    return route.fallback();
  });
}
