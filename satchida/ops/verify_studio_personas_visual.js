const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    console.log('Navigating to http://127.0.0.1:3080/login...');
    await page.goto('http://127.0.0.1:3080/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('Opening sign-in modal...');
    await page.click('button:has-text("Sign in")');
    await page.waitForSelector('#email', { timeout: 5000 });

    console.log('Filling dchat credentials...');
    await page.fill('#email', 'dchat@satchida.local');
    await page.fill('#password', 'Demo@123456');

    console.log('Submitting login form...');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(4000);
    console.log('Current URL:', page.url());

    // 1. First capture the default Chat landing screen
    await page.screenshot({ path: 'verify_chat_landing.png', fullPage: true });
    console.log('Saved verify_chat_landing.png');

    // 2. Select OpenFilm Studio
    console.log('Switching to OpenFilm Studio...');
    // Look for OpenFilm in the sidebar or model selector
    const openFilmBtn = page.locator('text=OpenFilm Studio').first();
    if (await openFilmBtn.count() > 0) {
      await openFilmBtn.click();
      await page.waitForTimeout(3000);
    } else {
      // Open model/spec selector
      console.log('Trying model selector button...');
      await page.click('[data-testid="text-endpoint"]');
      await page.waitForTimeout(1000);
      await page.click('text=OpenFilm Studio');
      await page.waitForTimeout(3000);
    }

    // Capture OpenFilm Spotlight view
    await page.screenshot({ path: 'verify_openfilm_spotlight.png', fullPage: true });
    console.log('Saved verify_openfilm_spotlight.png');

    // 3. Click on "Arch & Drones"
    console.log('Clicking "Arch & Drones"...');
    await page.click('button:has-text("Arch & Drones")');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'verify_openfilm_arch_drones.png', fullPage: true });
    console.log('Saved verify_openfilm_arch_drones.png');

    // 4. Click on "Robotics & How"
    console.log('Clicking "Robotics & How"...');
    await page.click('button:has-text("Robotics & How")');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'verify_openfilm_robotics.png', fullPage: true });
    console.log('Saved verify_openfilm_robotics.png');

    // 5. Click on "STEM & Cyber"
    console.log('Clicking "STEM & Cyber"...');
    await page.click('button:has-text("STEM & Cyber")');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'verify_openfilm_stem.png', fullPage: true });
    console.log('Saved verify_openfilm_stem.png');

  } catch (err) {
    console.error('Error during visual verification:', err);
  } finally {
    await browser.close();
  }
})();
