const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await context.newPage();

  console.log('1. Logging in...');
  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(2000);
  const signInBtn = await page.$('button:has-text("Sign in")');
  if (signInBtn) await signInBtn.click();
  await page.waitForTimeout(1000);
  await page.fill('#email', 'admin@satchida.com');
  await page.fill('#password', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  console.log('2. Navigating to conversation 5527097a-42f5-5acf-87ce-37faaa15df6e...');
  await page.goto('http://127.0.0.1:3080/c/5527097a-42f5-5acf-87ce-37faaa15df6e');
  
  // Wait until the assistant message finishes rendering
  console.log('3. Waiting 35s for generation to complete...');
  await page.waitForTimeout(35000);

  // Take screenshot of chat
  await page.screenshot({ path: 'chat_finished_state.png', fullPage: true });

  // Locate the artifact card / button
  console.log('4. Locating artifact card to open Studio...');
  const artifactBtn = await page.$('button:has-text("Viewing Studio"), button:has-text("View"), button:has-text("Open"), [data-testid="artifact-button"], button:has-text("Misty Shivalik")');
  if (artifactBtn) {
    console.log('Clicking artifact button...');
    await artifactBtn.click();
    await page.waitForTimeout(6000);
  } else {
    // Click any artifact block
    const altArtifact = await page.$('.artifact-header, .artifact-pill, [role="button"]:has-text("Misty")');
    if (altArtifact) {
      console.log('Clicking alt artifact header...');
      await altArtifact.click();
      await page.waitForTimeout(6000);
    }
  }

  // Take full screenshot with Studio panel open
  console.log('5. Taking full screenshot of Studio panel...');
  await page.screenshot({ path: 'studio_opened_live.png', fullPage: true });
  fs.copyFileSync('studio_opened_live.png', 'C:/Users/WinDiesel/.gemini/antigravity/brain/63fe73f5-8098-44bf-8a2a-7efde29d54dc/studio_opened_live.png');
  console.log('Saved and copied studio_opened_live.png');

  // Check iframe and audio status inside studio
  const iframes = await page.$$('iframe');
  console.log('Iframes found:', iframes.length);
  for (let i = 0; i < iframes.length; i++) {
    const title = await iframes[i].getAttribute('title');
    const src = await iframes[i].getAttribute('src');
    console.log(`Iframe ${i} title: "${title}", src: "${src}"`);
  }

  await browser.close();
})();
