import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.addInitScript(() => { localStorage.setItem('sb-fake-auth-token', 'ok'); localStorage.setItem('theme', 'light'); });
await page.goto('http://localhost:9092/settings', { waitUntil: 'networkidle' });

const results = {};
for (const tab of ['Integrations','Users','Reconciliation','Automation','Audit Log']) {
  await page.getByRole('button', { name: tab, exact: true }).nth(0).click();
  await page.waitForTimeout(300);
  const body = await page.locator('body').innerText();
  results[tab] = {
    breadcrumb: body.split('\n').find((text) => text.startsWith('Settings /')) || null,
    hash: await page.evaluate(() => window.location.hash),
  };
}

await page.getByRole('button', { name: 'Users', exact: true }).nth(0).click();
await page.waitForTimeout(300);
await page.reload({ waitUntil: 'networkidle' });
results['UsersRefresh'] = { hash: await page.evaluate(() => window.location.hash), body: await page.locator('body').innerText() };

await page.getByRole('button', { name: 'Automation', exact: true }).nth(0).click();
await page.waitForTimeout(300);
await page.reload({ waitUntil: 'networkidle' });
results['AutomationRefresh'] = { hash: await page.evaluate(() => window.location.hash), body: await page.locator('body').innerText() };

await page.getByRole('button', { name: 'Users', exact: true }).nth(0).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Automation', exact: true }).nth(0).click();
await page.waitForTimeout(300);
await page.goBack({ waitUntil: 'networkidle' });
results['BackButton'] = { hash: await page.evaluate(() => window.location.hash), body: await page.locator('body').innerText() };

console.log(JSON.stringify(results, null, 2));
await browser.close();
