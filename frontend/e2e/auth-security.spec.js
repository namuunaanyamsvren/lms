import { expect, test } from '@playwright/test';
import { installCommonApi, tokenFor, users } from './helpers/mockApi.js';

test('organization onboarding redirects to admin login, then admin can sign in', async ({ page, context }) => {
  await installCommonApi(page, context, { user: users.admin });
  await page.route('**/api/v1/organizations/onboard', route => route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { id: 'org_e2e', slug: 'e2e-school' } }),
  }));
  await page.route('**/api/v1/organizations/resolve?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { data: { id: 'org_e2e', slug: 'e2e-school', name: 'E2E сургууль' } } }),
  }));
  await page.route('**/api/v1/auth/login', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { token: tokenFor(users.admin.id) } }),
  }));

  await page.goto('/onboard');
  await page.getByLabel('Байгууллагын нэр').fill('E2E сургууль');
  await page.getByLabel('Tenant slug').fill('e2e-school');
  await page.getByLabel('Админы нэр').fill('Админ');
  await page.getByLabel('Админы овог').fill('Хэрэглэгч');
  await page.getByLabel('Админы и-мэйл').fill('admin@example.test');
  await page.getByLabel('Админы нууц үг').fill('Correct horse battery staple 47');
  await page.getByRole('button', { name: 'Байгууллага үүсгэх' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole('textbox', { name: 'school-name' }).fill('e2e-school');
  await page.getByLabel('И-мэйл хаяг').fill('admin@example.test');
  await page.getByLabel('Нууц үг').fill('Correct horse battery staple 47');
  await page.getByRole('button', { name: 'Нэвтрэх' }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test('cross-role access is blocked before tenant data is shown', async ({ page, context }) => {
  await installCommonApi(page, context, { user: users.student });

  await page.goto('/teacher');

  await expect(page).toHaveURL(/\/403$/);
  await expect(page.getByText('Хандах эрх хүрэлцэхгүй')).toBeVisible();
});

test('expired refresh session recovers by returning the user to login', async ({ page, context }) => {
  await installCommonApi(page, context, { user: users.student, refreshStatus: 401 });

  await page.goto('/student');

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Нэвтрэх' })).toBeVisible();
});
