import requests
from playwright.sync_api import sync_playwright

def inspect_authenticated_chat():
    # 1. Login via REST to obtain session cookies
    s = requests.Session()
    r = s.post('http://localhost:3080/api/auth/login', json={'email': 'admin@satchida.com', 'password': 'admin123'})
    cookies_dict = s.cookies.get_dict()
    print("REST Login status:", r.status_code, "Cookies:", cookies_dict.keys())

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1600, "height": 950})
        
        # Inject cookies
        playwright_cookies = [
            {
                "name": k,
                "value": v,
                "domain": "localhost",
                "path": "/"
            }
            for k, v in cookies_dict.items()
        ]
        context.add_cookies(playwright_cookies)

        page = context.new_page()
        print("Navigating directly to /c/808222c0-6646-5d1a-9025-ae2c7c3a75a1...")
        page.goto("http://localhost:3080/c/808222c0-6646-5d1a-9025-ae2c7c3a75a1")
        page.wait_for_timeout(5000)

        # Screenshot the full chat view
        chat_shot = r"C:\Users\WinDiesel\.gemini\antigravity\brain\63fe73f5-8098-44bf-8a2a-7efde29d54dc\neon_scenario_chat_view.png"
        page.screenshot(path=chat_shot)
        print("Captured full chat view screenshot:", chat_shot)

        # Check for Studio button / card
        studio_btn = page.locator('button:has-text("Viewing Studio"), button:has-text("Launch Studio"), button:has-text("Open Studio"), button:has-text("View in Studio"), button:has-text("Studio")')
        print("Studio button count:", studio_btn.count())
        
        # Click the studio button if found
        for i in range(studio_btn.count()):
            btn = studio_btn.nth(i)
            text = btn.inner_text().strip()
            print(f"Button {i}: '{text}'")
            if "Studio" in text:
                print(f"Clicking button {i}: '{text}'")
                btn.click()
                break

        page.wait_for_timeout(5000)

        # Inspect frames
        print("Frames found:")
        for idx, frame in enumerate(page.frames):
            print(f"  Frame {idx}: name='{frame.name}', url='{frame.url}'")

        # Capture Studio screenshot
        studio_shot = r"C:\Users\WinDiesel\.gemini\antigravity\brain\63fe73f5-8098-44bf-8a2a-7efde29d54dc\neon_scenario_studio_verified.png"
        page.screenshot(path=studio_shot)
        print("Captured Studio panel screenshot:", studio_shot)

        browser.close()

if __name__ == "__main__":
    inspect_authenticated_chat()
