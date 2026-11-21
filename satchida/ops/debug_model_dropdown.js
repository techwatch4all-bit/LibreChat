const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  let configPayload = null;
  page.on('response', async res => {
    if (res.url().includes('/api/config')) {
      try {
        configPayload = await res.json();
        console.log('HTTP', res.status(), 'api/config response received.');
        console.log('modelSpecs count:', configPayload.modelSpecs?.list?.length);
        if (configPayload.modelSpecs?.list) {
          console.log('Specs received:', configPayload.modelSpecs.list.map(s => s.name));
        } else {
          console.log('No modelSpecs in api/config!');
        }
      } catch (e) {
        console.error('Failed to parse config json:', e.message);
      }
    }
  });

  await page.goto('http://127.0.0.1:3080/login');
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('#email');
  await page.fill('#email', 'dchat@satchida.local');
  await page.fill('#password', 'Demo@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  console.log('Logged in. Current URL:', page.url());

  const trigger = await page.$('[data-testid="model-selector-button"]');
  if (trigger) {
    console.log('Found model selector button. Text:', await trigger.innerText());
    await trigger.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'satchida/ops/debug_dropdown.png' });
    console.log('Saved debug_dropdown.png');
  } else {
    console.log('Model selector button not found!');
  }

  await browser.close();
})();
