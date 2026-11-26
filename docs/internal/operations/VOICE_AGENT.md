# Satchida Live Voice — Complete Requirements, Architecture & Review Document

> **Document Path**: `d:\LAN-AI-Infra\LibreChat\docs\internal\operations\VOICE_AGENT.md`
> **Last Updated**: 2026-11-26

---

## 1. Executive Summary
Satchida Live Voice is a real-time, bidirectional speech-to-speech voice companion powered by Satchida Intelligence (`packages/api/src/voice/realtimeProxy.ts`, `packages/api/src/voice/voiceProfile.ts`, `packages/api/src/voice/voiceIntelligence.ts`, `packages/api/src/voice/liveResolvers.ts`, and `client/src/components/Chat/Input/LiveVoiceModal.tsx`).

---

## 2. Complete Functional Requirements & Implementation Status

### Requirement 1 — Time-of-Day Greeting & Language Onboarding
- **Requirement**: On first session, greet the user politely in English based on their local time of day (*"Good morning / afternoon / evening! Which language would you prefer to speak in today?"*) and persist the chosen language to that user's account memory.
- **Implementation**:
  - Client passes `localHour` (`0–23`) in the WebSocket URL (`/api/voice/realtime?localHour=...`) from `LiveVoiceModal.tsx`.
  - Server computes the greeting via `getTimeOfDayGreeting(localHour)` and injects onboarding rules via `buildVoiceMemorySystemBlock(voiceProfile, clientLocalHour)`.
  - On initial `setupComplete` (`!switchNotice`), server sends a proactive `clientContent` greeting trigger and sets a `1800ms` mic-forward guard (`pauseMicForwardUntil`) so ambient mic noise at `t=0` does not interrupt the opening greeting.
  - Server extracts the user's chosen language in `processCompletedS2sUserUtterance` (supporting both full phrases and single-word replies like `"Hindi"` or `"English"`) and persists it to `satchida_voice_profile`.

### Requirement 2 — Name Onboarding & Returning User Recognition
- **Requirement**: Once language is known, ask for the user's name and save it to memory. On returning sessions, greet the user by name in their preferred language without re-asking.
- **Implementation**:
  - `buildVoiceMemorySystemBlock` switches automatically between 3 states: (a) no language → ask language, (b) language known, no name → ask name in that language, (c) both known → greet by name in preferred language.
  - Server-side extraction saves `name` automatically into `satchida_voice_profile`.

### Requirement 3 — Long-Term Memory Architecture (Integrated LibreChat Memory)
- **Requirement**: Evaluate and use LibreChat's integrated **Memories** feature (left navigation) using **one single consolidated memory record** per user account rather than fragmented entries.
- **Implementation**:
  - Uses LibreChat's existing MongoDB `MemoryEntry` collection (`packages/data-schemas/src/methods/memory.ts`) under one fixed key: **`satchida_voice_profile`** (`agentId: null`).
  - Wired via dependency injection (`getVoiceProfileMemory` / `setVoiceProfileMemory` in `api/server/index.js` → `RealtimeProxyDeps`).
  - Users can view and edit their voice profile directly in the left-panel **Memories** UI.
  - Every Live Voice session loads `satchida_voice_profile` before sending the initial setup frame.

### Requirement 4 — Optional Follow-Up Preferences (Single Consolidated File)
- **Requirement**: Naturally (when the user is willing, never interrogating) gather optional preferences — city/location, vegetarian/non-vegetarian/vegan dietary preference, and daily morning brief + topics — and merge all of them into the same `satchida_voice_profile` record.
- **Implementation**:
  - `mergeVoiceProfile(existing, patch)` performs a non-destructive deep merge (preserving all existing fields and deduplicating `morning_brief.topics` and `known_speakers[]`).
  - Server-side extraction captures `dietary_preference` and spoken city (`extractSpokenCity`, with a guard rejecting non-city phrases like `"my location"`, `"here"`, `"nearby"` so real device GPS coordinates are never overwritten).

### Requirement 5 — Multi-Speaker / Room-Guest Pitch & State-Transition Detection
- **Requirement**: Detect voice pitch/pattern changes when another person in the room speaks, greet them naturally like a human, ask their name & relation, and store their profile (`name`, `relation`, `gender_hint`, `avg_pitch_hz`, `pitch_std_hz`) in the same memory file.
- **Implementation**:
  - **Client (`client/src/utils/voicePitch.ts`)**: Zero-dependency autocorrelation F0 pitch estimator (`70–360 Hz`, RMS-gated `>= 0.015`) fed from mic PCM frames in `LiveVoiceModal.tsx`, emitting `{ type: 'voice.acoustic_meta', avgPitchHz, pitchStdHz }` every 24 frames.
  - **Server (`packages/api/src/voice/voiceIntelligence.ts` + `realtimeProxy.ts`)**:
    - Calibrates `primary_voiceprint` on initial turns.
    - Uses **speaker state-transition tracking (`activeSpeakerKey`)** (`'primary'` | `'known:<name>'` | `'unknown:<pitchBucket>'`) instead of a wall-clock cooldown timer — zero redundant notices during long turns, instant detection when a third person speaks.
    - Matches `known_speakers[]` within `±30 Hz`; flags unknown guests at `>= 45 Hz` delta from primary baseline and caches `lastGuestAcoustic`.

### Requirement 6 — AI-to-AI Voice Agent Detection (ChatGPT / Copilot / etc.)
- **Requirement**: Detect when another AI voice agent is speaking via a second device and avoid infinite polite-greeting loops.
- **Implementation**:
  - `detectAiVoiceAgent(transcript, recentUserTurns)` in `packages/api/src/voice/voiceIntelligence.ts` detects explicit AI self-identification phrases and reciprocal assistant-style greeting loops on completed Gemini Live S2S `inputTranscription` turns (`processCompletedS2sUserUtterance`).

### Requirement 7 — Multi-Voice & Strict Grammatical Gender Enforcement (All Languages)
- **Requirement**: Support all 6 voices (`IN / US / UK` × `Female / Male`) in both Live Voice and the Header Read-Aloud speaker toggle, and strictly enforce masculine/feminine grammatical gender in all gendered languages (Hindi, Hinglish, Urdu, Marathi, Gujarati, French, Spanish, Portuguese, Arabic, etc.) as well as English.
- **Implementation**:
  - `HeaderAudioSpeaker.tsx` cycles through all 6 voices (`IN F/M`, `US F/M`, `UK F/M`) synced with `satchida_voice_id` / `satchida_voice_gender` in `localStorage`.
  - `realtimeProxy.ts` enforces symmetric `STRICT FEMININE GRAMMAR RULE` and `STRICT MASCULINE GRAMMAR RULE` with explicit verb-ending examples and forbidden opposite-gender forms.

---

## 3. Critical S2S Protocol Invariants (Lessons Learned)
1. **Never send `clientContent` with `turnComplete: false`** into an active Gemini Live S2S audio stream — incomplete text turns stall Gemini's audio VAD turn-taking (28–38s delays).
2. **Keep Gemini Live S2S `tools` pure (`[{ googleSearch: {} }]`)** — do not mix custom `functionDeclarations` into the same `tools` array as `googleSearch`, as it degrades native search grounding. Perform memory extraction server-side with zero latency impact.
3. **Never overwrite GPS coordinates with non-city phrases** (`"my location"`, `"here"`, `"nearby"`).

---

## 4. Key Files & Capabilities
- `packages/api/src/voice/voiceProfile.ts` (+ `voiceProfile.spec.ts`)
- `packages/api/src/voice/voiceIntelligence.ts` (+ `voiceIntelligence.spec.ts`)
- `packages/api/src/voice/realtimeProxy.ts` (+ `realtimeProxy.spec.ts`)
- `packages/api/src/voice/liveResolvers.ts` (+ `liveResolvers.spec.ts`)
- `api/server/index.js` (lines 1333–1364: `getVoiceProfileMemory`, `setVoiceProfileMemory`, `recordVoiceUsage`)
- `client/src/utils/voicePitch.ts`
- `client/src/components/Chat/Input/LiveVoiceModal.tsx` (+ `OrbVisualizer.tsx`)
- `client/src/components/Chat/HeaderAudioSpeaker.tsx`

### Additional Capabilities
- **Action Cards (`voice.action_card`)**: Weather, News, Maps, Media (`youtube`/`spotify`), and Tutor cards rendered inline in `LiveVoiceModal.tsx`.
- **Autonomous Research Bridge (`voice.auto_research`)**: Deep research queries automatically dispatch structured findings to LibreChat chat via `askRef.current` without manual tap.
- **Tier Gating & Telemetry**: `accountType` enforcement and `recordVoiceUsage` token/duration metering on session completion.
- **Location & Accent Switching**: `voice.location` GPS reverse-geocoding (protected by Invariant #3) and `detectAccentSwitchCommand` for live voice profile switching (`IN`/`US`/`UK` × `M`/`F`).
