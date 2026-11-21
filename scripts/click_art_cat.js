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

  console.log('Finding Art category button...');
  const artBtn = await page.$('button:has-text("Art, Cartoon & Sketch")');
  if (artBtn) {
    console.log('Clicking Art, Cartoon & Sketch category tab...');
    await artBtn.click();
    await page.waitForTimeout(1500);
  } else {
    console.log('Category tab not directly visible, listing all category buttons:');
    const tabTexts = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(t => t.includes('🎨') || t.includes('Art')));
    console.log('Matching tabs:', tabTexts);
  }

  await page.screenshot({ path: 'verify_art_category_cards.png' });
  console.log('Saved screenshot to verify_art_category_cards.png');

  const content = await page.content();
  const hasWatercolor = content.includes('Procedural Watercolor & Wash Art');
  const hasMath = content.includes('3B1B Math & Geometric Animation');
  const hasInkWash = content.includes('Traditional Ink Wash & Chinese Painting');
  const hasTag1 = content.includes('NumPy · 1080p Painting');
  const hasTag2 = content.includes('Vector · 60fps MP4');
  const hasTag3 = content.includes('Procedural Ink · Calligraphy');
  const hasClickToStage = content.includes('Click to stage');

  console.log('Checks under Art category:', {
    hasWatercolor,
    hasMath,
    hasInkWash,
    hasTag1,
    hasTag2,
    hasTag3,
    hasClickToStage
  });

  await browser.close();
})();
