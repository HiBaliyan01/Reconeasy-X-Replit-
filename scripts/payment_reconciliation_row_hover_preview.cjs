const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1100 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    localStorage.setItem('sb-local-auth-token', JSON.stringify({ access_token: 'dev', refresh_token: 'dev' }));
  });
  await page.goto('http://localhost:9092/reconciliation-v2', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'attached_assets/payment-reconciliation-row-clean.png', fullPage: true });

  const firstRow = page.locator('tbody tr').first();
  await firstRow.hover();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'attached_assets/payment-reconciliation-row-hover-preview.png', fullPage: true });

  await firstRow.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'attached_assets/payment-reconciliation-row-click-drawer.png', fullPage: true });
  await browser.close();
})();
