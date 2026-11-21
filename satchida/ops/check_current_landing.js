const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://127.0.0.1:3080/login');
  await page.click('button:has-text("Sign in")');
  await page.fill('#email', 'dchat@satchida.local');
  await page.fill('#password', 'Demo@123456');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Take screenshot of landing page as-is
  await page.screenshot({ path: 'current_user_landing.png' });
  console.log('Saved current_user_landing.png');

  // Check top left spec selector
  const specText = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="select-specs-button"], #headlessui-menu-button-1, button[aria-haspopup="menu"]');
    return el ? el.innerText : 'null';
  });
  console.log('Spec selector text:', specText);

  // Check category buttons visible
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(t => t.length > 0 && t.length < 80);
  });
  console.log('Buttons:', buttons);

  await browser.close();
})();
