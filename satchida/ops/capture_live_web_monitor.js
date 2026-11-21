const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(1000);
  const signInBtn = await page.$('button:has-text("Sign in")');
  if (signInBtn) {
    await signInBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.fill('#email', 'admin@satchida.com');
  await page.fill('#password', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  await page.goto('http://127.0.0.1:3080/projects/6affb8df041a0f7d5af82fa1');
  await page.waitForTimeout(5000);

  const mainText = await page.evaluate(() => {
    // Find all div elements or headers inside the workspace area
    return document.body.innerText;
  });
  console.log('Body text (first 1000):\n', mainText.slice(0, 1000));

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
  });
  console.log('All buttons on page:', buttons);

  await page.screenshot({ path: 'admin_live_web_monitor.png' });
  await browser.close();
})();
