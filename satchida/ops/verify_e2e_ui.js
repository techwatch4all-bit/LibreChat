const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(2000);
  
  // Click Sign In to open modal if landing page
  const signInBtn = await page.$('button:has-text("Sign in")');
  if (signInBtn) {
    await signInBtn.click();
    await page.waitForTimeout(1000);
  }

  await page.fill('input[name="email"]', 'dcode@satchida.local');
  await page.fill('input[name="password"]', 'Dcode@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  console.log('Post-login URL for dcode:', page.url());

  // 1. Check Studio Library rail button
  const studioBtn = await page.$('[data-testid="nav-studio-library-rail-button"]');
  console.log('Studio Library Button present:', !!studioBtn);

  // 2. Check IDE / VibeStudio nav link
  const ideBtn = await page.$('[data-testid="nav-panel-ide"]');
  console.log('IDE Nav panel link present:', !!ideBtn);

  await page.screenshot({ path: 'verify_dcode_sidebar.png' });

  // 3. Test clicking Studio Library Button
  if (studioBtn) {
    await studioBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'verify_studio_library_open.png' });
    console.log('Studio Library clicked and panel captured in verify_studio_library_open.png');
  }

  // 4. Test Navigating to /projects (rebuilt OpenCode studio)
  await page.goto('http://127.0.0.1:3080/projects');
  await page.waitForTimeout(4000);
  console.log('Projects URL:', page.url());
  await page.screenshot({ path: 'verify_opencode_projects.png' });

  // 5. Test Navigating to legacy /ide -> should redirect to /projects
  await page.goto('http://127.0.0.1:3080/ide');
  await page.waitForTimeout(3000);
  console.log('Legacy /ide redirected to:', page.url());

  await browser.close();
})();
