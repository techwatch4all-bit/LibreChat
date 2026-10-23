# Satchida — animated petal callouts (handoff prompt)

Copy everything below this line into the next AI session.

---

## TASK

Build an animated callout graphic for the Satchida login/landing page at
`http://localhost:3080/login`.

A stylised mandala sits in the centre. Around it, **eight small rounded text tags** are arranged in
a ring, each connected back to the mandala by a **slim animated white line that flows out of the
petal and spawns the tag**.

Two requirements have been stated repeatedly and are not negotiable:

1. **The connector line must match the mandala's own animation.** There is already a thin white arc
   travelling around the mandala — a rotating conic-gradient sweep masked to a 1px border. That is
   the visual reference. The connector from each petal to its tag must be **exactly this kind of
   line**: thin, white, continuously animated, with a bright travelling segment. NOT a dotted
   leader, NOT a straight static rule, NOT a thick connector. A previous attempt used a dashed
   leader and was rejected as "not graphics".
2. **A tag must NEVER sit on top of the mandala.** Every tag, at rest and throughout its whole
   animation, must be completely clear of the artwork. A previous attempt had a tag parked over the
   bottom petals and was rejected outright.

---

## REPO AND STACK

- Repo: `D:\LAN-AI-Infra\LibreChat`, branch `satchida`. Not a git repo workspace member for this app.
- Stack: LibreChat fork, React 18 + TypeScript + Vite, Tailwind.
- Files that matter:
  - `client/src/components/Auth/AuthLayout.tsx` — the landing page shell
  - `client/src/components/Landing/MandalaStage.tsx` — the mandala + callout ring (exists, replace it)
  - `client/src/style/landing.css` — landing page styles
  - `client/src/style/satchida.css` — brand theme, mandala 3D frame, halo, sweep ring
  - `packages/client/src/theme/themes/satchida.ts` — theme tokens
  - `client/src/locales/en/translation.json` — **all visible copy goes here** as `com_callout_*`
    keys and must be rendered through `useLocalize()`. Never hardcode a user-visible string.
- Artwork: `client/public/assets/satchida/satchida-splash-mandala.png` — **800 × 690 px, RGBA,
  not square**. It is a fixed raster. **Do not redraw it, recolour it, or draw anything on top of it.**

### The mandala's 3D treatment that already exists (`.satchida-auth-brand__frame`)

```
animation: mandala-3d 18s ease-in-out infinite;
  0%,100% { transform: perspective(1100px) rotateX(6deg) rotateY(-7deg); }
  50%     { transform: perspective(1100px) rotateX(-4deg) rotateY(7deg) translateZ(22px); }
```
plus a counter-rotating halo behind it (`inset: -9%`, blurred conic gradient, `translateZ(-70px)`)
and the travelling sweep ring (`.satchida-auth-brand__sweep`, conic gradient masked to a 1px border,
rotating 7s linear).

---

## THE PETAL ANCHORS

These are the positions of each petal's own label inside the mandala image, measured by cropping and
upscaling the 800×690 artwork and reading it. They are expressed as a **percentage of the mandala's
box**, so they hold at any rendered size.

| Tag text (already in translation.json) | anchor x % | anchor y % | petal wording in artwork |
|---|---|---|---|
| `com_callout_local_first`        | 49.5 | 28.7 | LOCAL FIRST |
| `com_callout_sovereignty`        | 12.5 | 45.5 | NATIVE AI SOVEREIGNTY |
| `com_callout_no_caps`           | 21.5 | 58.3 | NO MONTHLY CAPS |
| `com_callout_local_solutions`   | 35.0 | 71.4 | LOCAL SOLUTIONS |
| `com_callout_zero_telemetry`    | 50.0 | 86.5 | ZERO TELEMETRY |
| `com_callout_fixed_term`        | 62.5 | 31.2 | FIXED-TERM PRICING |
| `com_callout_no_user_limit`     | 88.1 | 72.0 | NO USER LIMIT |
| `com_callout_no_hidden_cost`    | 88.4 | 56.5 | NO HIDDEN COST |

Each tag restates the petal it flies out of. If a new tag is added, match it to a real petal and
update this table.

**Copy constraint:** never write "anonymous". `SOLUTIONS.md §B1` records it as a claim that must
never be made — Satchida is an identifiable party to its client. `com_callout_sovereignty` is
deliberately worded "Identity never leaves", which is the defensible unlinkability claim.

---

## WHAT THE ANIMATION SHOULD DO

One cycle, roughly 17 seconds, looping:

1. Tag *i* starts on its own petal, invisible.
2. A thin white line draws outward from that petal toward the tag's resting place.
3. The tag flies out along that line and lands in the ring — **fast, roughly 1 second**, so it is
   never visibly crossing the artwork. A slow glide across the mandala was rejected.
4. All eight settle into full 360° coverage and hold, the lines continuing to travel.
5. Everything fades, the cycle restarts.

Stagger the eight by ~0.3s. Line and tag must share the timing.

---

## TRAPS — these are why previous attempts failed

Do not hit these again. Each cost a full build-and-verify cycle.

1. **`.landing-main` is a column flex item with `margin-inline: auto`.** That makes it
   **shrink-to-fit**, not stretch — the page rendered 1000px wide inside a 1600px viewport with
   300px wasted on each side, which starved the mandala of room for its ring. It now carries
   `width: 100%`. Do not remove it.

2. **Never place anything from `getBoundingClientRect()` of the mandala.** It is permanently
   mid-rotation under the 3D tilt, so its rect is both **inflated** (larger than the element) and
   **moving every frame**. Use `offsetWidth` / `offsetHeight` and the parent's centring for
   geometry. Using the live rect makes tags drift and makes overlap tests report false results.

3. **The halo extends beyond the frame.** `.satchida-auth-brand__halo` sits at `inset: -9%`. A tag
   clear of the frame box is still *inside the glow*. Clearance must be measured from the halo's
   extent.

4. **The petal tips reach past the square frame vertically.** The rosette points up and down past
   its own bounding box, so a tag placed straight up or down from the frame clips the artwork. Those
   two positions need an explicit extra vertical allowance, and the stage height must account for
   it — omitting that term clips the top tags off-canvas.

5. **The artwork is 800×690, not square.** Its petal tips sit closer to the frame edges than a
   square assumption predicts.

6. **The stage must derive its own height** from the ring's geometry. An eyeballed `min-height`
   silently drops the whole layout into a stacked fallback and nobody notices, because the fallback
   looks plausible.

7. **The measurement effect must be idempotent.** It runs from `ResizeObserver` + `MutationObserver`;
   if it calls `setState` with fresh objects every time, it re-triggers itself indefinitely and the
   layout oscillates between two modes forever. Compare before setting.

8. **Never test "does the tag overlap the mandala" against a bounding box of a rotated element.**
   That produces phantom overlaps. Test against the un-transformed layout box.

---

## BUILD AND VERIFY LOOP

```bash
# from repo root
cd client && npx tsc --noEmit && npm run build

# the backend caches index.html in memory, so it MUST be restarted to serve a new build
# and PORT must be unset — this shell exports PORT=5174, which silently overrides .env
cd /d/LAN-AI-Infra/LibreChat && unset PORT && node api/server/index.js
```

If the page loads blank or the console shows `ERR_CONTENT_DECODING_FAILED`, the server is serving a
stale `index.html` — you skipped the restart.

Verify in a real browser (Playwright is already installed at the repo root; `pngjs` is **not**
available, so diff pixels in-page via `canvas.getImageData` rather than decoding PNGs):

```js
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.addInitScript(() => localStorage.setItem('color-theme', 'satchida-dark'));
await page.goto('http://localhost:3080/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.mandala-tag', { timeout: 60000 });
await page.waitForTimeout(9000);            // sample LATE in the cycle, when tags are at rest
await page.screenshot({ path: 'shot.png' });
```

Use `waitUntil: 'domcontentloaded'`, never `networkidle` — LibreChat holds a persistent connection
and `networkidle` never fires.

---

## ACCEPTANCE CRITERIA

Check every one. A screenshot alone is not proof — measure each.

- [ ] **Zero tags overlapping the mandala at rest**, measured against the un-transformed layout box.
- [ ] **Zero tags overlapping at any point in the animation cycle** — sample at several offsets
      through the 17s loop, not just once.
- [ ] The connector is a **thin white animated line with a travelling bright segment**, visually
      consistent with the sweep ring already circling the mandala. Not dotted. Not static.
- [ ] All eight tags are reachable, in a 360° ring, following the mandala's curve by angle.
- [ ] No raw translation keys rendered — copy goes through `useLocalize()`.
- [ ] Works at 1600×1000, 1280×800, 1024×768 and 390×844. Below the width where a clear ring fits,
      tags wrap under the mark and the connector lines are hidden — that fallback must not overlap
      anything either.
- [ ] `prefers-reduced-motion` renders tags statically in place with no movement.
- [ ] Zero console errors.
- [ ] `npx tsc --noEmit` clean.

---

## KNOWN OPEN DECISION

A full 360° ring of eight legible tags needs roughly 700px of height around the mark. Add the
wordmark, headline and footer and that exceeds a 1000px viewport. Previous attempts resolved this by
shrinking the mandala to ~250px, which fixed the clipping but left the brand image too small and a
large dead gap on the page.

**Pick one deliberately rather than discovering it by iteration:**
- (a) let the page run ~1300px so the mandala can stay at 420px+, or
- (b) cut to four larger tags instead of eight, or
- (c) drop the headline strap below the ring and let the mark own the whole screen.

Whichever you choose, state it up front. The mandala is the hero of this page.

---

## DO NOT

- Do not commit or stage anything. The worktree has extensive pre-existing operator changes.
- Do not restart `:4000`, `:8010`, `:8080` or `:8091`. Only `:3080` may be restarted, and only to
  pick up a frontend build.
- Do not print, echo or read `.env`, licence tokens, or the keyring.
- Do not introduce a 3D or graphics dependency. Plain CSS/SVG is sufficient and keeps the theme
  correct in both light and dark.
- Do not hardcode colours below `tokens.css` / the theme tokens.
