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

        # Inspect iframes inside the page
        iframes = page.locator('iframe')
        print("Total iframes on page:", iframes.count())
        for i in range(iframes.count()):
            ifr = iframes.nth(i)
            print(f"Iframe {i}: src={ifr.get_attribute('src')}, title={ifr.get_attribute('title')}")

        browser.close()

if __name__ == "__main__":
    inspect()
