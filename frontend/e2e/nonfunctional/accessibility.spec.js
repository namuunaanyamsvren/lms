import { expect, test } from '@playwright/test';
import { installCommonApi, users } from '../helpers/mockApi.js';

async function expectWcagSmoke(page) {
  await expect(page.locator('html')).toHaveAttribute('lang', /.+/);
  await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('img:not([alt])')).toHaveCount(0);

  const unnamedButtons = await page.locator('button').evaluateAll(buttons =>
    buttons
      .map((button, index) => ({
        index,
        text: button.innerText?.trim(),
        aria: button.getAttribute('aria-label'),
        title: button.getAttribute('title'),
      }))
      .filter(button => !button.text && !button.aria && !button.title),
  );
  expect(unnamedButtons).toEqual([]);
}

test('WCAG 2.1 AA smoke audit covers login and role dashboards', async ({ page, context }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Нэвтрэх' })).toBeVisible();
  await expectWcagSmoke(page);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();

  await installCommonApi(page, context, { user: users.student });
  await page.route('**/api/v1/dashboards/student', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        stats: { courses: 1, assignments: 0, exams: 0 },
        engagement: { value: '100%' },
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
  await expectWcagSmoke(page);

  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Мэдэгдэл', exact: true })).toBeVisible();
  await expectWcagSmoke(page);
});
