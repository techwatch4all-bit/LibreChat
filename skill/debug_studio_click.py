import requests
from playwright.sync_api import sync_playwright

def inspect():
    s = requests.Session()
    s.post('http://localhost:3080/api/auth/login', json={'email': 'admin@satchida.com', 'password': 'admin123'})
    pw_cookies = [{'name': k, 'value': v, 'domain': 'localhost', 'path': '/'} for k, v in s.cookies.get_dict().items()]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1600, "height": 950})
        context.add_cookies(pw_cookies)
        page = context.new_page()
        page.goto("http://localhost:3080/c/28880f71-33f9-5b1f-9888-5d7bbcd1e2f8")
        page.wait_for_timeout(4000)

        btn = page.locator('button:has-text("Viewing Studio"), button:has-text("Launch Studio")').first
        if btn.is_visible():
            btn.click()
            page.wait_for_timeout(3000)

        btn_wb = page.locator('button:has-text("Studio Workbench")')
        btn_pv = page.locator('button:has-text("Omni-Motion View")')
        print("Studio Workbench class:", btn_wb.get_attribute("class"))
        print("Omni-Motion View class:", btn_pv.get_attribute("class"))

        # Check if clicking Omni-Motion View toggles it
        print("Clicking Omni-Motion View button...")
        btn_pv.click()
        page.wait_for_timeout(3000)
        
        print("After click:")
        print("Studio Workbench class:", btn_wb.get_attribute("class"))
        print("Omni-Motion View class:", btn_pv.get_attribute("class"))

        page.screenshot(path=r"C:\Users\WinDiesel\.gemini\antigravity\brain\63fe73f5-8098-44bf-8a2a-7efde29d54dc\omni_motion_clicked.png")
        print("Screenshot taken!")

        browser.close()

if __name__ == "__main__":
    inspect()
