const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1560, height: 950 } });
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

  console.log('3. Navigating to a brand new chat (/c/new)...');
  await page.goto('http://127.0.0.1:3080/c/new');
  await page.waitForTimeout(4000);
  console.log('New chat URL:', page.url());

  const textarea = await page.waitForSelector('textarea, [contenteditable="true"]', { timeout: 15000 });

  const promptText = `Procedural Watercolor & Wash Art — Deterministic 1080p NumPy/Pillow code painting with procedural pigments, paper grain, and wet-on-wet glazes
Inputs: [Subject: e.g. misty shivalik range of mountains with rustic Hindu temple, lake with Kashmiri boats and tourists, uttarakhand region] · [Color Palette: e.g. indigo, ochre, burnt umber] · [Composition: e.g. 16:9 panoramic landscape with atmospheric depth] · [Seed: e.g. 42] · [Resolution: 1920x1080] · [Audio Atmosphere: gentle temple bells, soft sitar, mountain breeze] · [Animation Style: gentle rain drizzle, mist drift, birds in flight]

Please render the watercolor painting and prepare the experience.`;

  console.log('4. Typing and sending prompt...');
  await textarea.fill(promptText);
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter');

  console.log('5. Waiting 25s for assistant response...');
  await page.waitForTimeout(25000);

  let bodyText = await page.innerText('body');
  if (bodyText.toLowerCase().includes('go') && (bodyText.toLowerCase().includes('type go') || bodyText.toLowerCase().includes('reply go') || bodyText.toLowerCase().includes('confirm with go') || bodyText.toLowerCase().includes('say go'))) {
    console.log('Assistant requested GO. Sending GO in composer...');
    const ta = await page.waitForSelector('textarea, [contenteditable="true"]');
    await ta.fill('GO');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    console.log('Sent GO! Waiting for full execution (110s)...');
    await page.waitForTimeout(110000);
  } else {
    console.log('Tool calls in flight. Waiting 80s...');
    await page.waitForTimeout(80000);
  }

  const finalUrl = page.url();
  console.log('Chat turn finished. URL:', finalUrl);
  await page.screenshot({ path: 'chat_with_artifact_before_click.png', fullPage: true });

  // Now click on the artifact / Studio button to open OpenFilm Studio!
  console.log('6. Looking for Studio artifact button / link...');
  const studioBtn = await page.$('button:has-text("Viewing Studio"), button:has-text("Open"), [data-testid="artifact-button"], button:has-text("Misty Shivalik")');
  if (studioBtn) {
    console.log('Clicking studio button to mount Studio panel...');
    await studioBtn.click();
    await page.waitForTimeout(5000);
  } else {
    // Try clicking any artifact pill or button inside the message
    const anyArtifact = await page.$('.artifact-pill, button:has-text("Studio"), [role="button"]:has-text("Misty")');
    if (anyArtifact) {
      console.log('Clicking alternative artifact element...');
      await anyArtifact.click();
      await page.waitForTimeout(5000);
    }
  }

  console.log('7. Taking screenshot of Studio panel...');
  await page.screenshot({ path: 'studio_panel_live_verification.png', fullPage: true });
  console.log('Saved studio_panel_live_verification.png');

  // Check if iframe is mounted and inspect its contents
  const iframes = await page.$$('iframe');
  console.log('Total iframes mounted on page:', iframes.length);
  for (let i = 0; i < iframes.length; i++) {
    try {
      const src = await iframes[i].getAttribute('src');
      console.log(`Iframe ${i} src:`, src);
    } catch(e){}
  }

  fs.copyFileSync('studio_panel_live_verification.png', 'C:/Users/WinDiesel/.gemini/antigravity/brain/63fe73f5-8098-44bf-8a2a-7efde29d54dc/studio_panel_live_verification.png');
  console.log('Copied screenshot to brain artifact folder');

  await browser.close();
})();
