const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('#email');
  await page.fill('#email', 'dchat@satchida.local');
  await page.fill('#password', 'Demo@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  await page.screenshot({ path: 'dchat_current_view.png' });
  console.log('Saved dchat_current_view.png');
  await browser.close();
})();
