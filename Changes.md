
---

## 2026-11-25 — Live Voice S2S Quality, Cost Control, Location & Agentic Study Mode

- **Full-duplex barge-in & VAD tuning** (`client/src/components/Chat/Input/LiveVoiceModal.tsx`, `packages/api/src/voice/realtimeProxy.ts`):
  - Removed playback/cooldown mic gating on the S2S PCM stream so users can interrupt mid-reply (relying on browser `echoCancellation: true`), while keeping the echo guard on the fallback Web Speech API path.
  - Added `realtimeInputConfig.automaticActivityDetection` (`START_SENSITIVITY_HIGH`, `END_SENSITIVITY_HIGH`, `prefixPaddingMs: 120`, `silenceDurationMs: 400`, `activityHandling: 'START_OF_ACTIVITY_INTERRUPTS'`).
- **3rd-person live interpreter & affective dialog** (`packages/api/src/voice/realtimeProxy.ts`):
  - Enabled `enableAffectiveDialog: true` and tuned the system prompt for natural human warmth, Satchida identity, and strict 3rd-person live translation between two speakers.
- **Reliable live web search & voice-switch fixes** (`packages/api/src/voice/realtimeProxy.ts`):
  - Wired local `satchida-search` (`http://127.0.0.1:8880/search?format=json`) into `executeVoiceWebSearch` with spoken-filler query cleanup.
  - Tightened `detectAccentSwitchCommand` to require explicit voice/accent/gender-switch intent (eliminating false switches on country names like "India").
  - Suppressed Gemini's ungrounded refusal during search/tool delegation, added `activeSearchEpoch` / `lastDelegatedEpoch` to discard stale results, and reset `suppressCurrentS2sTurn` on `setupComplete` so voice-switch confirmations are never swallowed.
- **Cost control & usage metering** (`packages/api/src/voice/realtimeProxy.ts`):
  - Enabled `contextWindowCompression: { slidingWindow: {} }` on Gemini Live sessions.
  - Captured `usageMetadata` (with audio-byte fallback) and logged/reported per-session usage telemetry to `VOICE_USAGE_WEBHOOK_URL` / `SATCHIDA_CONTROL_PLANE_URL/api/v1/usage/voice`.
- **Device location & auto-orchestrated Study Mode / DeepTutor** (`client/src/components/Chat/Input/LiveVoiceModal.tsx`, `packages/api/src/voice/realtimeProxy.ts`):
  - Added non-blocking `navigator.geolocation` + reverse-geocoding (`voice.location`) for local assistance (nearest doctor, directions, weather).
  - Expanded `detectToolOrTutorIntent` to catch visual learning requests (*"explain with visuals"*, *"diagram of"*, *"show me how ... works"*) and auto-open a New Chat in Study Mode with Web Search & DeepTutor enabled.

## 2026-11-25 (Phase 1–4) — Gold-Standard Live Voice S2S Audit Fixes & Rich Action Cards

- **Structured live resolvers** (`packages/api/src/voice/liveResolvers.ts` + `liveResolvers.spec.ts`):
  - Added Open-Meteo structured weather resolver (temperature, condition, high/low, humidity), `satchida-search` structured news headline resolver, spoken-city extraction (`extractSpokenCity`), stopword stripping (`stripVoiceStopwords`), and strict place/directions gating (`isPlaceOrDirectionsQuery`).
- **Audit bug fixes** (`packages/api/src/voice/realtimeProxy.ts`):
  - Conversational location memory: spoken city follow-ups (*"consider my location as Mumbai"*) update `userLocation.city` and automatically re-run pending local/weather queries.
  - Unified `reportVoiceUsageSummary('client_close')` on `clientWs.on('close')` (feeding real `usageMetadata` tokens to MongoDB, One-API, and control-plane webhook) and cleared `inputTranscriptTimer` on disconnect.
  - Replaced permanent `lastProcessedInputKey` lockout with a 3-second dedupe window.
  - Maps action cards now use cleaned keywords and only trigger on place/directions queries (never weather).
- **Rich Action Cards, audio polish & instant billing sync** (`client/src/components/Chat/Input/LiveVoiceModal.tsx`, `client/src/components/Chat/HeaderBillingGauge.tsx`):
  - Upgraded `LiveVoiceModal` to render dismissible **Maps**, **Weather**, **News Headlines (clickable + Send to Chat)**, and **DeepTutor (View Chat)** cards, plus hands-free `minimize`/`maximize` UI actions.
  - Added shared `GainNode` with 6 ms fade-out on barge-in and 40 ms jitter lookahead for click-free audio.
  - Dispatched `satchida:voice-session-ended` on modal cleanup so `HeaderBillingGauge` refreshes Live Voice minutes/tokens immediately.

## 2026-11-26 — Media Action Card (YouTube & Spotify) + Hands-Free Mobile Wake Lock

- **Media Launcher Card** (`packages/api/src/voice/liveResolvers.ts`, `realtimeProxy.ts`, `LiveVoiceModal.tsx`):
  - Added `detectMediaIntent` for *"play <song/video> on YouTube/Spotify"* with one-tap **Open YouTube / Open Spotify** deep links and an OS-aware **Install Spotify** button (Google Play / App Store).
- **Hands-Free Screen Wake Lock** (`LiveVoiceModal.tsx`):
  - Acquires `navigator.wakeLock.request('screen')` while Live Voice is active so mobile devices don't auto-lock mid-conversation.
- **Future Hands-Free Assistant Roadmap (noted for native Android/iOS & Spotify OAuth phase):**
  - Background lock-screen audio service, compass/turn-by-turn navigation, Spotify Web API full playback control (play/pause/skip/volume), automatic pause on incoming phone calls, and opt-in user-authorized AI call screening/answering.

## 2026-11-26 (Continued) — Resident 24/7 Mobile Assistant & Deep-Dive Audit Fixes

- **Inline Embedded GPS Map & Places/Traffic/AQI** (`d935f46cc`):
  - Embedded interactive Google Map preview inside `LiveVoiceModal` centered on GPS coordinates for nearest gas stations, EV chargers, traffic, parking, doctors, hospitals, restaurants, and directions, with one-tap **Navigate** launch while keeping Live Voice active.
- **Zero-Refusal Media & UI Action Confirmations + Awaited Reverse-Geocoding** (`9d18868ba`):
  - Pre-emptively suppresses Gemini refusals on media/UI commands and injects `[SYSTEM ACTION COMPLETED]` confirmations.
  - Awaits Nominatim reverse-geocoding (`reverseGeocodePromise`) on local/weather/panchang/location queries so `userLocation.city` is guaranteed populated.
  - Re-acquires `navigator.wakeLock` on `visibilitychange`, auto-pauses on incoming phone call (`AudioContext.statechange === 'interrupted'`), and persists the last 8 Action Cards as tappable pills inside `Log (N)`.
- **Mobile Network Auto-Reconnect & Lock-Screen Media Controls** (`5102e4f6e`):
  - Exponential-backoff WebSocket auto-reconnect (4 retries + `window.online` listener) for seamless Wi-Fi ↔ 4G/5G handoff.
  - Registered `navigator.mediaSession` lock-screen & notification controls (`Play`, `Pause`, `Stop`) for "Satchida Live Voice".
