with open(r'C:\Users\WinDiesel\AppData\Local\npm-cache\_npx\ab5ca1f87d8cabd8\node_modules\openfilm\studio\ui\dist\index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the previous injection with a comprehensive floating overlay inside Studio iframe
idx = text.find('<script>\n/**\n * Satchida Studio / OpenFilm Student')
if idx != -1:
    text = text[:idx] + '</body>\n</html>\n'

new_script = """
<style>
/* Satchida OpenFilm Student Prompt Assistant Overlay */
#satchida-assistant-badge {
  position: fixed;
  bottom: 14px;
  right: 18px;
  z-index: 999999;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 620px;
  padding: 10px 16px;
  background: rgba(15, 23, 42, 0.94);
  border: 1px solid rgba(139, 92, 246, 0.6);
  border-radius: 14px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.7), 0 0 20px rgba(139, 92, 246, 0.25);
  backdrop-filter: blur(12px);
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  animation: satchidaPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  transition: all 0.2s ease;
}
@keyframes satchidaPop {
  0% { transform: translateY(12px) scale(0.96); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
#satchida-assistant-badge .icon-wrap {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.35), rgba(139, 92, 246, 0.15));
  border: 1px solid rgba(168, 85, 247, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
#satchida-assistant-badge .text-wrap {
  flex: 1;
  min-width: 0;
}
#satchida-assistant-badge .title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #c084fc;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}
#satchida-assistant-badge .prompt-text {
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.35;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#satchida-assistant-badge .actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
#satchida-assistant-badge .btn-apply {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  color: #ffffff;
  padding: 6px 12px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35);
  transition: transform 0.15s, background 0.15s;
}
#satchida-assistant-badge .btn-apply:hover {
  background: linear-gradient(135deg, #9333ea, #6d28d9);
  transform: translateY(-1px);
}
#satchida-assistant-badge .btn-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
}
#satchida-assistant-badge .btn-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}
</style>

<div id="satchida-assistant-container"></div>

<script>
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

  function showAssistantToast(effectName, promptText) {
    var container = document.getElementById('satchida-assistant-container');
    if (!container) return;

    container.innerHTML = `
      <div id="satchida-assistant-badge">
        <div class="icon-wrap">✨</div>
        <div class="text-wrap">
          <div class="title">Suggested Edit Prompt · ${effectName.toUpperCase()}</div>
          <div class="prompt-text" title="${promptText}">"${promptText}"</div>
        </div>
        <div class="actions">
          <button class="btn-apply" id="satchida-btn-apply">Copy & Use</button>
          <button class="btn-close" id="satchida-btn-close">✕</button>
        </div>
      </div>
    `;

    document.getElementById('satchida-btn-apply').onclick = function() {
      // 1. Copy to clipboard
      try {
        navigator.clipboard.writeText(promptText);
      } catch(e) {}

      // 2. Notify parent LibreChat chat frame
      try {
        window.parent.postMessage({
          type: 'OPENFILM_STUDIO_SUGGEST_PROMPT',
          effectName: effectName,
          prompt: promptText
        }, '*');
      } catch(e) {}

      var btn = document.getElementById('satchida-btn-apply');
      if (btn) {
        btn.innerText = '✓ Staged in Chat!';
        btn.style.background = '#10b981';
      }
      setTimeout(function() {
        container.innerHTML = '';
      }, 2500);
    };

    document.getElementById('satchida-btn-close').onclick = function() {
      container.innerHTML = '';
    };

    // Auto-message parent immediately as well
    try {
      window.parent.postMessage({
        type: 'OPENFILM_STUDIO_SUGGEST_PROMPT',
        effectName: effectName,
        prompt: promptText
      }, '*');
    } catch(e) {}
  }

  function handleInteraction(e) {
    var el = e.target;
    if (!el) return;

    var candidate = el.closest('[data-id], [data-name], button, div');
    var rawText = (candidate ? (candidate.innerText || candidate.textContent || '') : '').trim();
    var lowerText = rawText.toLowerCase();

    for (var key in EFFECT_PROMPTS) {
      if (
        lowerText.indexOf(key) !== -1 ||
        (el.title && el.title.toLowerCase().indexOf(key) !== -1) ||
        (el.alt && el.alt.toLowerCase().indexOf(key) !== -1) ||
        (candidate && candidate.getAttribute('data-id') && candidate.getAttribute('data-id').toLowerCase().indexOf(key.replace(' ', '-')) !== -1)
      ) {
        showAssistantToast(key, EFFECT_PROMPTS[key]);
        break;
      }
    }
  }

  // Listen to both click and dragstart so dragging to timeline triggers prompt suggestion too!
  document.addEventListener('click', handleInteraction, true);
  document.addEventListener('dragstart', handleInteraction, true);
})();
</script>
</body>
</html>
"""

text = text.replace('</body>\n</html>', '').replace('</body>', '').replace('</html>', '') + new_script

with open(r'C:\Users\WinDiesel\AppData\Local\npm-cache\_npx\ab5ca1f87d8cabd8\node_modules\openfilm\studio\ui\dist\index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Successfully injected floating assistant overlay into Studio index.html!")
