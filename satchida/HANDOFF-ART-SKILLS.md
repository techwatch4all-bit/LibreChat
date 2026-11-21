# HANDOFF — Satchida Art Skills, MCP Bridge, Studio Presets (2026-11-20)

Audience: any AI/engineer finishing the remaining translation tail. Everything else is DONE and
verified live. Work only inside `D:\LAN-AI-Infra\LibreChat`. Read `AGENTS.md` first (hard rules:
English-only, self-containment, UI confinement, Mimosa hook blocks Bash writes to repo source —
use Edit/Write tools).

## 1. DONE (do not redo)

| Item | State |
| --- | --- |
| `skill/satchida-procedural-art` (from cloveric/claude-drawing-skill, MIT) | COMPLETE. English-only, 0 Chinese files; SKILL.md loader-valid (kebab-case name, desc 1003 chars, body ~10k); 172 .py compile clean; PROVENANCE.md, docs/style-api.md, docs/defect-checklists.md (83 style tables); 83 vendored previews in `client/public/assets/art-presets/` mirrored to dist; repos/ mirror synced. |
| `skill/satchida-motion-art` (from alchaincyf/huashu-art-motion, MIT) | Docs COMPLETE (SKILL.md, references/, grammar/, READMEs, PROVENANCE, CHANGELOG/CONTRIBUTING; 0 Chinese outside scripts/). Shot-list template ALIGNED to lint parser (`Time/Subject/Action/Camera/On-screen text/Method` + pre-table `Character:`); lint smoke test on template example = green. Showcase assets (clawd/mario) RESTORED per operator decision (repo is MIT). |
| `skill/satchida-art-server.py` MCP tools | COMPLETE, live in the Unified Hub (21 servers / 104 tools). `generate_procedural_art` (quality gate `_validate_render`, alias map `STYLE_EXAMPLE_ALIASES`), `create_kinetic_motion_clip` (returns small `embed_artifact` iframe wrapper + full `artifact_html`; optional MP4 via motion server — reads key `filename`), `list_procedural_art_styles`, `list_motion_grammars`. |
| librechat.yaml prompt routing | DONE in Chat, Work, Study, OpenFilm, Motion specs: both tools + skill names wired; stale `claude-drawing-skill` references replaced. YAML validates (18 specs). |
| Live E2E | Chat prompt → Studio action (MCP) → watercolor rendered (~73.5s) → image displayed INLINE in chat (screenshot `inchat-watercolor-delivered.png`). Presets panel plays Ghibli + Synthwave films (`preset-ghibli-loaded.png`, `preset-synthwave-loaded.png`). Mute toggle verified. 60fps MP4 export probe: 240 frames/137.7KB → `/generated/probe_export60.mp4`. Embed-artifact delivery verified in-app (`embed-artifact-playing.png`). Studio Library page fixed (falls back to `/generated/manifest.json`; `Array.prototype.entries` trap fixed) and renders 17 artifacts. |
| Restarts | `pm2 restart librechat` verified twice: `Loaded 24 deployment skill(s)` + `Mounted 4 tools from satchida-art-server.py`. |

## 2. REMAINING WORK (translation tail only — no functional work left)

~180 files under `skill/satchida-motion-art/scripts/engine/` still contain Chinese
(design commentary in JS scene files). Contract for every file:
- Translate ALL Chinese comments/docstrings/log/help text to English. User-visible on-screen
  string defaults may be translated to English content.
- NEVER rename code identifiers, scene ids, era-registry keys, or spec field names. If a Chinese
  string is a cross-file DATA KEY: leave it, translate the comment, list it in the report.
- Check each touched file: `.js` → `node --check <file>`; `.py` →
  `"/c/Program Files/Python311/python.exe" -m py_compile <file>`.

Current partition (check live counts with
`cd skill/satchida-motion-art && grep -rlP '[\x{4e00}-\x{9fff}]' scripts defaults schemas release-manifest.json | wc -l`):
1. `scripts/engine/reference_films/` (~73) — agent running.
2. `scripts/engine/scenes/` (~50) — agent running.
3. Top-level + lib + clips + examples (~14) — agent running (narrowed scope).
4. `scripts/engine/demos/` (~44) — agent running.

If any agent dies (stream failure / concurrency), resume it with SendMessage; if it is
unrecoverable, pick up its directory yourself with the same contract.

Translation agents run via the ZCode Agent tool (general-purpose, background). Concurrency limit
≈2 simultaneous; on "user concurrency limit exceeded" failure, resume the agent with SendMessage
when a slot frees. Agents notify on completion. Model-stream failures ("Start Plan is busy") are
transient — just resume the agent.

## 3. WHEN THE TAIL HITS ZERO

Run in order:

```sh
# 1. Verify zero Chinese in both skill trees (expect 0)
cd /d/LAN-AI-Infra/LibreChat
grep -rlP '[\x{4e00}-\x{9fff}]' skill/satchida-procedural-art --include='*.py' --include='*.md' | wc -l
grep -rlP '[\x{4e00}-\x{9fff}]' skill/satchida-motion-art/scripts skill/satchida-motion-art/defaults \
  skill/satchida-motion-art/schemas skill/satchida-motion-art/release-manifest.json | wc -l

# 2. Syntax-check every touched engine file (spot check is fine; agents checked per-file)
node --check skill/satchida-motion-art/scripts/engine/eras.js

# 3. Mirror skill/ -> repos/ (preserves .git)
PYTHONIOENCODING=utf-8 "/c/Program Files/Python311/python.exe" \
  "C:\Users\WinDiesel\AppData\Local\Temp\satchida-art\sync_repos.py"

# 4. Restart so the hub + skills pick up final trees
pm2 restart librechat --update-env
sleep 30
grep -a "deploymentSkills] Loaded" ~/.pm2/logs/librechat-out.log | tail -1   # expect: Loaded 24
grep -a "Mounted 4 tools from satchida-art-server" ~/.pm2/logs/librechat-error.log | tail -1
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3080               # expect 200
```

## 4. ACCEPTANCE CRITERIA (all already demonstrated once — re-run to confirm)

1. `Loaded 24 deployment skill(s)` in librechat-out.log, zero validation errors.
2. Hub logs `Mounted 4 tools from satchida-art-server.py`; total 21 servers / 104 tools.
3. Browser on :3080 (Admin session persists in the Playwright profile):
   - Open conversation `art-studio-demo-live` → film artifact → OpenFilmStudio mounts with
     **Presets** button; click Motion Recipes → Ghibli-esque → film plays; Pause/Step/Loop/Mute work.
   - Fine Art tab → Synthwave card shows vendored preview and loads a playing film.
   - `/studio-library.html` renders the gallery (no 401).
4. One chat turn in the Chat lane: "Paint a tiny watercolor mountain with seed 42 using the
   generate_procedural_art tool..." → Studio action runs ~60-75s → image inline in reply.
   (Costs one small model turn — the operator's rolling token window was 7M/Month at last check.)

## 5. GOTCHAS (learned the hard way this session)

- `python -I` hides user-site Pillow/mcp/numpy (they live in user site-packages). Never run scene
  subprocesses or probes with `-I`. Also: user site-packages contains a Python-2-era `enum34`
  backport that shadows stdlib `enum` if user-site ends up FIRST on sys.path — append, don't prepend.
- The deployment skill loader (`packages/api/src/skills/deployment.ts` + `data-schemas/methods/skill.ts`)
  requires: kebab-case SKILL.md name (≤64, no `claude-`/`anthropic-` prefix), description ≤1024
  chars, body ≤100k chars, ALL file paths ASCII (`^[a-zA-Z0-9._\-/]+$`). One invalid skill aborts
  the WHOLE registry (Promise.all) → 0 skills load.
- Unified Hub auto-mounts any `skill/*-server.py`; tool names must be unique across servers.
  Server changes need a librechat restart to take effect (hub imports at spawn).
- MCP timeout for `satchida-tools` is 480000 ms in librechat.yaml — renders up to ~5 min are safe.
- Motion server returns MP4 filename under key `filename` (not `file`).
- Shot-list lint: headers `Time | Subject | Action | Camera | On-screen text | Method` and pre-table
  line `Character:` (singular) — template and parser are now aligned; keep them aligned.
- The Mimosa hook blocks Bash writes into the repo — use Edit/Write tools or out-of-repo scripts
  (a working sync script lives at `C:\Users\WinDiesel\AppData\Local\Temp\satchida-art\sync_repos.py`;
  if Temp was cleaned, recreate it from section 3 step 3 logic).
- Demo accounts: `DEMO_PASSWORD='<value>' node scripts/set-demo-passwords.js` resets dcode/dchat;
  the Playwright persistent profile auto-logs-in as Admin.
- Seeded demo conversations: `art-studio-demo-live` (film artifact), `art-embed-test-live`
  (embed delivery). Re-seed via `node scripts/seed_live_convo.js` (3D seed overwrites the film one).

## 6. BOOKKEEPING (done; keep appending)

- `Customizations.md` C37 + `Changes.md` (three 2026-11-20 entries) record everything.
- Memory file `satchida-art-skills-and-mcp.md` holds the operational traps.
