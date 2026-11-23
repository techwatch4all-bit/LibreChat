const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to login page...');
  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(2000);
  const signInBtn = await page.$('button:has-text("Sign in")');
  if (signInBtn) {
    await signInBtn.click();
    await page.waitForTimeout(1000);
  }

  console.log('Filling admin credentials...');
  await page.waitForSelector('#email');
  await page.fill('#email', 'admin@satchida.com');
  await page.fill('#password', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  console.log('Logged in successfully. Navigating to conversation cf99b1a5-1121-5495-b15e-21b8ad05d0a7...');
  await page.goto('http://127.0.0.1:3080/c/cf99b1a5-1121-5495-b15e-21b8ad05d0a7');
  await page.waitForTimeout(4000);

  console.log('Locating composer...');
  const textarea = await page.waitForSelector('textarea, [contenteditable="true"]', { timeout: 10000 });

  const promptText = `Procedural Watercolor & Wash Art — Deterministic 1080p NumPy/Pillow code painting with procedural pigments, paper grain, and wet-on-wet glazes
Inputs: [Subject: e.g. misty shivalik range of mountains with rustic Hindu temple, lake with Kashmiri boats and tourists, uttarakhand region] · [Color Palette: e.g. indigo, ochre, burnt umber] · [Composition: e.g. 16:9 panoramic landscape with atmospheric depth] · [Seed: e.g. 42] · [Resolution: 1920x1080] · [Audio Atmosphere: gentle temple bells, soft sitar, mountain breeze] · [Animation Style: gentle rain drizzle, mist drift, birds in flight]

Please render the watercolor painting and prepare the experience.`;

  await textarea.fill(promptText);
  await page.waitForTimeout(1000);

  console.log('Sending initial prompt...');
  await page.keyboard.press('Enter');

  console.log('Waiting 25s for assistant response...');
  await page.waitForTimeout(25000);

  const text1 = await page.innerText('body');
  if (text1.toLowerCase().includes('type go') || text1.toLowerCase().includes('confirm with go') || text1.toLowerCase().includes('reply go') || text1.toLowerCase().includes('say go')) {
    console.log('Assistant requested GO confirmation. Sending GO...');
    const ta = await page.waitForSelector('textarea, [contenteditable="true"]');
    await ta.fill('GO');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    console.log('Sent GO! Waiting for procedural execution to complete (up to 70s)...');
    await page.waitForTimeout(70000);
  } else {
    console.log('Waiting for execution...');
    await page.waitForTimeout(45000);
  }

  await page.screenshot({ path: 'admin_live_e2e_verification.png', fullPage: true });
  console.log('Captured admin_live_e2e_verification.png');

  await browser.close();
})();
