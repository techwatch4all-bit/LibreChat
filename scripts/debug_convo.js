const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:3080/login');
  await page.click('button:has-text("Sign in")');
  await page.fill('#email', 'admin@satchida.com');
  await page.fill('#password', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  console.log('After login URL:', page.url());

  await page.goto('http://127.0.0.1:3080/c/cf99b1a5-1121-5495-b15e-21b8ad05d0a7');
  await page.waitForTimeout(4000);
  console.log('Convo URL:', page.url());
  await page.screenshot({ path: 'convo_inspect.png' });
  console.log('Saved convo_inspect.png');

  const textareas = await page.$$('textarea');
  console.log('Textareas count:', textareas.length);
  const divs = await page.$$('[contenteditable="true"]');
  console.log('Contenteditables count:', divs.length);

  await browser.close();
})();
