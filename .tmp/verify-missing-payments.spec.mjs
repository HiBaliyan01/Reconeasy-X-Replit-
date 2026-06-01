import { test, expect } from '@playwright/test';

test('missing payments interactions', async ({ page }) => {
  await page.goto('http://localhost:9092/reconciliation-v2', { waitUntil: 'networkidle' });
  await expect(page.getByText('Missing Payments')).toBeVisible();
  await expect(page.getByText('ORD-12345')).toBeVisible();

  const row = page.locator('tr', { hasText: 'ORD-12345' }).first();
  await row.click();

  await expect(page.getByText('Missing Payment')).toBeVisible();
  await expect(page.getByText('What we checked')).toBeVisible();
  await expect(page.getByText('test-settlement.csv')).toBeVisible();

  await page.getByRole('button', { name: 'View Order →' }).click();
  await page.waitForURL(/\/reconciliation\?subtab=orders/);

  await page.goto('http://localhost:9092/reconciliation-v2', { waitUntil: 'networkidle' });
  await expect(page.getByText('Missing Payments')).toBeVisible();
  await page.getByRole('button', { name: 'View Claim →' }).first().click();
  await page.waitForURL(/\/claims\/detail\?claimId=/);
});
