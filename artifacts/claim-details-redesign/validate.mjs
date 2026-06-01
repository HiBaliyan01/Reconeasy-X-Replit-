import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const OUTPUT_DIR = path.resolve('artifacts/claim-details-redesign');
const BASE_URL = 'http://localhost:9092';
const CLAIM_URL = `${BASE_URL}/claims/detail?claimId=cbbbdb1c-cd04-43ef-bb86-1341319b0afe&group=${encodeURIComponent('amazon|commission')}`;
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const authPayload = JSON.stringify({ access_token: 'dev', refresh_token: 'dev', user: { id: 'test-user' } });

async function ensureDir() {
  await mkdir(OUTPUT_DIR, { recursive: true });
}

async function main() {
  await ensureDir();

  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1800 }, deviceScaleFactor: 1 });

  await page.addInitScript((payload) => {
    localStorage.setItem('sb-test-auth-token', payload);
    localStorage.setItem('sb-local-auth-token', payload);
  }, authPayload);

  const summary = {
    pipelineSubmitted: false,
    approvedFilterWorks: false,
    rejectedFilterShowsEmpty: false,
    markRecoveredVisible: false,
    recoveredTextVisible: false,
    recoveryCardUpdated: false,
    followUpTogglePresent: false,
  };

  try {
    await page.goto(CLAIM_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);

    const prepareButton = page.getByRole('button', { name: 'Prepare claim' });
    if (await prepareButton.count()) {
      await prepareButton.click();
      await page.waitForTimeout(400);
      const continueButton = page.getByRole('button', { name: 'Continue to claim text →' });
      if (await continueButton.count()) {
        await continueButton.click();
        await page.waitForTimeout(300);
      }
      const submitButton = page.getByRole('button', { name: 'Mark as submitted' });
      if (await submitButton.count()) {
        await submitButton.click();
        await page.waitForTimeout(1400);
      }
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    summary.pipelineSubmitted = await page.getByText('SUBMITTED', { exact: false }).first().isVisible().catch(() => false);

    await page.screenshot({ path: path.join(OUTPUT_DIR, 'submitted-overview.png'), fullPage: true });

    await page.getByRole('button', { name: 'Orders' }).click();
    await page.waitForTimeout(600);

    const pendingFilter = page.getByRole('button', { name: /Pending \\(/ }).first();
    await pendingFilter.click();
    await page.waitForTimeout(400);

    const pendingRow = page.locator('tbody tr').filter({ hasText: 'ORDER001' }).first();
    const approveButton = pendingRow.getByRole('button', { name: 'Approve' });
    if (await approveButton.count()) {
      await approveButton.click();
      await page.waitForTimeout(1200);
    }

    const approvedFilter = page.getByRole('button', { name: /Approved \(/ }).first();
    await approvedFilter.click();
    await page.waitForTimeout(400);
    summary.approvedFilterWorks = await page
      .locator('tbody tr')
      .filter({ hasText: 'ORDER001' })
      .first()
      .isVisible()
      .catch(() => false);

    const rejectedFilter = page.getByRole('button', { name: /Rejected \(/ }).first();
    await rejectedFilter.click();
    await page.waitForTimeout(400);
    summary.rejectedFilterShowsEmpty = await page.getByText('No orders match this filter.', { exact: true }).isVisible().catch(() => false);

    await approvedFilter.click();
    await page.waitForTimeout(400);

    const approvedRow = page.locator('tbody tr').filter({ hasText: 'ORDER001' }).first();
    summary.markRecoveredVisible = await approvedRow
      .getByRole('button', { name: 'Mark recovered' })
      .isVisible()
      .catch(() => false);
    summary.followUpTogglePresent = await page.getByRole('button', { name: /needs follow-up/i }).first().isVisible().catch(() => false);

    await page.screenshot({ path: path.join(OUTPUT_DIR, 'orders-tab-sidebar-before-recovery.png'), fullPage: true });

    const markRecoveredButton = approvedRow.getByRole('button', { name: 'Mark recovered' });
    if (await markRecoveredButton.count()) {
      await markRecoveredButton.click();
      await page.waitForTimeout(1400);
    }

    summary.recoveredTextVisible = await approvedRow
      .getByText(/Recovered ✓ on/i)
      .isVisible()
      .catch(() => false);
    summary.recoveryCardUpdated = await page.getByText('Recovered amount', { exact: true }).isVisible().catch(() => false)
      && await page.getByText('Recovered', { exact: false }).nth(1).isVisible().catch(() => false);

    await page.screenshot({ path: path.join(OUTPUT_DIR, 'orders-tab-sidebar-after-recovery.png'), fullPage: true });

    await writeFile(path.join(OUTPUT_DIR, 'validation-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Claim detail redesign validation failed:', error);
  process.exitCode = 1;
});
