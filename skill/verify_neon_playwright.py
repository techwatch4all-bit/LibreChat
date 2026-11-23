import sys, time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1600, "height": 950})
        page = context.new_page()

        print("Navigating to login page...")
        page.goto("http://localhost:3080/login")
        page.wait_for_timeout(2000)

        # Log in if needed
        email_input = page.locator('input[type="email"], input[name="email"]')
        if email_input.count() > 0 and email_input.first.is_visible():
            print("Logging in as admin@satchida.com...")
            email_input.first.fill("admin@satchida.com")
            page.locator('input[type="password"], input[name="password"]').first.fill("admin123")
            page.locator('button[type="submit"]').first.click()
            page.wait_for_timeout(3000)

        print("Navigating to conversation 808222c0-6646-5d1a-9025-ae2c7c3a75a1...")
        page.goto("http://localhost:3080/c/808222c0-6646-5d1a-9025-ae2c7c3a75a1")
        page.wait_for_timeout(5000)

        # Screenshot chat
        page.screenshot(path=r"C:\Users\WinDiesel\.gemini\antigravity\brain\63fe73f5-8098-44bf-8a2a-7efde29d54dc\neon_scenario_chat_view.png")
        print("Captured neon_scenario_chat_view.png")

        # Find viewing studio / launch button
        studio_btn = page.locator('button:has-text("Viewing Studio"), button:has-text("Launch Studio"), button:has-text("View in Studio")')
        print("Studio buttons found:", studio_btn.count())
        if studio_btn.count() > 0:
            studio_btn.first.click()
            print("Clicked Studio button, waiting 5s for playback...")
            page.wait_for_timeout(5000)
            
            # Inspect iframe
            iframes = page.frames
            print("Frame count:", len(iframes))
            for f in iframes:
                print("Frame url:", f.url)

            # Screenshot Studio
            page.screenshot(path=r"C:\Users\WinDiesel\.gemini\antigravity\brain\63fe73f5-8098-44bf-8a2a-7efde29d54dc\neon_scenario_studio_verified.png")
            print("Captured neon_scenario_studio_verified.png")

        browser.close()

if __name__ == "__main__":
    run()
