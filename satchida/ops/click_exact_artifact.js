const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1680, height: 1000 } });
  const page = await context.newPage();

  console.log('1. Logging in...');
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
  console.log('2. Navigating to conversation f40a33cb-01a5-5125-8f31-7364d30f0f9b...');
  await page.goto('http://127.0.0.1:3080/c/f40a33cb-01a5-5125-8f31-7364d30f0f9b');
  await page.waitForTimeout(4000);

  // Click on the artifact button
  console.log('3. Clicking artifact button...');
  const artBtn = await page.waitForSelector('button:has-text("Misty Shivalik Dawn — Uttarakhand Living Art")', { timeout: 10000 });
  await artBtn.click();

  // Wait 4s for Studio panel to mount
  console.log('4. Waiting 4s for Studio to mount...');
  await page.waitForTimeout(4000);

  // Take screenshot of Studio open
  await page.screenshot({ path: 'verified_living_art_in_studio.png', fullPage: true });
  fs.copyFileSync('verified_living_art_in_studio.png', 'C:/Users/WinDiesel/.gemini/antigravity/brain/63fe73f5-8098-44bf-8a2a-7efde29d54dc/verified_living_art_in_studio.png');
  console.log('5. Saved verified_living_art_in_studio.png to brain directory!');

  await browser.close();
})();
