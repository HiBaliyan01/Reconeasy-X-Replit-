const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.addInitScript(() => {
    localStorage.setItem('sb-local-auth-token', JSON.stringify({ access_token: 'dev', refresh_token: 'dev' }));
  });
  await page.goto('http://localhost:9092/reconciliation-v2', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Create Claims' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'attached_assets/claim-batch-preview-modal-final.png', fullPage: true });
  await browser.close();
})();
