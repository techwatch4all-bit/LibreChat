const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(1000);
  
  // Click "Sign in" to open modal
  const signInBtn = await page.$('button:has-text("Sign in")');
  if (signInBtn) {
    await signInBtn.click();
    await page.waitForTimeout(1500);
  }

  console.log('Filling credentials for admin@satchida.com...');
  await page.fill('#email', 'admin@satchida.com');
  await page.fill('#password', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  console.log('Navigated URL after login:', page.url());

  // Go to /projects
  await page.goto('http://127.0.0.1:3080/projects');
  await page.waitForTimeout(3000);
  console.log('Projects URL:', page.url());

  // Check what projects are rendered on /projects
  const projectCards = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button, div'))
      .map(el => el.innerText)
      .filter(t => t && (t.includes('Live Web Monitor') || t.includes('OpenCode') || t.includes('OpenHands') || t.includes('test-vibe-app')));
  });
  console.log('Matching project elements on /projects:', projectCards);

  // Navigate directly to Live Web Monitor
  await page.goto('http://127.0.0.1:3080/projects/6affb8df041a0f7d5af82fa1');
  await page.waitForTimeout(4000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Live Web Monitor Page Text:\n', bodyText.slice(0, 800));

  await browser.close();
})();
