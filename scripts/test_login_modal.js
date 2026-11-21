const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(2000);
  console.log('Clicking Sign in button...');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2000);
  const inputs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input')).map(e => ({ name: e.name, type: e.type, id: e.id, placeholder: e.placeholder }))
  );
  console.log('Inputs after Sign in click:', inputs);

  await page.screenshot({ path: 'login_modal.png' });
  console.log('Screenshot saved to login_modal.png');

  await browser.close();
})();
