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

  // Click on Art tab
  await page.click('button:has-text("Art, Cartoon")');
  await page.waitForTimeout(1000);

  // Click card
  await page.click('button:has-text("Procedural Watercolor")');
  await page.waitForTimeout(1000);

  // Click the send button in the composer
  console.log('Sending staged prompt...');
  const sendBtn = await page.$('button[data-testid="send-button"], button[aria-label="Send message"], button:has-text("Send")');
  if (sendBtn) {
    await sendBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }

  // Wait for the response to arrive in chat
  console.log('Waiting for response to stream and render...');
  await page.waitForTimeout(20000);

  // Screenshot real in-chat conversation
  await page.screenshot({ path: 'real_user_chat_execution.png' });
  console.log('Saved real_user_chat_execution.png');

  await browser.close();
})();
