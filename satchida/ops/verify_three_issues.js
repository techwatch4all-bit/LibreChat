const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(2000);
  
  const signInBtn = await page.$('button:has-text("Sign in")');
  if (signInBtn) {
    await signInBtn.click();
    await page.waitForTimeout(1000);
  }

  await page.fill('input[name="email"]', 'dcode@satchida.local');
  await page.fill('input[name="password"]', 'Dcode@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  console.log('Post-login URL:', page.url());

  // 1. Check Studio Library "Open in Studio" click
  const studioBtn = await page.$('[data-testid="nav-studio-library-rail-button"]');
  if (studioBtn) {
    await studioBtn.click();
    await page.waitForTimeout(2000);
    // Find first "Open in Studio" or Edit button in library
    const editBtn = await page.$('button:has-text("Edit")');
    if (editBtn) {
      console.log('Found Edit button in Studio Library, clicking...');
      await editBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'verify_studio_in_app_edit.png' });
      console.log('Captured verify_studio_in_app_edit.png. Current URL:', page.url());
    }
  }

  // 2. Check /projects template gallery thumbnails
  await page.goto('http://127.0.0.1:3080/projects');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'verify_projects_thumbnails.png' });
  console.log('Captured verify_projects_thumbnails.png');

  // 3. Open existing project or first project in list to verify normal/developer mode UI elements
  // Look for project rows / cards
  const projectLink = await page.$('a[href^="/projects/"]');
  if (projectLink) {
    console.log('Found project link, clicking...');
    await projectLink.click();
  } else {
    // If no existing project, click on first template's "Use Template"
    const useTplBtn = await page.$('button:has-text("Use Template")');
    if (useTplBtn) {
      console.log('Found Use Template button, clicking...');
      await useTplBtn.click();
    }
  }
  await page.waitForTimeout(4000);
  console.log('Project view URL:', page.url());
  await page.screenshot({ path: 'verify_project_workspace_ui.png' });

  await browser.close();
})();
