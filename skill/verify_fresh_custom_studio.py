import requests
from playwright.sync_api import sync_playwright

def verify():
    s = requests.Session()
    r = s.post('http://localhost:3080/api/auth/login', json={'email': 'admin@satchida.com', 'password': 'admin123'})
    cookies_dict = s.cookies.get_dict()

    pw_cookies = [
        {"name": k, "value": v, "domain": "localhost", "path": "/"}
        for k, v in cookies_dict.items()
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1600, "height": 950})
        context.add_cookies(pw_cookies)
        page = context.new_page()

        conv_url = "http://localhost:3080/c/28880f71-33f9-5b1f-9888-5d7bbcd1e2f8"
        print(f"Navigating to {conv_url}...")
        page.goto(conv_url)
        page.wait_for_timeout(4000)

        # 1. Capture chat screenshot
        chat_shot = r"C:\Users\WinDiesel\.gemini\antigravity\brain\63fe73f5-8098-44bf-8a2a-7efde29d54dc\custom_synthwave_chat_verified.png"
        page.screenshot(path=chat_shot)
        print("Captured chat view screenshot:", chat_shot)

        # 2. Click Launch Studio
        btn = page.locator('button:has-text("Launch Studio"), button:has-text("Viewing Studio"), button:has-text("View in Studio")').first
        if btn.is_visible():
            print("Clicking studio button:", btn.inner_text())
            btn.click()
            page.wait_for_timeout(5000)

            # Check film iframe state
            for f in page.frames:
                if 'fresh_neon_sunset_film.html' in f.url:
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
                    print("Studio film state:", state)

            studio_shot = r"C:\Users\WinDiesel\.gemini\antigravity\brain\63fe73f5-8098-44bf-8a2a-7efde29d54dc\custom_synthwave_studio_playing.png"
            page.screenshot(path=studio_shot)
            print("Captured studio playing screenshot:", studio_shot)

        browser.close()

if __name__ == "__main__":
    verify()
