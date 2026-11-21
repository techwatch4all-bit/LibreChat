const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(2000);
  const signInBtn = await page.$('button:has-text("Sign in")');
  if (signInBtn) { await signInBtn.click(); await page.waitForTimeout(1000); }
  await page.fill('input[name="email"]', 'dcode@satchida.local');
  await page.fill('input[name="password"]', 'Dcode@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  await page.goto('http://127.0.0.1:3080/projects/6affb8df041a0f7d5af82fa1');
  await page.waitForTimeout(4000);

  const textContent = await page.evaluate(() => document.body.innerText);
  console.log('Project Page Text (first 600 chars):\n', textContent.slice(0, 600));

  // Check elements: Normal mode, Developer mode, file tree, preview panel, chat panel
  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map(b => b.innerText).filter(Boolean)
  );
  console.log('Buttons on page:', buttons);

  await browser.close();
})();
