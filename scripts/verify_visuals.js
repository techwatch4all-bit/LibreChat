const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    console.log('Navigating to http://127.0.0.1:3080/login...');
    await page.goto('http://127.0.0.1:3080/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const signInBtn = await page.$('button:has-text("Sign in")');
    if (signInBtn) {
      await signInBtn.click();
      await page.waitForSelector('#email', { timeout: 5000 });
      await page.fill('#email', 'dchat@satchida.local');
      await page.fill('#password', 'Demo@123456');
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(4000);
    }

    console.log('Current URL:', page.url());

    // 1. Take Chat Suggested Screenshot
    await page.screenshot({ path: 'C:/Users/WinDiesel/.gemini/antigravity/brain/2d1dde0f-ecc7-4756-93c7-65da27855eda/verify_chat_suggested_perfect_icons.png', fullPage: true });
    console.log('Captured verify_chat_suggested_perfect_icons.png');

    // 2. Click through other Chat pills
    const pills = [
      'Bedtime Stories & Creative',
      'Markets & Bullion',
      'Health & Emergency',
      'Vedic & Holistic Wellness',
      'Citizen Essentials',
      'Geopolitics & Defence'
    ];

    for (const pill of pills) {
      const pillBtn = await page.$(`button:has-text("${pill}")`);
      if (pillBtn) {
        await pillBtn.click();
        await page.waitForTimeout(1000);
        const safeName = pill.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        await page.screenshot({ path: `C:/Users/WinDiesel/.gemini/antigravity/brain/2d1dde0f-ecc7-4756-93c7-65da27855eda/verify_chat_${safeName}.png` });
        console.log(`Captured verify_chat_${safeName}.png`);
      }
    }

    // 3. Switch to OpenFilm Studio
    console.log('Switching to OpenFilm Studio...');
    const modeBtn = await page.$('button:has-text("OpenFilm"), [aria-haspopup="menu"]');
    // Or click endpoint dropdown / header mode
    const headerBtn = await page.$('button:has-text("Chat")');
    if (headerBtn) {
      await headerBtn.click();
      await page.waitForTimeout(500);
      const studioOpt = await page.$('text=OpenFilm Studio');
      if (studioOpt) {
        await studioOpt.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'C:/Users/WinDiesel/.gemini/antigravity/brain/2d1dde0f-ecc7-4756-93c7-65da27855eda/verify_openfilm_spotlight_perfect_icons.png' });
        console.log('Captured OpenFilm Spotlight');

        // Check OpenFilm groups
        const studioGroups = ['Arch & Drones', 'Robotics & How', 'STEM & Cyber', 'Business & Art', 'Health & Home'];
        for (const g of studioGroups) {
          const gBtn = await page.$(`button:has-text("${g}")`);
          if (gBtn) {
            await gBtn.click();
            await page.waitForTimeout(1000);
            const safeName = g.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            await page.screenshot({ path: `C:/Users/WinDiesel/.gemini/antigravity/brain/2d1dde0f-ecc7-4756-93c7-65da27855eda/verify_openfilm_${safeName}.png` });
            console.log(`Captured verify_openfilm_${safeName}.png`);
          }
        }
      }
    }

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
  }
})();
