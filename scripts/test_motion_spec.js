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

  // Switch to Motion or OpenFilm from the top-left dropdown
  console.log('Inspecting model spec buttons...');
  const specTrigger = await page.$('button[data-testid="select-specs-button"], button[id="headlessui-menu-button-1"], button:has-text("Chat"), button:has-text("Satchida")');
  console.log('Spec trigger found:', !!specTrigger);

  // Directly navigate to Motion spec
  console.log('Navigating directly to Motion spec: http://127.0.0.1:3080/c/new?spec=Motion');
  await page.goto('http://127.0.0.1:3080/c/new?spec=Motion', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Check categories and click Art, Cartoon & Sketch
  console.log('Looking for Art, Cartoon & Sketch tab under Motion...');
  const artBtn = await page.$('button:has-text("Art, Cartoon & Sketch")');
  if (artBtn) {
    console.log('Clicking Art, Cartoon & Sketch tab...');
    await artBtn.click();
    await page.waitForTimeout(1500);
  } else {
    // If grouped under Business & Art, click group first
    const bizArt = await page.$('button:has-text("Business & Art")');
    if (bizArt) {
      console.log('Clicking Business & Art group pill...');
      await bizArt.click();
      await page.waitForTimeout(1000);
      const subArt = await page.$('button:has-text("Art, Cartoon & Sketch")');
      if (subArt) {
        console.log('Clicking sub-category Art, Cartoon & Sketch...');
        await subArt.click();
        await page.waitForTimeout(1000);
      }
    }
  }

  await page.screenshot({ path: 'verify_motion_art_cards.png', fullPage: true });
  console.log('Saved screenshot to verify_motion_art_cards.png');

  const content = await page.content();
  const results = {
    hasWatercolor: content.includes('Procedural Watercolor & Wash Art'),
    hasMath: content.includes('3B1B Math & Geometric Animation'),
    hasInkWash: content.includes('Traditional Ink Wash & Chinese Painting'),
    hasTag1: content.includes('NumPy · 1080p Painting'),
    hasTag2: content.includes('Vector · 60fps MP4'),
    hasTag3: content.includes('Procedural Ink · Calligraphy'),
    hasClickToStage: content.includes('Click to stage')
  };
  console.log('Motion Art Cards Check:', results);

  // Click on the Watercolor card to test staging and pre-binding
  const watercolorCard = await page.$('button:has-text("Procedural Watercolor & Wash Art")');
  if (watercolorCard) {
    console.log('Clicking Procedural Watercolor & Wash Art card...');
    await watercolorCard.click();
    await page.waitForTimeout(1000);
    const textareaVal = await page.$eval('textarea', el => el.value);
    console.log('Staged Textarea Value (first 120 chars):', textareaVal.slice(0, 120));
    await page.screenshot({ path: 'verify_card_clicked_and_staged.png' });
    console.log('Saved screenshot to verify_card_clicked_and_staged.png');
  }

  await browser.close();
})();
