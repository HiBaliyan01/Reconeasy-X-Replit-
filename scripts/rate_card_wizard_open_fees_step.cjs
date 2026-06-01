const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });
  await page.addInitScript(() => {
    localStorage.setItem('sb-local-auth-token', JSON.stringify({ access_token: 'dev', refresh_token: 'dev' }));
  });
  await page.goto('http://localhost:9092/rate-cards/add?editId=2787ffa6-0e7a-4e69-a92e-922ab3829e18', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /3Fees & Deductions/i }).click();
  await page.waitForTimeout(1000);
  console.log((await page.locator('body').innerText()).slice(0, 8000));
  await page.screenshot({ path: 'attached_assets/rate-card-logistics-step3-off.png', fullPage: true });
  await browser.close();
})();
