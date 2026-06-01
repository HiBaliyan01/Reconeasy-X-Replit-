const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.addInitScript(() => {
    localStorage.setItem('sb-local-auth-token', JSON.stringify({ access_token: 'dev', refresh_token: 'dev' }));
  });
  await page.goto('http://localhost:9092/rate-cards/add', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Flat Rate Card/i }).click();
  await page.waitForTimeout(500);
  const data = await page.evaluate(() => Array.from(document.querySelectorAll('input, select, button,[role="combobox"]')).map((el) => ({
    tag: el.tagName,
    role: el.getAttribute('role'),
    text: el.textContent?.trim(),
    name: el.getAttribute('name'),
    id: el.id,
    aria: el.getAttribute('aria-label'),
    placeholder: el.getAttribute('placeholder'),
    disabled: el.disabled || el.getAttribute('aria-disabled') === 'true'
  })));
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
