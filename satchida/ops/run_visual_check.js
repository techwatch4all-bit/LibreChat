const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://127.0.0.1:3080/login');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Sign in")');
    await page.waitForSelector('#email');
    await page.fill('#email', 'dchat@satchida.local');
    await page.fill('#password', 'Demo@123456');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);

    // Click the mode dropdown in the top header or bottom toolbar
    console.log('Finding header dropdown...');
    // Look for button with text "Chat"
    const headerChatBtn = page.locator('button:has-text("Chat")').first();
    await headerChatBtn.click();
    await page.waitForTimeout(1000);

    // Click OpenFilm Studio in dropdown
    console.log('Selecting OpenFilm Studio...');
    await page.click('text=OpenFilm Studio');
    await page.waitForTimeout(3000);

    // 1. Capture Spotlight
    console.log('Taking screenshot of OpenFilm Spotlight...');
    await page.screenshot({ path: 'verify_openfilm_spotlight.png', fullPage: true });

    // 2. Click "Arch & Drones"
    console.log('Clicking Arch & Drones...');
    await page.click('button:has-text("Arch & Drones")');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'verify_openfilm_arch_drones.png', fullPage: true });

    // 3. Click "Robotics & How"
    console.log('Clicking Robotics & How...');
    await page.click('button:has-text("Robotics & How")');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'verify_openfilm_robotics.png', fullPage: true });

    // 4. Click "STEM & Cyber"
    console.log('Clicking STEM & Cyber...');
    await page.click('button:has-text("STEM & Cyber")');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'verify_openfilm_stem.png', fullPage: true });

    console.log('SUCCESS: All screenshots taken.');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
  }
})();
