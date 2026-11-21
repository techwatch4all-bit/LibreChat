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

  const cards = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(t => t.length > 5 && t.length < 250);
  });
  console.log('Cards count:', cards.length);
  console.log('Sample cards:\n', cards.slice(0, 10).join('\n---\n'));

  await browser.close();
})();
