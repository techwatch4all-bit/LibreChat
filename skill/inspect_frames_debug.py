import requests
from playwright.sync_api import sync_playwright

def inspect_frames():
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

        for i, frame in enumerate(page.frames):
            print(f"Frame {i}: url={frame.url}")
            body_html = frame.evaluate('() => document.body ? document.body.innerHTML.slice(0, 300) : "no body"')
            print(f"  Snippet: {body_html}")

        browser.close()

if __name__ == "__main__":
    inspect_frames()
