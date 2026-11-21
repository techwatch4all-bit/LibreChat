import glob
import json
import os
import re

# 1. Base curated prompts dictionary for core presets
prompts = {
    # Core Effects
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
    'letterbox': 'Add cinematic 2.39:1 widescreen anamorphic black matte letterbox bars along the top and bottom.',
    'instant photo': 'Frame the shot in an authentic Polaroid-style instant photo frame with retro nostalgic borders.',
    'film strip': 'Present the footage within an analog 35mm sprocketed film strip aesthetic moving smoothly.',
    'camera viewfinder': 'Overlay a camera HUD viewfinder with record tally, crosshair focus grid, and battery telemetry.',
    'neon frame': 'Surround the frame with vibrant glowing cyberpunk neon borders in pulsating electric magenta and cyan.',
    'gold dust': 'Scatter warm luxurious gold dust flecks shimmering and floating down like fairy dust.',
    'fireflies': 'Add glowing warm fireflies drifting gently in the evening ambient atmosphere.',
    'bokeh lights': 'Layer dreamy out-of-focus soft hexagonal bokeh light orbs floating across the scene.',
    'blossom storm': 'Swirl an energetic flurry of spring flower petals rushing across the shot.',
    'autumn leaves': 'Float rustic golden and auburn autumn leaves fluttering down gently.',
    'smoke': 'Introduce soft cinematic volumetric smoke or fog rolling smoothly through the lower frame.',
    'embers': 'Float glowing fiery embers and sparks rising slowly from below.',
    'aurora': 'Cast enchanting vibrant green and violet northern lights aurora shimmer across the sky.',
    'underwater light': 'Project shimmering underwater sun caustics dancing rhythmically over the subjects.',
    'rainbow leak': 'Cast delicate prismatic rainbow light flares dispersing across the edge of the lens.',
    'camcorder': 'Apply a vintage 90s VHS-C camcorder overlay with SP/PLAY indicators and tracking distortion.',

    # Core Transitions
    'cross dissolve': 'Apply a smooth, cinematic cross dissolve transition blending seamlessly into the next scene.',
    'dip to black': 'Fade the transition smoothly through a cinematic deep black dip.',
    'dip to white': 'Transition with an elegant overexposed dip to white flash.',
    'fade in': 'Gradually fade in from pure black into the opening shot.',
    'fade out': 'Gently fade out into deep black at the close of the shot.',
    'audio crossfade': 'Apply a seamless smooth audio crossfade between consecutive soundbeds.',
    'light sweep': 'Transition across cuts with a horizontal luminous light sweep.',
    'flare whip': 'Whip pan between shots accompanied by a rapid cinematic anamorphic flare burst.',
    'color wipe': 'Wipe across the scene with a dynamic stylized color gradient sweep.',
    'overexposure': 'Transition using an artistic momentary overexposure blooming effect.',
    'push left': 'Push smoothly into the incoming shot moving from right to left.',
    'push right': 'Push smoothly into the incoming shot moving from left to right.',
    'push up': 'Push upward into the following clip with crisp kinetic motion.',
    'push down': 'Push downward into the next scene with confident framing.',

    # Captions & Text
    'new captions': 'Generate and align accurate word-level synchronized captions with elegant modern typography.',
    'from speech': 'Automatically transcribe spoken dialogue into synchronized subtitles with subtitle styling.',
    'subtitle file': 'Import and burn in synchronized WebVTT subtitles with high-contrast legibility.',
    'default text': 'Add a modern, high-contrast text overlay with clear editorial styling.',
    'bouncing title': 'Introduce a punchy animated bouncing title with kinetic typography spring dynamics.',
    'split reveal title': 'Reveal the title card using a clean architectural split reveal animation.',
    'sweep box title': 'Present the subject with a sleek contemporary sweep box lower-third title.',
    'minimal serif title': 'Display an understated luxury title in timeless minimal editorial serif typography.',

    # Core Templates
    'travel diary': 'Style into an energetic, uplifting travel diary montage with pacing, location stamps, and film warmth.',
    'weekend vlog': 'Format into a cozy, aesthetic weekend vlog with warm film grain, bounce titles, and relaxed vibes.',
    'film opening': 'Structure into a dramatic widescreen film opening with cinematic intro titles and atmospheric tone.',
    'brand opener': 'Produce a polished, premium brand teaser opener with crisp logo reveals and modern cuts.',
    'quick cuts': 'Edit into high-tempo rhythmic quick cuts synchronized precisely on the beat.',
}

# 2. Built-in sound effects (sounds/ folder)
builtin_sounds = {
    'boom': 'Add a deep cinematic sub-bass boom impact accentuating the dramatic moment.',
    'buzz': 'Insert an authentic electric neon or phone vibration buzz sound cue.',
    'click': 'Add a crisp tactile interface UI click sound effect.',
    'ding': 'Play a bright crystalline bell chime ding notification cue.',
    'drop': 'Add a heavy cinematic bass drop impact resonant throughout the scene.',
    'hit': 'Add a hard-hitting acoustic punch impact sound synchronized with the action.',
    'kick': 'Drive the beat with a punchy deep kick drum accent.',
    'notify': 'Trigger a friendly modern bell notification audio tone.',
    'notification': 'Trigger a friendly modern bell notification audio tone.',
    'pop': 'Add a light playful bubble pop sound accentuating the visual pop.',
    'riser': 'Build anticipation with a rising cinematic tension whoosh riser.',
    'shutter': 'Add an authentic mechanical camera shutter snap sound effect.',
    'swish': 'Synchronize a fast, airy swish whoosh sound effect with the swift movement.',
    'tick': 'Add a precise analog clock tick-tock cadence enhancing time urgency.',
    'typing': 'Overlay realistic mechanical keyboard typing foley synchronized to on-screen text.',
    'waves': 'Layer calming natural ocean waves lapping against the shore.',
    'whoosh': 'Add a dynamic whoosh transition sound emphasizing the screen sweep.',
    'whoosh-low': 'Layer a deep, low-frequency whoosh sweeping across the transition.',
    'low whoosh': 'Layer a deep, low-frequency whoosh sweeping across the transition.',
    'wind': 'Introduce atmospheric howling mountain wind and outdoor air currents.',
    'zap': 'Insert an energetic electric spark zap sound effect.',
    'camera shutter': 'Add an authentic mechanical camera shutter snap sound effect.',
    'phone buzz': 'Insert a realistic vibrating smartphone haptic buzz sound cue.',
}
for k, v in builtin_sounds.items():
    prompts[k] = v

# 3. Voices (voices.json) - handle missing/None descriptions safely
voices_count = 0
try:
    voices_file = r'C:\Users\WinDiesel\AppData\Local\npm-cache\_npx\ab5ca1f87d8cabd8\node_modules\openfilm\library\voices.json'
    v_data = json.load(open(voices_file, 'r', encoding='utf-8'))
    for v in v_data.get('voices', []):
        name = (v.get('name') or '').strip()
        if not name:
            continue
        k = name.lower()
        desc = (v.get('description') or '').strip()
        if desc:
            short_desc = desc[:85].rstrip(' ,.;:')
            prompts[k] = f"Generate voiceover narration using '{name}' voice talent ({short_desc})."
        else:
            prompts[k] = f"Generate clear, natural voiceover narration using '{name}' voice talent."
        voices_count += 1
except Exception as e:
    print(f"Error parsing voices.json: {e}")

print(f"Loaded {voices_count} voices.")

# 4. Ingest catalog items from JSON files
catalogs_dir = r'C:\Users\WinDiesel\AppData\Local\npm-cache\_npx\ab5ca1f87d8cabd8\node_modules\openfilm\library\catalogs'
for json_file in glob.glob(os.path.join(catalogs_dir, '*.json')):
    base = os.path.basename(json_file).replace('.json', '')
    try:
        data = json.load(open(json_file, 'r', encoding='utf-8'))
        items = data.get('items', [])
        for it in items:
            name_obj = it.get('name')
            name_en = name_obj.get('en') if isinstance(name_obj, dict) else (name_obj if isinstance(name_obj, str) else '')
            if not name_en or len(name_en) < 2:
                continue
            key = name_en.strip().lower()
            if key in prompts:
                continue

            tags = it.get('tags', [])
            tag_str = ', '.join(tags[:3]) if tags else 'cinematic'

            if 'filter' in base:
                prompts[key] = f"Color grade the footage with '{name_en}' palette ({tag_str}), enhancing tonal depth, skin tones, and rich photographic contrast."
            elif 'transition' in base:
                prompts[key] = f"Apply an energetic '{name_en}' transition ({tag_str}) between shots with seamless cinematic motion."
            elif 'sticker' in base:
                prompts[key] = f"Overlay an animated '{name_en}' graphic sticker ({tag_str}) with clean vector styling and playful motion."
            elif 'motion' in base:
                prompts[key] = f"Animate the element with a smooth '{name_en}' motion entrance with natural easing and inertia."
            elif 'text' in base:
                prompts[key] = f"Add a stylized '{name_en}' animated text title card ({tag_str}) positioned cleanly over the scene."
            elif 'template' in base:
                prompts[key] = f"Assemble and style the scene according to the '{name_en}' template ({tag_str}) with tailored pacing and graphics."
            elif 'effect' in base:
                prompts[key] = f"Apply a '{name_en}' visual atmosphere overlay ({tag_str}) adding immersive environmental depth."
            else:
                prompts[key] = f"Apply the '{name_en}' styling preset with balanced visual polish and cinematic feel."
    except Exception as e:
        print(f"Error parsing {json_file}: {e}")

# 5. Ingest audio items (audio.json)
try:
    audio_file = r'C:\Users\WinDiesel\AppData\Local\npm-cache\_npx\ab5ca1f87d8cabd8\node_modules\openfilm\library\audio.json'
    audio_data = json.load(open(audio_file, 'r', encoding='utf-8'))
    for it in audio_data.get('items', []):
        name_obj = it.get('name')
        name_en = name_obj.get('en') if isinstance(name_obj, dict) else (name_obj if isinstance(name_obj, str) else '')
        if not name_en:
            continue
        key = name_en.strip().lower()
        if key in prompts:
            continue
        cat = it.get('cat', 'sound')
        tags = it.get('tags', [])
        tag_str = ', '.join(tags[:3]) if tags else 'ambient'

        if cat == 'music':
            prompts[key] = f"Score the background with '{name_en}' ({tag_str}) music bed, ducked smoothly beneath dialogue and foley."
        else:
            prompts[key] = f"Add crisp realistic '{name_en}' sound design foley ({tag_str}) synchronized tightly with the visual actions."
except Exception as e:
    print(f"Error parsing audio.json: {e}")

print(f"Total compiled dictionary size: {len(prompts)} presets.")

js_dict_str = json.dumps(prompts, ensure_ascii=False, separators=(',', ':'))

clean_base_html = open(r'C:\Users\WinDiesel\AppData\Local\npm-cache\_npx\ab5ca1f87d8cabd8\node_modules\openfilm\studio\ui\dist\index.html.clean', 'r', encoding='utf-8').read()
clean_base_html = clean_base_html.replace('<style>\n</body>\n</html>', '').replace('</body>\n</html>', '').strip()

complete_html = f"""{clean_base_html}

<style>
/* Satchida OpenFilm Student Prompt Assistant Overlay */
#satchida-assistant-badge {{
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
}}
@keyframes satchidaPop {{
  0% {{ transform: translateY(12px) scale(0.96); opacity: 0; }}
  100% {{ transform: translateY(0) scale(1); opacity: 1; }}
}}
#satchida-assistant-badge .icon-wrap {{
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
}}
#satchida-assistant-badge .text-wrap {{
  flex: 1;
  min-width: 0;
}}
#satchida-assistant-badge .title {{
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #c084fc;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}}
#satchida-assistant-badge .prompt-text {{
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.35;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}}
#satchida-assistant-badge .actions {{
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}}
#satchida-assistant-badge .btn-apply {{
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
}}
#satchida-assistant-badge .btn-apply:hover {{
  background: linear-gradient(135deg, #9333ea, #6d28d9);
  transform: translateY(-1px);
}}
#satchida-assistant-badge .btn-close {{
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
}}
#satchida-assistant-badge .btn-close:hover {{
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}}
</style>

<div id="satchida-assistant-container"></div>
<script>
(function() {{
  var EFFECT_PROMPTS = {js_dict_str};

  function showAssistantToast(effectName, promptText, categoryLabel) {{
    var container = document.getElementById('satchida-assistant-container');
    if (!container) return;

    var cat = categoryLabel || 'PRESET';

    container.innerHTML = `
      <div id="satchida-assistant-badge">
        <div class="icon-wrap">✨</div>
        <div class="text-wrap">
          <div class="title">Suggested Edit Prompt · ${{cat.toUpperCase()}} · ${{effectName.toUpperCase()}}</div>
          <div class="prompt-text" title="${{promptText.replace(/"/g, '&quot;')}}">"${{promptText}}"</div>
        </div>
        <div class="actions">
          <button class="btn-apply" id="satchida-btn-apply">Copy & Use</button>
          <button class="btn-close" id="satchida-btn-close">✕</button>
        </div>
      </div>
    `;

    document.getElementById('satchida-btn-apply').onclick = function() {{
      try {{
        navigator.clipboard.writeText(promptText);
      }} catch(e) {{}}

      try {{
        window.parent.postMessage({{
          type: 'OPENFILM_STUDIO_SUGGEST_PROMPT',
          effectName: effectName,
          prompt: promptText
        }}, '*');
      }} catch(e) {{}}

      var btn = document.getElementById('satchida-btn-apply');
      if (btn) {{
        btn.innerText = '✓ Staged in Chat!';
        btn.style.background = '#10b981';
      }}
      setTimeout(function() {{
        container.innerHTML = '';
      }}, 2500);
    }};

    document.getElementById('satchida-btn-close').onclick = function() {{
      container.innerHTML = '';
    }};

    // Auto-message parent immediately as well
    try {{
      window.parent.postMessage({{
        type: 'OPENFILM_STUDIO_SUGGEST_PROMPT',
        effectName: effectName,
        prompt: promptText
      }}, '*');
    }} catch(e) {{}}
  }}

  var IGNORED_LABELS = new Set([
    'media', 'skills', 'templates', 'captions', 'voices', 'sounds', 'music',
    'text', 'stickers', 'filters', 'effects', 'transitions', 'favorites',
    'library', 'all', 'texture', 'light', 'ambience', 'rhythm', 'frames',
    'retro', 'variety', 'dreamy', 'party', 'dissolve', 'desktop', 'edit',
    'update', 'export', 'properties', 'adjust', 'advanced', 'info', 'preview',
    'stage', 'frame rate', 'click to apply in chat', 'copy & use',
    'featured', 'services', 'imported', 'upload', 'mine', 'word art',
    'animated', 'animated stickers', 'film', 'upbeat', 'warm', 'emotional',
    'calm', 'cinematic', 'tense', 'electronic', 'lo-fi', 'playful',
    'corporate', 'festive', 'vlog', 'interface', 'new text'
  ]);

  function handleInteraction(e) {{
    var el = e.target;
    if (!el || !el.closest) return;

    // Never fire for clicks inside the assistant badge itself, top nav tabs, or header
    if (el.closest('#satchida-assistant-container, nav, header')) {{
      return;
    }}

    // Only react to interactions inside the library dock (<aside>)
    var aside = el.closest('aside');
    if (!aside) {{
      return;
    }}

    // Walk up only within the clicked card/button (stop before aside/section/large containers)
    var testSegments = [];
    var cur = el;
    for (var i = 0; i < 4 && cur && cur !== aside && cur !== document.body; i++) {{
      if (cur.tagName === 'ASIDE' || cur.tagName === 'NAV' || cur.tagName === 'SECTION') {{
        break;
      }}
      var raw = (cur.innerText || cur.textContent || '').trim();
      // Ignore containers holding multiple cards
      if (raw && raw.length <= 90) {{
        var lines = raw.split('\\n');
        if (lines.length <= 4) {{
          for (var l = 0; l < lines.length; l++) {{
            var seg = lines[l].trim();
            if (seg) testSegments.push(seg);
          }}
        }}
      }}
      if (cur.getAttribute('title')) testSegments.push(cur.getAttribute('title').trim());
      if (cur.getAttribute('alt')) testSegments.push(cur.getAttribute('alt').trim());
      if (cur.getAttribute('data-id')) {{
        var did = cur.getAttribute('data-id').trim().split('/').pop();
        if (did) testSegments.push(did.replace(/-/g, ' '));
      }}
      // Stop once we hit a card boundary (.group) or button
      if (cur.classList && cur.classList.contains('group')) {{
        break;
      }}
      cur = cur.parentElement;
    }}

    // Fast O(1) exact-key match against the dictionary
    for (var j = 0; j < testSegments.length; j++) {{
      var segment = testSegments[j].toLowerCase();
      if (
        !segment ||
        IGNORED_LABELS.has(segment) ||
        /^(00:|01:|v\\d+|\\d+\\.?\\d*\\s*s|play|pause|mute|split|undo|redo|\\d+\\s*clips)/i.test(segment)
      ) {{
        continue;
      }}
      if (Object.prototype.hasOwnProperty.call(EFFECT_PROMPTS, segment)) {{
        showAssistantToast(testSegments[j], EFFECT_PROMPTS[segment], 'Library Item');
        return;
      }}
    }}
  }}

  document.addEventListener('click', handleInteraction, true);
  document.addEventListener('dragstart', handleInteraction, true);
}})();
</script>
</body>
</html>
"""

html_path = r'C:\Users\WinDiesel\AppData\Local\npm-cache\_npx\ab5ca1f87d8cabd8\node_modules\openfilm\studio\ui\dist\index.html'
open(html_path, 'w', encoding='utf-8').write(complete_html)
print(f"Successfully generated clean index.html ({len(complete_html)} bytes) with {len(prompts)} presets!")
