import requests, json
from playwright.sync_api import sync_playwright

def run():
    # 1. Login to get fresh tokens/cookies
    s = requests.Session()
    r = s.post('http://localhost:3080/api/auth/login', json={'email': 'admin@satchida.com', 'password': 'admin123'})
    cookies_dict = s.cookies.get_dict()
    print("REST Login status:", r.status_code)

    pw_cookies = [
        {"name": k, "value": v, "domain": "localhost", "path": "/"}
        for k, v in cookies_dict.items()
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1600, "height": 950})
        context.add_cookies(pw_cookies)
        page = context.new_page()

        print("Navigating to http://localhost:3080/c/new...")
        page.goto("http://localhost:3080/c/new")
        page.wait_for_timeout(3500)

        textarea = page.locator("textarea").first
        if not textarea.is_visible():
            print("Textarea not visible, checking page state...")
            page.screenshot(path=r"C:\Users\WinDiesel\.gemini\antigravity\brain\63fe73f5-8098-44bf-8a2a-7efde29d54dc\fresh_start_debug.png")
            browser.close()
            return

        prompt = (
            "Generate a brand new procedural art scenario from scratch: "
            "Scenario: Neon Cyberpunk Sunset — A giant striped retro sun centered over an infinite perspective laser grid road with distant neon skyscrapers and flying speeders. "
            "Style: synthwave. Resolution: 1920x1080. "
            "IMPORTANT: Do not reuse Coastline 1987 or gallery templates! Use scene_py to compose the custom scene with central sun and grid road. "
            "Also generate smooth analog ambient music and an active living landscape motion clip."
        )

        print("Typing prompt...")
        textarea.fill(prompt)
        page.wait_for_timeout(1000)

        print("Submitting prompt...")
        send_btn = page.locator('button[data-testid="send-button"], button[aria-label="Send message"], button:has-text("Send")').first
        if send_btn.is_visible():
            send_btn.click()
        else:
            textarea.press("Enter")

        print("Prompt submitted! Waiting for tools and response generation...")
        start_time = page.evaluate("() => Date.now()")
        
        # Monitor progress up to 90 seconds
        for tick in range(18):
            page.wait_for_timeout(5000)
            elapsed = (page.evaluate("() => Date.now()") - start_time) / 1000
            url = page.url
            print(f"[{elapsed:.1f}s] Current URL: {url}")
            
            # Check if generation finished (stop button disappears, send button returns)
            stop_btn = page.locator('button[aria-label="Stop generating"], button[data-testid="stop-button"]')
            if stop_btn.count() == 0 and tick > 2:
                print("Generation complete or idle!")
                break

        page.wait_for_timeout(4000)
        shot1 = r"C:\Users\WinDiesel\.gemini\antigravity\brain\63fe73f5-8098-44bf-8a2a-7efde29d54dc\fresh_custom_chat_view.png"
        page.screenshot(path=shot1)
        print("Captured chat screenshot:", shot1)

        # Check for Launch Studio button
        studio_btn = page.locator('button:has-text("Launch Studio"), button:has-text("Viewing Studio"), button:has-text("View in Studio")')
        print("Studio button count:", studio_btn.count())
        if studio_btn.count() > 0:
            print("Clicking studio button:", studio_btn.first.inner_text())
            studio_btn.first.click()
            page.wait_for_timeout(5000)

            # Check iframes
            for f in page.frames:
                print("Frame url:", f.url)
                if 'html' in f.url:
                    state = f.evaluate("""() => {
                        const bgAudio = document.getElementById('bgm');
                        return {
                            t: window.__CURRENT_T__,
                            hasAudio: !!bgAudio,
                            audioPaused: bgAudio ? bgAudio.paused : null,
                            audioSrc: bgAudio ? bgAudio.src : null,
                            audioTime: bgAudio ? bgAudio.currentTime : null
                        };
                    }""")
                    print("Film state:", state)

            shot2 = r"C:\Users\WinDiesel\.gemini\antigravity\brain\63fe73f5-8098-44bf-8a2a-7efde29d54dc\fresh_custom_studio_playing.png"
            page.screenshot(path=shot2)
            print("Captured studio playing screenshot:", shot2)

        browser.close()

if __name__ == "__main__":
    run()
