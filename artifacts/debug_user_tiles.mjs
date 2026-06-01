import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.addInitScript(() => { localStorage.setItem('sb-fake-auth-token', 'ok'); localStorage.setItem('theme', 'light'); });
page.on('response', async (response) => {
  if (response.url().includes('/api/users')) {
    try {
      const json = await response.json();
      console.log('API_USERS', JSON.stringify(json));
    } catch {}
  }
});
await page.goto('http://localhost:9092/settings', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Users' }).click();
await page.waitForTimeout(1200);
const body = await page.locator('body').innerText();
console.log('BODY_START');
console.log(body);
console.log('BODY_END');
await browser.close();
