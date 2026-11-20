import os

html_path = r'C:\Users\WinDiesel\AppData\Local\npm-cache\_npx\ab5ca1f87d8cabd8\node_modules\openfilm\studio\ui\dist\index.html'

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

injection = """
<script>
/**
 * Satchida Studio / OpenFilm Student & Non-Technical Prompt Assistant
 * Auto-detects clicks on effects, filters, templates, transitions, and stickers
 * and sends rich, beginner-friendly actionable prompts to the parent chat.
 */
(function() {
  var EFFECT_PROMPTS = {
    'film grain': 'Apply cinematic 35mm film grain with subtle analog texture and warm vintage depth across the video.',
    'vignette': 'Add a soft optical vignette around the outer edges to naturally draw viewer focus into the central subject.',
    'old film': 'Give the video an authentic retro 16mm/8mm film look with gentle flicker, dust specks, and warm sepia tones.',
    'scan lines': 'Apply subtle CRT retro monitor scan lines with mild horizontal raster for a nostalgic tech aesthetic.',
    'light leak': 'Introduce warm golden-hour light leaks drifting organically across the lens from the upper corner.',
    'lens flare': 'Add an anamorphic horizontal lens flare streak with soft chromatic aberration aligned to the bright light source.',
    'light rays': 'Project cinematic volumetric light rays (god rays) streaming through the atmosphere and mist.',
    'snow': 'Overlay gentle, realistic falling snowflakes drifting slowly across the frame with natural depth.',
    'rain': 'Add realistic falling rain with subtle atmospheric mist and delicate water drop motion blur.',
    'sparkles': 'Layer magical soft-glow sparkle particles twinkling and drifting across the scene.',
    'confetti': 'Trigger a celebratory burst of colorful festive confetti fluttering through the air.',
    'petals': 'Float delicate cherry blossom petals swirling smoothly through the foreground breeze.',
    'bubbles': 'Add playful translucent iridescent floating bubbles drifting upward across the screen.',
    'flash': 'Insert a quick, high-energy photographic shutter flash transition for rhythmic impact.',
    'heartbeat': 'Apply a gentle, rhythmic heartbeat pulse zoom with subtle chromatic edge distortion.',
    'glitch': 'Introduce modern digital glitch artifacts with RGB color splitting and scan-line displacement.',
    'letterbox': 'Add cinematic 2.39:1 widescreen anamorphic letterboxing bars to give the video an authentic movie aspect ratio.',
    'instant photo': 'Frame the scene inside an authentic instant Polaroid photo border with vintage warm color grading.',
    'film strip': 'Wrap the footage in a classic cinema 35mm film perforation strip border.',
    'camera view': 'Overlay a professional cinema camera viewfinder HUD with frame guides, battery indicator, and recording tally dot.',
    'neon frame': 'Add a pulsing cyberpunk neon glowing border around the edges with electric violet and cyan hues.',
    'aurora': 'Cast ethereal green and violet northern lights aurora ribbons shimmering across the upper sky.',
    'autumn leaves': 'Float golden and amber autumn maple leaves fluttering gracefully across the camera view.',
    'fireflies': 'Sprinkle gentle glowing fireflies hovering and drifting softly in the twilight atmosphere.',
    'gold dust': 'Scatter warm luxurious gold dust flecks shimmering and floating down like fairy dust.'
  };

  document.addEventListener('click', function(e) {
    var target = e.target;
    if (!target) return;
    
    // Find closest item container
    var itemEl = target.closest('[data-id], [data-name], button, div');
    var rawText = (itemEl ? (itemEl.innerText || itemEl.textContent || '') : '').trim();
    var lowerText = rawText.toLowerCase();

    // Check matching effect name
    for (var key in EFFECT_PROMPTS) {
      if (lowerText.indexOf(key) !== -1 || (target.title && target.title.toLowerCase().indexOf(key) !== -1)) {
        var promptText = EFFECT_PROMPTS[key];
        try {
          window.parent.postMessage({
            type: 'OPENFILM_STUDIO_SUGGEST_PROMPT',
            effectName: key,
            prompt: promptText
          }, '*');
        } catch(err) {}
        break;
      }
    }
  }, true);
})();
</script>
"""

if 'OPENFILM_STUDIO_SUGGEST_PROMPT' not in html:
    html = html.replace('</body>', injection + '\n</body>')
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print("Injected click listener script into OpenFilm Studio index.html successfully!")
else:
    print("Script already present in index.html")
