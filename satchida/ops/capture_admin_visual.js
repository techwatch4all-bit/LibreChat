const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('#email');
  await page.fill('#email', 'admin@satchida.com');
  await page.fill('#password', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  console.log('Logged in as Admin. Current URL:', page.url());

  // In sidebar, click "OpenFilm Studio"
  console.log('Clicking OpenFilm Studio...');
  await page.click('text=OpenFilm Studio');
  await page.waitForTimeout(3000);

  // 1. Screenshot OpenFilm Spotlight
  await page.screenshot({ path: 'verify_admin_openfilm_spotlight.png', fullPage: true });
  console.log('Saved verify_admin_openfilm_spotlight.png');

  // 2. Click "Arch & Drones"
  console.log('Clicking Arch & Drones...');
  await page.click('button:has-text("Arch & Drones")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'verify_admin_openfilm_arch_drones.png', fullPage: true });
  console.log('Saved verify_admin_openfilm_arch_drones.png');

  // 3. Click "Robotics & How"
  console.log('Clicking Robotics & How...');
  await page.click('button:has-text("Robotics & How")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'verify_admin_openfilm_robotics.png', fullPage: true });
  console.log('Saved verify_admin_openfilm_robotics.png');

  // 4. Click "STEM & Cyber"
  console.log('Clicking STEM & Cyber...');
  await page.click('button:has-text("STEM & Cyber")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'verify_admin_openfilm_stem.png', fullPage: true });
  console.log('Saved verify_admin_openfilm_stem.png');

  console.log('ALL ADMIN VISUAL SCREENSHOTS COMPLETED!');
  await browser.close();
})();
