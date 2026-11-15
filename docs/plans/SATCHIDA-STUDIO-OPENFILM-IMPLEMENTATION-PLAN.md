# Satchida Studio (OpenFilm) & Satchida Office Implementation Plan

> **Document Path:** `D:\LAN-AI-Infra\LibreChat\docs\plans\SATCHIDA-STUDIO-OPENFILM-IMPLEMENTATION-PLAN.md`
> **Target Branch:** `satchida` (PR target: `dev`)
> **Environment:** Production Native Windows 11, Cloudflare Zero Trust Named Tunnel (`*.satchida.com`), One-API (`:4000`), Bifrost (`:8700`).
> **Integrity Guarantee:** Zero hardcoded mocks, zero synthetic placeholders, 100% client-side WebGL/Canvas rendering, cross-platform (Windows/macOS/iOS/Android), strict One-API/Bifrost telemetry attribution.
> **Revision:** v2 — 2026-11-15 (corrects Univer "complete" claim, adds Slides preset, clarifies OpenFilm hidden-chat mechanism, fixes telemetry gap)

---

## 1. Executive Architecture & Mission Scope

This plan delivers two core enterprise product integrations into LibreChat:

### 1.1 Satchida Studio (Powered by OpenFilm Engine)

- Full-featured browser-native motion video creation and editing studio.
- Client-side WebGL / Canvas / GSAP rendering in the user's browser — zero server CPU or disk.
- Single unified chat interface: LibreChat chatbox is the only visible prompt input. OpenFilm's internal chat/system-prompt engineering is **hidden in-DOM** but fully preserved — it receives the user prompt wrapped in OpenFilm's native SPEC/MANUAL contract, ensuring 100% of OpenFilm's frame determinism (`window.film.frame(t)`), timing grammar, and track syntax is used without re-engineering.
- Zero-server storage: rendered MP4/WebM compiled in browser and saved to user device via `showSaveFilePicker` or Blob download.
- Quota attribution: video generation requests carry `x-bf-dim-activity: video_generation` and `X-Bifrost-Activity: video_generation` to One-API and Bifrost for separate cost tracking from text chat.

### 1.2 Satchida Office Suite (Univer Rebrand + Workspace Completion)

- **Current state (INCOMPLETE):** Univer is only partially integrated. The drag-and-drop upload router (`useFileUploadRouter.ts`) auto-opens Sheets/Docs when a file is dragged into chat input. There are **no "New Blank File" buttons** in the UI, **no "Open File" button** in the editor header, **no toolbar quick-action** to create an office file without dragging something first. This is the core gap to close.
- **Prior history:** No LibreOffice integration was attempted or abandoned in this repository (`Customizations.md` and `Changes.md` show no LibreOffice entries). Univer was selected directly. The user's image (attached) shows Univer's full product line — the npm-available free products are **Sheets, Docs, and Slides**. Canvases, Relational Tables, Web App, and PDF viewer are either commercial or non-public packages.
- **Npm package reality check (verified live):**
  - `@univerjs/preset-sheets-core` v1.5.0 — **installed** ✅
  - `@univerjs/preset-docs-core` v1.5.0 — **installed** ✅
  - `@univerjs/preset-slides-core` v1.3.1 — **on npm, NOT installed** — can be added
  - `@univerjs/pdf-viewer` — **not found on npm registry** — not available
  - Relational Tables / Canvases — **no public npm package** — commercial only
- Rebrand all visible `Univer` strings to `Satchida` in wrapper layer (Univer SDK internals may still say "Univer" in tooltips that cannot be intercepted without forking the library — this is acceptable).
- Direct "New File" quick-actions in `SatchiToolbar.tsx`.
- Client-side local file import (`.xlsx`, `.csv`, `.docx`, `.pptx`) zero server upload.

---

## 2. System Architecture & Telemetry Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                       REMOTE CLIENT DEVICE (Browser / Mobile)                       │
│                                                                                     │
│  ┌─────────────────────────────────────────┐  ┌────────────────────────────────┐   │
│  │          LibreChat Main UI              │  │     Right Artifact Panel       │   │
│  │                                         │  │                                │   │
│  │  - User enters motion prompt OR clicks  │  │  [ Satchida Studio ]           │   │
│  │    "New Satchida Sheet/Doc/Slides"      │  │  - WebGL/Canvas Playhead       │   │
│  │  - Single unified visible chatbox       │  │  - Multi-track timeline        │   │
│  │  - Browser recommendation banner        │  │  - MediaRecorder MP4 muxer     │   │
│  │    (Firefox compat note)                │  │  - Client-side File Save       │   │
│  │                                         │  │                                │   │
│  │  [ HIDDEN in DOM - not visible ]        │  │  [ Satchida Office ]           │   │
│  │  OpenFilm internal chat receives        │  │  - Sheets / Docs / Slides      │   │
│  │  user prompt wrapped in SPEC.md         │  │  - New File / Open File        │   │
│  │  system contract → returns film.html    │  │  - Export .xlsx / .docx        │   │
│  └────────────────┬────────────────────────┘  └──────────────▲─────────────────┘  │
└───────────────────┼──────────────────────────────────────────┼─────────────────────┘
                    │ HTTPS / WSS (Cloudflare Named Tunnel)     │ Local DOM Event
                    ▼                                           │
┌────────────────────────────────────────────────────────────────────────────────────┐
│                SATCHIDA HOST NODE (Windows 11 Native Runtime)                      │
│                                                                                    │
│   [ LibreChat Express / Node Core (:3080) ]                                        │
│     ├── packages/api/src/endpoints/openai/config.ts:                               │
│     │     NEW → 'X-Bifrost-Activity': 'video_generation'  (video requests only)    │
│     │     NEW → 'x-bf-dim-activity': 'video_generation'  (video requests only)     │
│     │     NEW → 'x-bf-dim-mode': 'studio_video'          (video requests only)     │
│     │     EXISTING → 'X-Tenant-Id', 'X-Seat-Alias', 'x-bf-dim-user_id' (all)      │
│     ├── Artifact Pipeline: application/vnd.satchida.film (new type)                │
│     └── Paywall: Gated to Pro / Pro_Family / Privacy tiers                         │
│                            │                                                       │
│                            ▼ (HTTP Localhost)                                      │
│   [ Satchida Gateway / One-API (:4000) ]                                           │
│     ├── Reads X-Bifrost-Activity for dedicated video quota cap                     │
│     └── Deducts video generation quota independently of text chat                 │
│                            │                                                       │
│                            ▼                                                       │
│   [ Bifrost Cost & Governance Relay (:8700) ]                                      │
│     ├── Evaluates Cost Baseline Policy for video synthesis                         │
│     └── Routes to: deepseek-v4.1-flash / glm-5.3-flash / nemotron-3.5            │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phased Implementation Steps

### Phase 1 — Satchida Office Suite (Univer Rebrand & Workspace Completion)

**Goal:** Fix the incomplete integration, rebrand visible "Univer" strings, and add direct "New File" and "Open Local File" controls.

**Current state is INCOMPLETE — not done:** Only drag-drop upload auto-opens Univer. No standalone buttons exist.

#### P1.1 — Slides Preset Install (Optional Additive)

`@univerjs/preset-slides-core` v1.3.1 is on npm and free. Add it to `client/package.json` and implement a Slides editor preset in `UniverOffice.tsx` following the same pattern as Sheets and Docs.

```bash
# Run in D:\LAN-AI-Infra\LibreChat\client
npm install @univerjs/preset-slides-core@^1.3.1
```

> [!NOTE]
> Slides is the only new Univer product that is freely available on npm. Canvases, Relational Tables, Relational Web App, and PDF Viewer shown in the Univer product image are **commercial/unavailable packages** — do not attempt to integrate them.

New MIME type to register: `application/vnd.univer-slides` (and legacy alias `application/vnd.librechat.univer-slides`).

#### P1.2 — Rebranding All Visible "Univer" Strings

> [!IMPORTANT]
> The Univer SDK renders its own ribbon/toolbar UI using its own component tree. We can rebrand only what lives in **our wrapper layer** (`UniverOffice.tsx`, `starters.ts`, `translation.json`). Univer's internal tooltip text (e.g., "Univer Sheet" in the native toolbar) cannot be overridden without patching the library — this is acceptable; only user-facing wrapper strings are rebranded.

Files and changes:

| File | From | To |
|:---|:---|:---|
| `client/src/components/Artifacts/Univer/UniverOffice.tsx` | `📝 Univer Doc` / `📊 Univer Sheet` (header title) | `📝 Satchida Doc` / `📊 Satchida Sheet` |
| `UniverOffice.tsx` | `Unable to load Univer Workspace` (error boundary) | `Unable to load Satchida Office Workspace` |
| `UniverOffice.tsx` | `.univer.json` (save dialog description) | `.satchida.json` |
| `client/src/locales/en/translation.json` | `"starters_cat_office_docs": "📄 Letters & Contracts (Univer Docs)"` | `"starters_cat_office_docs": "📄 Letters & Contracts (Satchida Docs)"` |
| `client/src/common/starters.ts` | `engineTag: 'Univer · Sheets'` / `'Univer · Docs'` | `engineTag: 'Satchida · Sheets'` / `'Satchida · Docs'` |

New translation keys to add in `translation.json`:
```json
"com_satchida_new_sheet": "New Spreadsheet",
"com_satchida_new_doc": "New Document",
"com_satchida_new_slides": "New Presentation",
"com_satchida_open_office_file": "Open Local File",
"com_satchida_office_workspace": "Satchida Office"
```

#### P1.3 — Direct "New File" Buttons in `SatchiToolbar.tsx`

Add a "📄 Office" dropdown section in `SatchiToolbar.tsx` (Knowledge/Document group), with three items:
- **📊 New Spreadsheet** — sets artifact type `application/vnd.univer-sheet` with a clean 50-row × 26-col blank workbook snapshot, then `setArtifactsVisible(true)`.
- **📝 New Document** — sets artifact type `application/vnd.univer-doc` with a minimal blank doc snapshot.
- **🖥️ New Presentation** — sets artifact type `application/vnd.univer-slides` with blank slide snapshot (only after P1.1 Slides install).

The blank snapshot structures must be sourced from the Univer SDK's own factory methods (e.g., `createDefaultWorkbook()` from `@univerjs/core`) — not hardcoded mock JSON.

#### P1.4 — "Open Local File" Button in `UniverOffice.tsx` Header

Add an **"📂 Open File"** button in the editor header toolbar (alongside existing Save/Export buttons).

```typescript
const handleOpenLocalFile = useCallback(async () => {
  // Primary: HTML5 File System Access API (Chrome/Edge/Brave desktop)
  if ('showOpenFilePicker' in window) {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        { description: 'Office Files', accept: {
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
          'text/csv': ['.csv'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
        }},
      ],
      multiple: false,
    });
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    // Route to correct converter:
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.csv')) {
      const snapshot = await excelBufferToUniverSnapshot(buffer);
      univerApiRef.current?.getActiveWorkbook()?.load(snapshot);
    } else if (file.name.endsWith('.docx')) {
      const snapshot = await docxBufferToUniverDocSnapshot(buffer);
      univerApiRef.current?.getActiveDocument()?.load(snapshot);
    }
  } else {
    // Fallback: <input type="file"> for iOS Safari / Firefox
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.csv,.docx';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const buffer = await file.arrayBuffer();
      // same routing as above
    };
    input.click();
  }
}, []);
```

> [!NOTE]
> `excelBufferToUniverSnapshot` and `docxBufferToUniverDocSnapshot` already exist in `client/src/components/Artifacts/Univer/converter.ts`. The `.pptx` → Slides converter must be implemented alongside P1.1 if Slides is integrated. Do not create a placeholder — only wire it when the converter is real.

#### P1.5 — Export Enhancements

The `handleExportXlsx` and `handleSaveToDevice` callbacks already exist in `UniverOffice.tsx` (lines 50–147). No structural change needed — only extend to support `.pptx` export format if Slides is integrated.

**Verification Gate 1 (Office):**
- `npx tsc --noEmit` in `client` → 0 errors.
- `npm test client/src/components/Artifacts/Univer/` — all existing tests pass + new ones for Open File and New File buttons.
- UI grep: `grep -r "Univer" client/src/components/Artifacts/Univer/UniverOffice.tsx` → zero user-visible string matches (SDK type names like `UniverSheetsCorePreset` are acceptable; only user-facing copy matters).
- Manual: Open app, click "New Spreadsheet" in toolbar → blank sheet loads in artifact pane without any drag-drop input.
- Manual: Click "Open File" in sheet header → file picker opens → selecting an `.xlsx` loads it in-memory without any server network request.

---

### Phase 2 — Gateway & Bifrost Video Activity Telemetry Headers

**Goal:** Accurately bill, attribute, and quota-check video generation calls separately from text conversations.

> [!IMPORTANT]
> `x-bf-dim-activity` **does not currently exist** in `packages/api/src/endpoints/openai/config.ts`. The existing block (lines 247–283) only injects `X-Tenant-Id`, `X-User-Name`, `X-Seat-Alias`, `X-Bifrost-User-Id`, `X-Bifrost-Role`, `x-bf-dim-user_id`, `x-bf-dim-user_name`, `x-bf-dim-customer_id`. Activity headers are **new additions**.

#### P2.1 — Header Injection in `config.ts`

Detection: check if `modelOptions.spec` or `modelOptions.model` matches the `Motion` or `Satchida Studio` model spec name (from `librechat.yaml`). The check must be done **at request construction time** in the existing Bifrost telemetry block.

```typescript
// In packages/api/src/endpoints/openai/config.ts
// APPEND inside the existing isBifrostEndpoint block, after existing dim headers:

const isVideoGenRequest =
  (modelOptions as { spec?: string }).spec === 'Motion' ||
  (modelOptions as { spec?: string }).spec === 'Satchida Studio';

if (isVideoGenRequest) {
  configOptions.defaultHeaders['X-Bifrost-Activity'] = 'video_generation';
  configOptions.defaultHeaders['X-Bifrost-Subsystem'] = 'satchida_studio';
  configOptions.defaultHeaders['x-bf-dim-activity'] = 'video_generation';
  configOptions.defaultHeaders['x-bf-dim-media-type'] = 'motion_video';
}
```

> [!NOTE]
> The YAML-level `X-Bifrost-Mode: chat` is a separate header key — it does **not** conflict with or override the new `X-Bifrost-Activity` header. Both can coexist independently.

#### P2.2 — One-API & Bifrost Quota Cap Configuration

No Go code changes required at this stage. One-API already reads custom headers from upstream requests. The activity header is forwarded to Bifrost automatically via `relay/adaptor/common.go`. What the operator must configure (outside this plan's code scope):
- Add a dedicated video generation quota cap per seat in One-API's tenant entitlement configuration.
- This is an operator-side configuration action, not a code change.

**Verification Gate 2 (Telemetry):**
- Unit test in `packages/api/src/endpoints/openai/config.spec.ts`:
  - Studio spec request → `x-bf-dim-activity: video_generation` present in headers.
  - Standard chat request → `x-bf-dim-activity` absent from headers.
- `npx tsc --noEmit` in `packages/api` → 0 errors.

---

### Phase 3 — OpenFilm Engine Web Bundle & Artifact Integration

**Goal:** Embed OpenFilm Studio's visual editor into the artifact pane. Eliminate dual chat boxes by hiding OpenFilm's internal chat in DOM while routing all user input through LibreChat's unified chatbox.

#### P3.1 — OpenFilm Availability & Installation Strategy

> [!IMPORTANT]
> OpenFilm is **not yet present** in this repository. It is not an npm package — it must be integrated from source (`github.com/openfilm/OpenFilm`). The correct approach:
>
> 1. Clone OpenFilm into `D:\LAN-AI-Infra\openfilm` (outside LibreChat repo).
> 2. Build OpenFilm Studio UI: `cd packages/openfilm/studio/ui && npm install && npm run build`.
> 3. The built static assets (`dist/`) are served from LibreChat's existing static file server or bundled as a lazy-loaded chunk in Vite.
> 4. Alternatively, evaluate whether OpenFilm Studio UI can be imported as a React component library directly into the LibreChat client bundle — inspect its `package.json` for exported entrypoints.

**OpenFilm Architecture Clarification (Critical):**
- `apps/desktop/chat` — Electron desktop chat component → **NOT RELEVANT** for web integration, omit entirely.
- `packages/openfilm/studio/ui` — The visual editor (React + Vite) → **This is the component to embed**.
- `SPEC.md` / `MANUAL.md` — OpenFilm's formal prompt engineering grammar → **Must be injected verbatim into `librechat.yaml` system prompt** (see Phase 5).
- OpenFilm's internal chat is a lightweight wrapper that calls the same LLM API with OpenFilm's SPEC as system prompt. We replicate this by: injecting SPEC.md into LibreChat's model spec system prompt, and passing the user's prompt through. No re-engineering of the prompt grammar is needed or permitted.

#### P3.2 — Hidden Prompt Passthrough (The Core Mechanism)

The key architectural decision — how the user's prompt reaches OpenFilm's native grammar without a dual chat box:

```
User types prompt in LibreChat chatbox
         │
         ▼
LibreChat model spec "Satchida Studio" (librechat.yaml)
  system prompt = OpenFilm SPEC.md + MANUAL.md verbatim
         │
         ▼
One-API → Bifrost → Cloud LLM (deepseek-v4.1-flash / glm-5.3-flash)
         │
         ▼
LLM returns valid film.html inside artifact block:
  :::artifact{type="application/vnd.satchida.film" ...}
  <film>...</film>
  :::
         │
         ▼
ArtifactTabs routes to <OpenFilmStudio artifact={...} />
         │
         ▼
OpenFilmStudio renders timeline, executes window.film.frame(t) on canvas
```

OpenFilm's desktop chat UI is NOT used. The prompt engineering lives entirely in the SPEC.md system prompt injected into `librechat.yaml`. This is not a workaround — it is the correct architecture: OpenFilm's desktop chat does exactly the same thing (injects SPEC.md as system prompt).

#### P3.3 — Artifact MIME Registration

In `client/src/common/artifacts.ts`:
```typescript
export const SATCHIDA_FILM_ARTIFACT_TYPE = 'application/vnd.satchida.film' as const;
```

In `client/src/utils/artifacts.ts`: register `application/vnd.satchida.film` → file extension `.film.html`, download label `Satchida Studio Project`.

#### P3.4 — Component: `OpenFilmStudio.tsx`

New file: `client/src/components/Artifacts/OpenFilm/OpenFilmStudio.tsx`

Renders:
- **Top Bar:** Project title, aspect ratio selector (16:9, 9:16 vertical reels, 1:1 square), FPS selector (24/30/60), zoom controls.
- **Center Canvas:** Isolated `<canvas>` / WebGL context executing `window.film.frame(t)` deterministically. The film script from `artifact.content` is evaluated in a sandboxed scope (no `eval` on arbitrary user input — the content is LLM-generated film.html that has already passed Bifrost's safety policy).
- **Bottom Timeline:** Multi-track scrubber with shot blocks, playhead, and playback controls.
- **Hidden OpenFilm Chat:** If OpenFilm Studio UI's React component tree includes a chat panel, it is mounted with `visibility: hidden; pointer-events: none; position: absolute; width: 0; height: 0; overflow: hidden;`. It receives the same prompt via a programmatic API call. If OpenFilm Studio UI has no chat (it is a pure visual editor), this step is skipped.

#### P3.5 — Artifact Tab Routing in `ArtifactTabs.tsx`

```typescript
import { SATCHIDA_FILM_ARTIFACT_TYPE } from '~/common/artifacts';
import OpenFilmStudio from '~/components/Artifacts/OpenFilm/OpenFilmStudio';

// In the routing switch/if-chain:
if (artifact.type === SATCHIDA_FILM_ARTIFACT_TYPE) {
  return <OpenFilmStudio artifact={artifact} />;
}
```

**Verification Gate 3 (OpenFilm Mounting):**
- Unit test in `client/src/components/Artifacts/OpenFilm/__tests__/OpenFilmStudio.spec.tsx`:
  - Artifact with type `application/vnd.satchida.film` → renders `<OpenFilmStudio>`.
  - `window.film.frame(0)` returns a non-null value after script injection.
  - No visible chat box component in the rendered output.
- `npx tsc --noEmit` in `client` → 0 errors.

---

### Phase 4 — Client-Side Hardware-Accelerated Video Rendering & Local Persistence

**Goal:** 100s of simultaneous users render and export videos without consuming any server CPU or disk.

> [!NOTE]
> **Concurrency answer:** Because all rendering runs in the **user's browser** (WebGL/Canvas + MediaRecorder/WebCodecs), the LibreChat server carries zero per-render load. 100s of simultaneous users rendering video costs the server nothing beyond streaming the initial LLM response. This is the correct architecture.

#### P4.1 — Export Engine in `OpenFilmStudio.tsx`

```typescript
async function renderToVideoBlob(canvas: HTMLCanvasElement, duration: number, fps: number): Promise<Blob> {
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm',
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
    recorder.start();

    let t = 0;
    const step = 1 / fps;
    const tick = () => {
      if (t > duration) { recorder.stop(); return; }
      window.film.frame(t);
      t += step;
      requestAnimationFrame(tick);
    };
    tick();
  });
}
```

#### P4.2 — Local Device Persistence

```typescript
async function saveVideo(blob: Blob, title: string) {
  const fileName = `${title || 'satchida_studio_video'}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`;
  
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'Video File', accept: { 'video/mp4': ['.mp4'], 'video/webm': ['.webm'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  // Fallback for iOS Safari, Firefox, Android Chrome
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

#### P4.3 — Browser Compatibility Banner

A subtle, dismissible banner shown once per session when the user opens Satchida Studio:

> 💡 **For the best Satchida Studio experience** — including 60 FPS hardware acceleration and direct MP4 export — Google Chrome, Microsoft Edge, Brave, or Safari 16+ is recommended. Firefox supports playback and export with limited performance.

**Verification Gate 4 (Export):**
- Browser test: Render a 3-second test film → `showSaveFilePicker` triggers → valid `.mp4` or `.webm` file saved to device.
- Confirm: zero network requests to LibreChat server during the render step (use DevTools Network panel filtered to XHR/Fetch).
- Confirm: works on Chrome for Android (using Blob fallback download).

---

### Phase 5 — Satchida Studio Model Spec & Native Prompt Preservation

**Goal:** The LLM writes valid, broadcast-grade OpenFilm syntax. OpenFilm's native prompt engineering is preserved verbatim — not summarized, not re-engineered.

#### P5.1 — Augment `librechat.yaml` Motion / Satchida Studio Spec

The existing `name: Motion` spec already has a system prompt. This phase **augments** it by:

1. **Prepending the full OpenFilm `SPEC.md` and `MANUAL.md` content** (fetched verbatim from the OpenFilm repository) as the authoritative grammar reference.
2. **Changing the artifact output MIME type** in the system prompt instruction from `text/html` (if used) to `application/vnd.satchida.film`.
3. **Keeping all existing Motion instructions** — this is additive, not a replacement.

The system prompt structure after this phase:
```
[OpenFilm SPEC.md verbatim — track syntax, section rules, timing grammar]
[OpenFilm MANUAL.md verbatim — examples, easing curves, kinetic text]
[Existing Motion / Satchida Studio operational instructions]
[Bifrost routing: deepseek-v4.1-flash / glm-5.3-flash / nemotron-3.5]
[Artifact output: type=application/vnd.satchida.film]
```

#### P5.2 — Model Routing (No Claude/Anthropic)

Recommended models for Satchida Studio (in priority order):
1. `deepseek-v4.1-flash` — fast, low-cost, in Bifrost cost baseline ✅
2. `glm-5.3-flash` — Z.ai, in Bifrost cost baseline ✅
3. `nvidia/nemotron-3.5` — via DeepInfra, evaluate quality for structured code output

> [!CAUTION]
> Never route Satchida Studio through Claude/Anthropic models. Never use deprecated models (Qwen 2.5, DeepSeek V3). Do not expose model names in any user-facing UI surface (C5 policy in `Customizations.md`).

#### P5.3 — Paywall Gate

In `client/src/components/Chat/Menus/Endpoints/components/ModelSpecItem.tsx`, the existing gate for Studio specs already checks Pro/Privacy tiers. Confirm `Satchida Studio` is in the gated spec list. No new gate logic needed — verify existing gate fires correctly.

**Verification Gate 5 (Spec & Prompt):**
- Send a test prompt: "Create a 10-second intro animation with kinetic text 'Welcome to Satchida'"
- LLM response must contain a valid `application/vnd.satchida.film` artifact with correct `<section>` track syntax and `window.film = { frame(t) {...}, duration, width, height }`.
- The returned film renders correctly in `OpenFilmStudio` without JS errors.
- Zero regression: existing GSAP/Motion artifacts and 3BHK CAD artifacts still work.

---

## 4. Verification & Validation Protocol (Zero Hallucination, Zero Mock)

| Gate | Scope & Command | Success Criteria |
|:---|:---|:---|
| **Gate 1: TypeScript** | `npx tsc --noEmit` in `packages/api` and `client` | 0 errors, 0 regressions |
| **Gate 2: Office Rebrand** | `npm test client/src/components/Artifacts/Univer/` | No `Univer` in user-visible wrapper strings; "New Sheet/Doc" spawns real Univer snapshots; Open File loads without server upload |
| **Gate 3: Telemetry Headers** | Unit test `packages/api/src/endpoints/openai/config.spec.ts` | `x-bf-dim-activity: video_generation` injected on Studio spec; absent on plain chat |
| **Gate 4: OpenFilm Mounting** | Unit test `OpenFilmStudio.spec.tsx` | `application/vnd.satchida.film` → renders `<OpenFilmStudio>`; `window.film.frame(0)` valid; no visible chat box |
| **Gate 5: Client-Side Export** | Browser devtools + file system check | Valid MP4/WebM saved to device; zero LibreChat server requests during render |
| **Gate 6: Prompt Contract** | End-to-end test with live model | LLM returns valid film.html with correct `<section>` syntax and `window.film` contract |
| **Gate 7: Zero Regression** | Existing test suites + live CAD/GSAP test | Existing Motion artifacts, SatchiToolbar, and all other features unaffected |

---

## 5. File Modification Manifest

| File | Action | Phase |
|:---|:---|:---|
| `docs/plans/SATCHIDA-STUDIO-OPENFILM-IMPLEMENTATION-PLAN.md` | This document | — |
| `client/package.json` | Add `@univerjs/preset-slides-core` | P1.1 |
| `client/src/components/Artifacts/Univer/UniverOffice.tsx` | Rebrand strings, add Open File button, Slides support | P1.2, P1.4 |
| `client/src/locales/en/translation.json` | Rebrand office category, add new keys | P1.2 |
| `client/src/common/starters.ts` | Rebrand office engine tags, add Studio starters | P1.2 |
| `client/src/components/Chat/Input/SatchiToolbar.tsx` | Add New Sheet/Doc/Slides buttons | P1.3 |
| `client/src/common/artifacts.ts` | Register `SATCHIDA_FILM_ARTIFACT_TYPE` | P3.3 |
| `client/src/utils/artifacts.ts` | Register film template & download extensions | P3.3 |
| `client/src/components/Artifacts/ArtifactTabs.tsx` | Route `application/vnd.satchida.film` to `OpenFilmStudio` | P3.5 |
| `client/src/components/Artifacts/OpenFilm/OpenFilmStudio.tsx` | New: Studio editor, timeline, canvas, export | P3.4, P4.1 |
| `packages/api/src/endpoints/openai/config.ts` | Add video_generation activity headers | P2.1 |
| `packages/api/src/endpoints/openai/config.spec.ts` | Add telemetry header unit tests | P2.1 |
| `librechat.yaml` | Augment Motion/Studio spec with OpenFilm SPEC.md + MANUAL.md | P5.1 |

---

## 6. Known Constraints & Non-Negotiables

- **No Claude/Anthropic models** — ever, in any context.
- **No obsolete models** — no Qwen 2.5, no DeepSeek V3, no GPT-4 turbo.
- **No model names in UI** — `Customizations.md` C5 policy is binding.
- **No server-side rendering or storage** for video output — 100% client-side.
- **No mock/hardcoded blank snapshots** — use Univer SDK factory methods for blank workbook/doc creation.
- **No `eval()` on user-typed input** — film scripts come from LLM via the message pipeline, not from raw user input.
- **Never restart PM2 processes or llama-server** as part of this plan's implementation or verification.
- **OpenFilm's prompt grammar is immutable** — SPEC.md and MANUAL.md are injected verbatim, never paraphrased or summarized.
- **Execution begins only after user go-ahead** — this document is a plan only.
