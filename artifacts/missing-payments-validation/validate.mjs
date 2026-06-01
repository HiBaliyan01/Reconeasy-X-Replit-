import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const OUTPUT_DIR = path.resolve("artifacts/missing-payments-validation");
const BASE_URL = process.env.PAYMENT_RECON_BASE_URL || "http://localhost:9092";
const PAGE_URL = `${BASE_URL}/reconciliation-v2`;
const executablePath =
  process.env.PLAYWRIGHT_CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const authPayload = JSON.stringify({
  access_token: "dev",
  refresh_token: "dev",
  user: { id: "test-user" },
});

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
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 1,
  });

  await page.addInitScript((payload) => {
    localStorage.setItem("sb-test-auth-token", payload);
    localStorage.setItem("sb-local-auth-token", payload);
  }, authPayload);

  try {
    await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, "post-cleanup-full.png"),
      fullPage: true,
    });

    const discrepancyTable = page.locator("table").nth(0);
    const missingPaymentsTable = page.locator("table").nth(1);

    const discrepancyHeaders = (await discrepancyTable.locator("thead th").allTextContents())
      .map((text) => text.trim())
      .filter(Boolean);
    const missingHeaders = (await missingPaymentsTable.locator("thead th").allTextContents())
      .map((text) => text.trim())
      .filter(Boolean);

    await missingPaymentsTable.screenshot({
      path: path.join(OUTPUT_DIR, "missing-payments-table.png"),
    });

    const claimCell = page.locator("#row-ORDER001 td").last();
    const claimCellText = ((await claimCell.innerText()) || "").trim();

    let claimClickUrl = null;
    let discrepancyDrawerVisibleAfterClaimClick = false;
    if (claimCellText && !claimCellText.toLowerCase().includes("create claim")) {
      await claimCell.click();
      await page.waitForTimeout(500);
      claimClickUrl = page.url();
      discrepancyDrawerVisibleAfterClaimClick = await page
        .getByText("Claim Evidence")
        .isVisible()
        .catch(() => false);
    }

    await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);

    const discrepancyRow = page.locator("#row-ORDER001");
    await discrepancyRow.click();
    await page.waitForTimeout(700);
    const discrepancyDrawerVisibleAfterRowClick = await page
      .getByText("Claim Evidence")
      .isVisible()
      .catch(() => false);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, "order-discrepancy-drawer.png"),
      fullPage: true,
    });

    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);

    const missingPaymentsRow = missingPaymentsTable.locator("tbody tr").first();
    await missingPaymentsRow.click();
    await page.waitForTimeout(700);

    const paymentDrawerVisible = await page
      .getByText("Missing Payment")
      .isVisible()
      .catch(() => false);

    const paymentDrawer = page.locator("text=Missing Payment").locator("xpath=ancestor::div[contains(@class,'fixed')][1]");
    if (await paymentDrawer.count()) {
      await paymentDrawer.screenshot({
        path: path.join(OUTPUT_DIR, "missing-payments-configured-drawer.png"),
      });
    }

    const summary = {
      page_url: PAGE_URL,
      discrepancy_headers: discrepancyHeaders,
      missing_payments_headers: missingHeaders,
      discrepancy_claim_cell_text: claimCellText,
      claim_click_url: claimClickUrl,
      discrepancy_drawer_visible_after_claim_click: discrepancyDrawerVisibleAfterClaimClick,
      discrepancy_drawer_visible_after_row_click: discrepancyDrawerVisibleAfterRowClick,
      payment_drawer_visible_after_row_click: paymentDrawerVisible,
      generated_at: new Date().toISOString(),
    };

    await writeFile(
      path.join(OUTPUT_DIR, "validation-summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8",
    );

    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "validation-failure.png"),
      fullPage: true,
    }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Validation failed:", error);
  process.exitCode = 1;
});
