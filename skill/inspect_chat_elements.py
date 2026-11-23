import requests
from playwright.sync_api import sync_playwright

s = requests.Session()
r = s.post('http://localhost:3080/api/auth/login', json={'email': 'admin@satchida.com', 'password': 'admin123'})
cookies_dict = s.cookies.get_dict()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1600, 'height': 950})
    context.add_cookies([{'name': k, 'value': v, 'domain': 'localhost', 'path': '/'} for k, v in cookies_dict.items()])
    page = context.new_page()
    page.goto('http://localhost:3080/c/808222c0-6646-5d1a-9025-ae2c7c3a75a1')
    page.wait_for_timeout(4000)

    # Let's inspect all elements containing text 'Neon Cyberpunk' or 'Studio'
    elements = page.locator('main button, main a, main [data-testid]').all()
    print("Found total interactive elements in main:", len(elements))
    for i, el in enumerate(elements):
        txt = el.inner_text().strip().replace('\n', ' ')
        if txt and len(txt) < 80:
            print(f"Elem {i}: tag={el.evaluate('e => e.tagName')}, text='{txt}'")

    browser.close()
