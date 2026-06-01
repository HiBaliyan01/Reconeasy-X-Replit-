const { chromium } = require('playwright');
const path = require('path');
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto('http://127.0.0.1:9092', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('sb-qjcxdydxytfnsaasenoa-auth-token', JSON.stringify({
      access_token: 'local-dev-token',
      refresh_token: 'local-dev-refresh',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now()/1000) + 3600,
      user: { id: '1935f074-7acd-4799-8090-1f8cb085d1a4', email: 'hbaliyan11@gmail.com' }
    }));
    localStorage.setItem('userSession', JSON.stringify({
      user: { id: '1935f074-7acd-4799-8090-1f8cb085d1a4', email: 'hbaliyan11@gmail.com', full_name: 'Himanshu Baliyan' }
    }));
  });
  await page.goto('http://127.0.0.1:9092/reconciliation', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(process.cwd(),'artifacts','data-hub-payments-tab.png'), fullPage: true });
  const tabs = [
    ['Returns', 'data-hub-returns-tab.png'],
    ['Settlements', 'data-hub-settlements-tab.png'],
    ['Orders', 'data-hub-orders-tab.png'],
    ['Projected Income', 'data-hub-projected-income-tab.png'],
  ];
  for (const [label, file] of tabs) {
    await page.getByRole('button', { name: label }).click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(process.cwd(),'artifacts',file), fullPage: true });
  }
  await browser.close();
})();
