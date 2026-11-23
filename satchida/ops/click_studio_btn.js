const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await context.newPage();

  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(1500);
  const signInBtn = await page.$('button:has-text("Sign in")');
  if (signInBtn) await signInBtn.click();
  await page.waitForTimeout(1000);
  await page.fill('#email', 'admin@satchida.com');
  await page.fill('#password', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Navigate to conversation
  await page.goto('http://127.0.0.1:3080/c/f40a33cb-01a5-5125-8f31-7364d30f0f9b');
  await page.waitForTimeout(3000);

  // Scroll down to the bottom
  console.log('Scrolling down to find the artifact card...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  // Look for the "Viewing Studio" button in the DOM
  const studioBtn = await page.waitForSelector('button:has-text("Viewing Studio")', { timeout: 10000 });
  if (studioBtn) {
    console.log('Found Viewing Studio button! Clicking it...');
    await studioBtn.click();
    await page.waitForTimeout(6000);
  }

  await page.screenshot({ path: 'studio_panel_live_open_with_living_art.png', fullPage: true });
  fs.copyFileSync('studio_panel_live_open_with_living_art.png', 'C:/Users/WinDiesel/.gemini/antigravity/brain/63fe73f5-8098-44bf-8a2a-7efde29d54dc/studio_panel_live_open_with_living_art.png');
  console.log('Saved studio_panel_live_open_with_living_art.png');

  await browser.close();
})();
