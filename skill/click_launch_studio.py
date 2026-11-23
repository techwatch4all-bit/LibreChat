import requests
from playwright.sync_api import sync_playwright

s = requests.Session()
r = s.post('http://localhost:3080/api/auth/login', json={'email': 'admin@satchida.com', 'password': 'admin123'})
cookies_dict = s.cookies.get_dict()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1600, "height": 950})
    context.add_cookies([{'name': k, 'value': v, 'domain': 'localhost', 'path': '/'} for k, v in cookies_dict.items()])
    page = context.new_page()
    page.goto('http://localhost:3080/c/808222c0-6646-5d1a-9025-ae2c7c3a75a1')
    page.wait_for_timeout(4000)

    # Click 'Launch Studio & Edit'
    btn = page.locator('button:has-text("Launch Studio")').first
    print("Found Launch Studio button:", btn.inner_text())
    btn.click()
    print("Clicked Launch Studio button, waiting 4s for OpenFilmStudio to open and start playback...")
    page.wait_for_timeout(4000)

    # Let's inspect iframes
    print("Frames count:", len(page.frames))
    for i, f in enumerate(page.frames):
        print(f"Frame {i}: url={f.url}")

    # Check playhead time and audio inside iframe
    film_frame = None
    for f in page.frames:
        if 'neon_cyberpunk_sunset_clip.html' in f.url:
            film_frame = f
            break

    if film_frame:
        print("Found film_frame!")
        state = film_frame.evaluate("""() => {
            const bgAudio = document.getElementById('bgm');
            return {
                currentT: window.__CURRENT_T__,
                hasBgAudio: !!bgAudio,
                bgAudioSrc: bgAudio ? bgAudio.src : null,
                bgAudioPaused: bgAudio ? bgAudio.paused : null,
                bgAudioCurrentTime: bgAudio ? bgAudio.currentTime : null,
                canvasWidth: document.getElementById('c') ? document.getElementById('c').width : null,
            };
        }""")
        print("Film Frame State:", state)

    # Capture verified screenshot of the studio playing
    shot_path = r"C:\Users\WinDiesel\.gemini\antigravity\brain\63fe73f5-8098-44bf-8a2a-7efde29d54dc\neon_scenario_studio_verified.png"
    page.screenshot(path=shot_path)
    print("Captured screenshot to:", shot_path)

    browser.close()
