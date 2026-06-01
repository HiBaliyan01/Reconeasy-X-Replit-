const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });

  await page.addInitScript(() => {
    localStorage.setItem('sb-local-auth-token', JSON.stringify({ access_token: 'dev', refresh_token: 'dev' }));
  });

  await page.goto('http://localhost:9092/claims/detail?claimId=cbbbdb1c-cd04-43ef-bb86-1341319b0afe&group=amazon%7Ccommission', {
    waitUntil: 'networkidle',
  });

  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Prepare claim' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'artifacts/prepare-claim-modal/prepare-claim-step-1.png', fullPage: true });

  await page.getByRole('button', { name: 'Continue to claim text →' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/prepare-claim-modal/prepare-claim-step-2.png', fullPage: true });

  console.log('SCREENSHOTS_CAPTURED');
  await browser.close();
})();
