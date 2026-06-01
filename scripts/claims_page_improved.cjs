const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.addInitScript(() => {
    localStorage.setItem('sb-local-auth-token', JSON.stringify({ access_token: 'dev', refresh_token: 'dev' }));
  });
  await page.goto('http://localhost:9092/claims', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'attached_assets/claims-page-improved.png', fullPage: true });
  const text = await page.locator('body').innerText();
  console.log(text.includes('Auto Flagged') ? 'HAS_AUTO_FLAGGED' : 'NO_AUTO_FLAGGED');
  console.log(text.includes('Today') ? 'HAS_TODAY' : 'NO_TODAY');
  console.log(text.includes('Submit to marketplace') ? 'HAS_NEXT_ACTION' : 'NO_NEXT_ACTION');
  await browser.close();
})();
