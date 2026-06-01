const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.addInitScript(() => {
    localStorage.setItem('sb-local-auth-token', JSON.stringify({ access_token: 'dev', refresh_token: 'dev' }));
  });
  await page.goto('http://localhost:9092/claims', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'attached_assets/claims-page-grouped.png', fullPage: true });
  const text = await page.locator('body').innerText();
  console.log(text.includes('Auto Flagged') ? 'HAS_AUTO_FLAGGED' : 'NO_AUTO_FLAGGED');
  const ageMatch = text.match(/\b\d+ day\b|\b\d+ days\b/g);
  console.log(JSON.stringify(ageMatch || []));
  await browser.close();
})();
