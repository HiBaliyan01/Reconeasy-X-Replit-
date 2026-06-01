const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    localStorage.setItem('sb-local-auth-token', JSON.stringify({ access_token: 'dev', refresh_token: 'dev' }));
  });
  await page.goto('http://localhost:9092/reconciliation-v2', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  const discrepancyText = page.locator('tbody tr').first().locator('td').nth(4).locator('span').first();
  await discrepancyText.hover();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'attached_assets/payment-reconciliation-tooltip-centered.png', fullPage: true });
  await browser.close();
})();
