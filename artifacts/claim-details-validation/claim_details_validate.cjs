const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1600 } });

  await page.addInitScript(() => {
    localStorage.setItem('sb-local-auth-token', JSON.stringify({ access_token: 'dev', refresh_token: 'dev' }));
  });

  // PAYMENT_NOT_RECEIVED evidence panel
  await page.goto('http://localhost:9092/claims/detail?claimId=bcc05dd9-49d7-4b64-936c-68e0221d3d5e', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.locator('text=CLAIM EVIDENCE').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/claim-details-validation/payment-evidence-panel.png', fullPage: true });

  // LOGISTICS evidence + approve + recover
  await page.goto('http://localhost:9092/claims/detail?claimId=cbbbdb1c-cd04-43ef-bb86-1341319b0afe&group=amazon%7Clogistics%7Cnational', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.locator('text=CLAIM EVIDENCE').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/claim-details-validation/logistics-evidence-panel.png', fullPage: true });

  const approveBtn = page.getByRole('button', { name: 'Mark Approved' });
  if (await approveBtn.count()) {
    await approveBtn.click();
    await page.waitForTimeout(1200);
  }

  const recoverBtn = page.getByRole('button', { name: 'Mark as recovered' });
  await recoverBtn.scrollIntoViewIfNeeded();
  await recoverBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'artifacts/claim-details-validation/mark-recovered-confirmation.png', fullPage: true });

  const confirmBtn = page.getByRole('button', { name: 'Confirm' });
  await confirmBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'artifacts/claim-details-validation/mark-recovered-success.png', fullPage: true });

  await browser.close();
  console.log('CLAIM_DETAILS_VALIDATION_DONE');
})();
