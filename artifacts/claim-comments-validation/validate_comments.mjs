import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const OUTPUT_DIR = path.resolve('artifacts/claim-comments-validation');
const BASE_URL = process.env.CLAIM_COMMENTS_BASE_URL || 'http://localhost:9092';
const CLAIM_ID = process.env.CLAIM_COMMENTS_CLAIM_ID || 'bcc05dd9-49d7-4b64-936c-68e0221d3d5e';
const PAGE_URL = `${BASE_URL}/claims/detail?claimId=${CLAIM_ID}`;
const executablePath =
  process.env.PLAYWRIGHT_CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const authPayload = JSON.stringify({
  access_token: 'dev',
  refresh_token: 'dev',
  user: { id: 'test-user' },
});

const successText = `UI persistence validation comment ${Date.now()}`;
const failureText = `UI rollback validation comment ${Date.now() + 1}`;

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function main() {
  await ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({
    headless: true,
    executablePath,
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 1400 },
    deviceScaleFactor: 1,
  });

  await page.addInitScript((payload) => {
    localStorage.setItem('sb-test-auth-token', payload);
    localStorage.setItem('sb-local-auth-token', payload);
  }, authPayload);

  await page.route('**/api/claims/*/comments', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    const postData = route.request().postData() || '';

    if (postData.includes(successText)) {
      const response = await route.fetch();
      await page.waitForTimeout(1200);
      await route.fulfill({ response });
      return;
    }

    if (postData.includes(failureText)) {
      await page.waitForTimeout(500);
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forced validation failure' }),
      });
      return;
    }

    await route.continue();
  });

  try {
    await page.goto(PAGE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);

    const commentsSection = page.getByRole('heading', { name: 'Comments & Activity' });
    await commentsSection.scrollIntoViewIfNeeded();

    const textarea = page.locator('textarea[placeholder*="Add a comment"]');
    const postButton = page.getByRole('button', { name: 'Post Comment' });
    const initiallyDisabled = await postButton.isDisabled();

    await textarea.fill(successText);
    await page.getByRole('button', { name: 'Post Comment' }).click();
    await page.waitForTimeout(200);

    const optimisticVisible = await page.getByText(successText, { exact: false }).isVisible();
    const postingVisible = await page.getByRole('button', { name: 'Posting...' }).isVisible();

    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'comment-optimistic.png'),
      fullPage: true,
    });

    await page.waitForSelector('text=' + successText, { timeout: 5000 });
    await page.waitForTimeout(1500);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await commentsSection.scrollIntoViewIfNeeded();

    const persistedVisible = await page.getByText(successText, { exact: false }).isVisible();

    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'comment-persisted-after-refresh.png'),
      fullPage: true,
    });

    await textarea.fill(failureText);
    await page.getByRole('button', { name: 'Post Comment' }).click();
    await page.waitForTimeout(150);

    const failureOptimisticVisible = await page.getByText(failureText, { exact: false }).isVisible();

    await page.waitForTimeout(1200);

    const failureErrorVisible = await page
      .getByText('Failed to post comment. Please try again.', { exact: true })
      .isVisible();
    const failureRestoredText = await textarea.inputValue();
    const failureStillVisible = await page
      .locator('div.rounded-lg.border p')
      .filter({ hasText: failureText })
      .count();

    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'comment-failure-inline-error.png'),
      fullPage: true,
    });

    const summary = {
      page_url: PAGE_URL,
      initially_disabled: initiallyDisabled,
      optimistic_visible: optimisticVisible,
      posting_visible: postingVisible,
      persisted_visible_after_refresh: persistedVisible,
      failure_optimistic_visible: failureOptimisticVisible,
      failure_error_visible: failureErrorVisible,
      failure_restored_text: failureRestoredText,
      failure_comment_still_rendered_count: failureStillVisible,
      success_text: successText,
      failure_text: failureText,
      generated_at: new Date().toISOString(),
    };

    await writeFile(
      path.join(OUTPUT_DIR, 'validation-summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
      'utf8',
    );

    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'validation-failure.png'),
      fullPage: true,
    }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Comment validation failed:', error);
  process.exitCode = 1;
});
