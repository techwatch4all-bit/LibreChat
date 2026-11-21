const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(2000);
  const signInBtn = await page.$('button:has-text("Sign in")');
  if (signInBtn) { await signInBtn.click(); await page.waitForTimeout(1000); }
  await page.fill('input[name="email"]', 'admin@satchida.com');
  await page.fill('input[name="password"]', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  // Directly navigate to project 6affb8df041a0f7d5af82fa1
  await page.goto('http://127.0.0.1:3080/projects/6affb8df041a0f7d5af82fa1');
  await page.waitForTimeout(4000);
  console.log('Project page URL:', page.url());
  await page.screenshot({ path: 'verify_admin_project_view.png' });

  await browser.close();
})();
