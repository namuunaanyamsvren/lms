import { expect, test } from '@playwright/test';
import { ids, installCommonApi, users } from './helpers/mockApi.js';

test('billing test-mode invoice can be issued and marked paid through mocked webhook surface', async ({ page, context }) => {
  const invoices = [{ id: ids.invoice, amount: 2500000, currency: 'MNT', status: 'PENDING', createdAt: '2026-08-05T00:00:00.000Z' }];
  await installCommonApi(page, context, { user: users.admin });
  await page.route('**/api/v1/payments', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { plan: 'BASIC', amount: 2500000, currency: 'MNT', billingCycle: 'monthly', isActive: true, nextBillingAt: '2026-09-05T00:00:00.000Z' } }),
  }));
  await page.route('**/api/v1/payments/invoices', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: invoices }) });
    }
    const payload = route.request().postDataJSON();
    invoices.unshift({ id: 'INV-2026-0002', status: 'PENDING', createdAt: new Date().toISOString(), ...payload });
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: invoices[0] }) });
  });
  await page.route('**/api/v1/payments/history', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
  await page.route(`**/api/v1/payments/invoices/${ids.invoice}/pay`, route => {
    invoices[0].status = 'COMPLETED';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: invoices[0] }) });
  });

  await page.goto('/admin/billing');
  await expect(page.getByRole('heading', { name: 'Багц ба нэхэмжлэх' })).toBeVisible();
  await expect(page.getByText('PENDING')).toBeVisible();
  await page.getByTitle('Төлөгдсөн').click();
  await expect(page.getByText(/төлөгдсөнөөр тэмдэглэгдлээ/i)).toBeVisible();
});
