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

    console.log('Waiting for navigation to landing...');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(4000);

    console.log('Landing page URL:', page.url());

    // Take landing screenshot
    await page.screenshot({ path: 'verify_studio_cards_view.png', fullPage: true });
    console.log('Screenshot saved to verify_studio_cards_view.png');

    const content = await page.content();
    const hasWatercolor = content.includes('Procedural Watercolor & Wash Art');
    const hasMath = content.includes('3B1B Math & Geometric Animation');
    const hasInkWash = content.includes('Traditional Ink Wash & Chinese Painting');
    const hasTag1 = content.includes('NumPy · 1080p Painting');
    const hasTag2 = content.includes('Vector · 60fps MP4');
    const hasTag3 = content.includes('Procedural Ink · Calligraphy');
    const hasClickToStage = content.includes('Click to stage');

    console.log('Starter Card & Tip Checks:', {
      hasWatercolor,
      hasMath,
      hasInkWash,
      hasTag1,
      hasTag2,
      hasTag3,
      hasClickToStage
    });

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await browser.close();
  }
})();
