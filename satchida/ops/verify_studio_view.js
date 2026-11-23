const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await context.newPage();

  console.log('Logging in...');
  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(2000);
  const signInBtn = await page.$('button:has-text("Sign in")');
  if (signInBtn) await signInBtn.click();
  await page.waitForTimeout(1000);
  await page.fill('#email', 'admin@satchida.com');
  await page.fill('#password', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Navigate to conversation
  console.log('Navigating to conversation f40a33cb-01a5-5125-8f31-7364d30f0f9b...');
  await page.goto('http://127.0.0.1:3080/c/f40a33cb-01a5-5125-8f31-7364d30f0f9b');
  await page.waitForTimeout(4000);

  // Click on the artifact button
  const artBtn = await page.$('button:has-text("Viewing Studio"), [data-testid="artifact-button"], button:has-text("Misty Shivalik")');
  if (artBtn) {
    console.log('Clicking artifact button...');
    await artBtn.click();
    await page.waitForTimeout(5000);
  }

  // Take screenshot of Studio open
  await page.screenshot({ path: 'studio_with_living_art_verified.png', fullPage: true });
  fs.copyFileSync('studio_with_living_art_verified.png', 'C:/Users/WinDiesel/.gemini/antigravity/brain/63fe73f5-8098-44bf-8a2a-7efde29d54dc/studio_with_living_art_verified.png');
  console.log('Saved studio_with_living_art_verified.png');

  await browser.close();
})();
