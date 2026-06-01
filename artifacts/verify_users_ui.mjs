import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1400 },
  acceptDownloads: true,
});
const page = await context.newPage();
await page.addInitScript(() => {
  localStorage.setItem('sb-fake-auth-token', 'ok');
  localStorage.setItem('theme', 'light');
});
await page.goto('http://localhost:9092/settings', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Users' }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: 'artifacts/users-table-view.png', fullPage: true });

const pageTitle = await page.locator('h1').first().textContent();
const rowCount = await page.locator('tbody tr').count();

await page.getByRole('button', { name: /Invite user/i }).click();
await page.waitForTimeout(200);
const inviteBanner = await page.locator('text=To invite a new team member').first().textContent();

const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: /^Export$/i }).click();
const download = await downloadPromise;
const downloadPath = await download.path();
const exportCsv = downloadPath ? await fs.readFile(downloadPath, 'utf8') : '';

await page.locator('input[placeholder="Search by name, email, or role"]').fill('Himanshu');
await page.waitForTimeout(250);
const filteredRowCount = await page.locator('tbody tr').count();
await page.locator('input[placeholder="Search by name, email, or role"]').fill('');

await page.locator('select').nth(1).selectOption('inactive');
await page.waitForTimeout(250);
const inactiveCountText = await page.locator('text=/Showing \d+ of \d+/').first().textContent();
await page.locator('select').nth(1).selectOption('all');

await page.locator('tbody tr').first().locator('input[type="checkbox"]').click();
await page.waitForTimeout(200);
const bulkBarText = await page.locator('text=/user\(s\) selected/').first().textContent();

await page.getByRole('button', { name: 'Grid' }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'artifacts/users-grid-view.png', fullPage: true });
const gridCards = await page.locator('text=Last active').count();

await page.getByRole('button', { name: 'Audit Log' }).click();
await page.waitForTimeout(300);
const auditLogText = await page.locator('text=Full activity trail').first().textContent();

console.log(JSON.stringify({
  pageTitle,
  rowCount,
  inviteBanner,
  exportCsv,
  filteredRowCount,
  inactiveCountText,
  bulkBarText,
  gridCards,
  auditLogText,
}, null, 2));

await browser.close();
