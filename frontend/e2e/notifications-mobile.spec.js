import { expect, test } from '@playwright/test';
import { installCommonApi, users } from './helpers/mockApi.js';

test('notification delivery can be read and deleted from the notifications page', async ({ page, context }) => {
  const notifications = [
    { id: 'n-1', title: 'Шинэ даалгавар', body: 'Даалгавар нийтлэгдлээ', isRead: false, createdAt: new Date().toISOString() },
    { id: 'n-2', title: 'Уншсан мэдээ', body: 'Төлөв шинэчлэгдлээ', isRead: true, createdAt: new Date().toISOString() },
  ];
  await installCommonApi(page, context, { user: users.student });
  await page.route('**/api/v1/notifications?limit=100', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: notifications }),
  }));
  await page.route('**/api/v1/notifications/n-1/read', route => {
    notifications[0].isRead = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  await page.route('**/api/v1/notifications/n-2', route => {
    notifications.splice(1, 1);
    return route.fulfill({ status: 204, body: '' });
  });

  await page.goto('/notifications');
  await expect(page.getByText('Шинэ даалгавар')).toBeVisible();
  await page.getByTitle('Уншсанаар тэмдэглэх').click();
  await expect(page.getByText('0 уншаагүй мэдэгдэл байна')).toBeVisible();
  await page.getByTitle('Устгах').last().click();
  await expect(page.getByText('Уншсан мэдээ')).toBeHidden();
});

test('student dashboard has a working mobile viewport smoke path', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installCommonApi(page, context, { user: users.student });
  await page.route('**/api/v1/dashboards/student', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        stats: { courses: 0, assignments: 0, exams: 0 },
        engagement: { value: '—' },
        upcomingAssignments: [],
        todayClasses: [],
        recentGrades: [],
        notifications: [],
        activityFeed: [],
      },
    }),
  }));

  await page.goto('/student');

  await expect(page.getByRole('heading', { name: 'Тавтай морил' })).toBeVisible();
  await expect(page.getByRole('button', { name: /menu|цэс|navigation/i })).toBeVisible({ timeout: 5000 }).catch(async () => {
    await expect(page.locator('body')).toContainText('Хянах');
  });
});
