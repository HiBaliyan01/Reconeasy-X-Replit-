import { test, expect } from '@playwright/test';

test('header fixes and search highlight', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sb-test-auth-token', 'test');
    localStorage.setItem('userSession', JSON.stringify({
      user: { id: '1935f074-7acd-4799-8090-1f8cb085d1a4' }
    }));
  });

  await page.goto('http://127.0.0.1:9092/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const chatbotTrigger = page.getByRole('button', { name: /open reconeasy assistant/i });
  await expect(chatbotTrigger).toBeVisible();
  await expect(page.getByText('Ask ReconEasy')).toBeVisible();
  await page.screenshot({ path: 'artifacts/chatbot-trigger-distinct.png', fullPage: true });

  const bellButton = page.locator('header button').filter({ has: page.locator('svg.lucide-bell') }).first();
  await bellButton.click();
  await expect(page.getByText('No new notifications')).toBeVisible();

  const userMenuButton = page.locator('header button').filter({ has: page.locator('svg.lucide-chevron-down') }).first();
  await userMenuButton.click();
  await expect(page.getByText('No new notifications')).toHaveCount(0);
  await expect(page.getByText('Himanshu Baliyan')).toBeVisible();
  await expect(page.getByText('hbaliyan11@gmail.com')).toBeVisible();
  await expect(userMenuButton.locator('div').first()).toHaveText('H');
  await page.screenshot({ path: 'artifacts/header-user-menu-correct-user.png', fullPage: false });

  await userMenuButton.click();
  await bellButton.click();
  await expect(page.getByText('Himanshu Baliyan')).toHaveCount(0);

  const searchInput = page.locator('#global-search');
  await searchInput.fill('ORDER001');
  await page.waitForTimeout(900);
  const orderResult = page.getByRole('button', { name: /ORDER001/ }).first();
  await expect(orderResult).toBeVisible();
  await orderResult.click();

  await page.waitForURL('**/reconciliation-v2');
  await page.waitForTimeout(2500);
  const highlightedRow = page.locator('[data-search-order-id="ORDER001"]').first();
  await expect(highlightedRow).toBeVisible();
  await expect(highlightedRow).toHaveClass(/bg-teal-50/);
  await page.screenshot({ path: 'artifacts/payment-reconciliation-search-highlight.png', fullPage: true });

  await page.waitForTimeout(3500);
  await expect(highlightedRow).not.toHaveClass(/bg-teal-50/);
});
