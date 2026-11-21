const { chromium } = require('playwright');
const jwt = require('jsonwebtoken');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const token = jwt.sign(
    { id: '6adcd4f7fff2911a26b18593', email: 'admin@satchida.com', role: 'ADMIN' },
    '06dcbc439fff4ce6a243efd3d5f49e30415671da3539b427d217917eee9545b8',
    { expiresIn: '1d' }
  );
  const refreshToken = jwt.sign(
    { id: '6adcd4f7fff2911a26b18593' },
    '0e75671ee7d86887f46b536a12e7caa9354fc39de081c994c2b37854ddc21c9b',
    { expiresIn: '30d' }
  );

  await context.addCookies([
    { name: 'token', value: token, domain: '127.0.0.1', path: '/' },
    { name: 'refreshToken', value: refreshToken, domain: '127.0.0.1', path: '/' }
  ]);

  const page = await context.newPage();

  try {
    console.log('Navigating to http://127.0.0.1:3080/c/new...');
    await page.goto('http://127.0.0.1:3080/c/new', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    console.log('Current URL:', page.url());
    await page.screenshot({ path: 'verify_authenticated_landing.png' });
    console.log('Saved screenshot to verify_authenticated_landing.png');

    const content = await page.content();
    const hasWatercolor = content.includes('Procedural Watercolor & Wash Art');
    const hasMath = content.includes('3B1B Math & Geometric Animation');
    const hasTag1 = content.includes('NumPy · 1080p Painting');
    const hasTag2 = content.includes('Vector · 60fps MP4');
    console.log('Card checks:', { hasWatercolor, hasMath, hasTag1, hasTag2 });

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await browser.close();
  }
})();
