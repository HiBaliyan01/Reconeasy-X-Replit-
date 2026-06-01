import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.addInitScript(() => {
  localStorage.setItem('sb-fake-auth-token', 'ok');
  localStorage.setItem('theme', 'light');
});
await page.goto('http://localhost:9092/settings', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Users' }).click();
await page.waitForTimeout(1000);
const bodyText = await page.locator('body').innerText();
const hasName = bodyText.includes('Himanshu Baliyan');
const hasOperations = bodyText.includes('Operations');
const lastLoginDashCount = (bodyText.match(/—/g) || []).length;
await page.screenshot({ path: 'artifacts/users-page.png', fullPage: true });
console.log(JSON.stringify({ hasName, hasOperations, lastLoginDashCount }, null, 2));
await browser.close();
