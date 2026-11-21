import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1440, 'height': 900})
        await page.goto('http://127.0.0.1:3080/login')
        await page.wait_for_timeout(1500)
        
        email_inp = await page.query_selector('input[name="email"]')
        if email_inp:
            await page.fill('input[name="email"]', 'admin@satchida.com')
            await page.fill('input[name="password"]', 'Admin@123456')
            await page.click('button[type="submit"]')
            await page.wait_for_timeout(3500)

        print('Current URL after login:', page.url)

        # Check studio library button in left navigation rail
        studio_btn = await page.query_selector('[data-testid="nav-studio-library-rail-button"]')
        print('Studio Library Button present:', studio_btn is not None)

        # Check IDE Nav link
        ide_btn = await page.query_selector('[data-testid="nav-panel-ide"]')
        print('IDE Nav link present:', ide_btn is not None)

        await page.screenshot(path='verify_restored_sidebar_auth.png')

        # Navigate to /projects (rebuilt OpenCode studio)
        await page.goto('http://127.0.0.1:3080/projects')
        await page.wait_for_timeout(3500)
        await page.screenshot(path='verify_restored_opencode_auth.png')
        print('Navigated to /projects, current page URL:', page.url)

        # Test Studio Library button click
        await page.goto('http://127.0.0.1:3080/c/new')
        await page.wait_for_timeout(2000)
        btn = await page.query_selector('[data-testid="nav-studio-library-rail-button"]')
        if btn:
            await btn.click()
            await page.wait_for_timeout(2500)
            await page.screenshot(path='verify_restored_studio_panel_auth.png')
            print('Studio Library panel opened & screenshot captured')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
