const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Navigating to login...');
  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(2000);

  const signInBtn = await page.$('button:has-text("Sign in")');
  if (signInBtn) {
    await signInBtn.click();
    await page.waitForTimeout(1000);
  }

  console.log('2. Logging in as admin@satchida.com...');
  await page.waitForSelector('#email');
  await page.fill('#email', 'admin@satchida.com');
  await page.fill('#password', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  console.log('Logged in. Current URL:', page.url());

  // Click "New Chat" button or navigate to /c/new
  console.log('3. Navigating to a brand new chat (/c/new)...');
  await page.goto('http://127.0.0.1:3080/c/new');
  await page.waitForTimeout(4000);
  console.log('New chat URL:', page.url());

  // Wait for composer
  console.log('4. Locating composer textarea...');
  const textarea = await page.waitForSelector('textarea, [contenteditable="true"]', { timeout: 15000 });

  const promptText = `Procedural Watercolor & Wash Art — Deterministic 1080p NumPy/Pillow code painting with procedural pigments, paper grain, and wet-on-wet glazes
Inputs: [Subject: e.g. misty shivalik range of mountains with rustic Hindu temple, lake with Kashmiri boats and tourists, uttarakhand region] · [Color Palette: e.g. indigo, ochre, burnt umber] · [Composition: e.g. 16:9 panoramic landscape with atmospheric depth] · [Seed: e.g. 42] · [Resolution: 1920x1080] · [Audio Atmosphere: gentle temple bells, soft sitar, mountain breeze] · [Animation Style: gentle rain drizzle, mist drift, birds in flight]

Please render the watercolor painting and prepare the experience.`;

  console.log('5. Typing and sending the exact user prompt...');
  await textarea.fill(promptText);
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter');

  console.log('6. Waiting 25s for assistant initial turn...');
  await page.waitForTimeout(25000);

  let bodyText = await page.innerText('body');
  if (bodyText.toLowerCase().includes('go') && (bodyText.toLowerCase().includes('type go') || bodyText.toLowerCase().includes('reply go') || bodyText.toLowerCase().includes('confirm with go') || bodyText.toLowerCase().includes('say go'))) {
    console.log('Assistant requested GO. Sending GO in composer...');
    const ta = await page.waitForSelector('textarea, [contenteditable="true"]');
    await ta.fill('GO');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    console.log('Sent GO! Waiting for full execution (80s)...');
    await page.waitForTimeout(80000);
  } else {
    console.log('Tool calls in flight. Waiting 60s...');
    await page.waitForTimeout(60000);
  }

  const finalUrl = page.url();
  console.log('Final URL after turn:', finalUrl);
  await page.screenshot({ path: 'new_chat_verification.png', fullPage: true });
  console.log('Saved new_chat_verification.png');

  // Extract text of last message in DOM
  const messages = await page.$$eval('.message-content, [data-testid="message-content"], .prose', els => els.map(e => e.innerText));
  fs.writeFileSync('new_chat_messages.json', JSON.stringify({ url: finalUrl, messages }, null, 2));

  await browser.close();
})();
