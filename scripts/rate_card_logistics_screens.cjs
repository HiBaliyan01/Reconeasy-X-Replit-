const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1400 } });
  await page.addInitScript(() => {
    localStorage.setItem('sb-local-auth-token', JSON.stringify({ access_token: 'dev', refresh_token: 'dev' }));
  });
  await page.goto('http://localhost:9092/rate-cards/add?editId=2787ffa6-0e7a-4e69-a92e-922ab3829e18', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.locator('nav[aria-label="Wizard steps"] button').nth(2).click({ force: true });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'attached_assets/rate-card-logistics-step3-off.png', fullPage: true });

  const toggle = page.locator('button[aria-label="Toggle logistics fees"]');
  await toggle.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'attached_assets/rate-card-logistics-step3-on-empty.png', fullPage: true });

  const fill = async (row, min, max, zone, forward, reverse) => {
    const inputs = row.locator('input');
    await inputs.nth(0).fill(String(min));
    await inputs.nth(1).fill(String(max));
    await row.locator('select').selectOption(zone);
    await inputs.nth(2).fill(String(forward));
    await inputs.nth(3).fill(String(reverse));
  };

  const tbody = page.locator('table tbody');
  await fill(tbody.locator('tr').nth(0), 0, 500, 'national', 48, 65);
  await page.getByRole('button', { name: /Add Logistics Slab/i }).click();
  await page.waitForTimeout(200);
  await fill(tbody.locator('tr').nth(1), 501, 1000, 'national', 72, 95);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'attached_assets/rate-card-logistics-step3-two-slabs.png', fullPage: true });

  await tbody.locator('tr').nth(1).locator('input').nth(0).fill('700');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'attached_assets/rate-card-logistics-step3-gap-warning.png', fullPage: true });

  await tbody.locator('tr').nth(1).locator('input').nth(0).fill('400');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'attached_assets/rate-card-logistics-step3-overlap-error.png', fullPage: true });

  await browser.close();
})();
