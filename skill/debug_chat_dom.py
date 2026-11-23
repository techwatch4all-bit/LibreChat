from playwright.sync_api import sync_playwright

def inspect_chat():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 950})
        page.goto("http://localhost:3080/login")
        page.wait_for_timeout(2000)
        
        email_input = page.locator('input[type="email"]')
        if email_input.count() > 0 and email_input.first.is_visible():
            email_input.first.fill("admin@satchida.com")
            page.locator('input[type="password"]').first.fill("admin123")
            page.locator('button[type="submit"]').first.click()
            page.wait_for_timeout(3000)

        page.goto("http://localhost:3080/c/808222c0-6646-5d1a-9025-ae2c7c3a75a1")
        page.wait_for_timeout(4000)

        main_elem = page.locator('main')
        print("Main text length:", len(main_elem.inner_text()))
        print("Main text sample:\n", main_elem.inner_text()[:600])

        buttons = page.locator('button').all_inner_texts()
        print("Buttons found:", [b.strip() for b in buttons if b.strip()])

        browser.close()

if __name__ == "__main__":
    inspect_chat()
