const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1680, height: 1000 } });
  const page = await context.newPage();

  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(1500);
  const signInBtn = await page.$('button:has-text("Sign in")');
  if (signInBtn) await signInBtn.click();
  await page.waitForTimeout(1000);
  await page.fill('#email', 'admin@satchida.com');
  await page.fill('#password', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  await page.goto('http://127.0.0.1:3080/c/f40a33cb-01a5-5125-8f31-7364d30f0f9b');
  await page.waitForTimeout(3000);

  const artBtn = await page.waitForSelector('button:has-text("Misty Shivalik Dawn — Uttarakhand Living Art")');
  await artBtn.click();
  await page.waitForTimeout(3000);

  const iframes = await page.$$eval('iframe', els => els.map(e => ({ title: e.title, src: e.src, srcDoc: e.srcdoc ? e.srcdoc.slice(0, 150) : null })));
  console.log('Iframes mounted:', JSON.stringify(iframes, null, 2));

  await browser.close();
})();
