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

  // Take screenshot of default Chat landing showing "🎨 Art, Cartoon & Sketch" tab
  await page.screenshot({ path: 'landing_with_art_tab.png' });
  console.log('Saved landing_with_art_tab.png');

  // Click on "🎨 Art, Cartoon & Sketch"
  console.log('Clicking 🎨 Art, Cartoon & Sketch tab...');
  await page.click('button:has-text("Art, Cartoon & Sketch")');
  await page.waitForTimeout(1500);

  // Take screenshot showing all the cards and their engine tags!
  await page.screenshot({ path: 'art_category_cards_view.png' });
  console.log('Saved art_category_cards_view.png');

  // Verify visible card text
  const cardTexts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(t => t.includes('Painting') || t.includes('MP4') || t.includes('Watercolor') || t.includes('3B1B') || t.includes('Ink Wash'));
  });
  console.log('Cards matching Art & Motion in UI:', cardTexts);

  // Click on the Watercolor card to show staging into the prompt textarea
  console.log('Clicking on Watercolor card...');
  await page.click('button:has-text("Procedural Watercolor & Wash Art")');
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'staged_watercolor_card_in_composer.png' });
  console.log('Saved staged_watercolor_card_in_composer.png');

  await browser.close();
})();
