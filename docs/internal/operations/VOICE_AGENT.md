# Satchida Live Voice — Architecture & Feature Documentation

## Overview
Satchida Live Voice provides real-time, low-latency bidirectional speech-to-speech interaction powered by Satchida Intelligence (`packages/api/src/voice/realtimeProxy.ts` + `client/src/components/Chat/Input/LiveVoiceModal.tsx`).

---

## Persistent User Memory (`satchida_voice_profile`)
- **Storage Backend**: Uses LibreChat's integrated MongoDB **Memory** system (`MemoryEntry` via `packages/data-schemas/src/methods/memory.ts`).
- **Single-File Consolidation**: All voice preferences and room-speaker profiles are merged into **one single memory key**: `satchida_voice_profile`. Users can inspect or edit this record directly from the left-navigation **Memories** panel.
- **Startup Loading**: Every Live Voice session loads `satchida_voice_profile` before sending the initial session setup frame, injecting known preferences directly into the voice persona's system instructions.

### Stored Fields
- `preferred_language`: User's preferred spoken language (e.g., `English`, `Hindi`, `Hinglish`, `Tamil`, etc.).
- `name`: User's preferred name.
- `location`: City/region for local weather, AQI, news, and recommendations.
- `dietary_preference`: Optional dietary preference (e.g., `vegetarian`, `non-vegetarian`, `vegan`).
- `morning_brief`: Optional `{ enabled: boolean, topics: string[] }` for daily morning briefings.
- `primary_voiceprint`: Calibrated baseline pitch (`avg_pitch_hz`, `pitch_std_hz`, `gender_hint`) for the primary account holder.
- `known_speakers[]`: Room guests (`{ name, relation, gender_hint, avg_pitch_hz, pitch_std_hz }`).

---

## Conversational Onboarding Flow
1. **First Session (No Language Saved)**:
   - Greets the user in polite English using their device's local time of day (*"Good morning / afternoon / evening! Which language would you prefer to speak in today?"*).
   - Saves the chosen language to `satchida_voice_profile` via `save_voice_profile` and immediately switches to that language.
2. **Name Collection**:
   - Once language is known, politely asks for the user's name and saves it to `satchida_voice_profile`.
3. **Optional Follow-Up Preferences**:
   - Naturally (only when the user is willing) asks about location, dietary preference, and daily morning brief topics, merging all answers into the same `satchida_voice_profile` entry.
4. **Returning Sessions**:
   - Skips onboarding and greets the user directly by name in their preferred language.

---

## Multi-Speaker / Room-Guest Detection
- **Client Acoustic Extraction (`client/src/utils/voicePitch.ts`)**: Lightweight autocorrelation F0 pitch analyzer runs on mic PCM frames, filtering silence and non-human frequencies (`70–360 Hz`).
- **Speaker Change Detection (`packages/api/src/voice/voiceIntelligence.ts`)**:
  - Compares incoming utterance pitch against `primary_voiceprint` and `known_speakers[]`.
  - When an unknown guest speaks (`>= 45 Hz` delta from primary baseline), Satchida greets them warmly like a human, asks their name and relation, and stores their profile in `known_speakers[]`.
  - When a known guest speaks again, Satchida recognizes and greets them by name.

---

## AI-to-AI Voice Agent Detection
- Detects when another AI voice assistant (e.g., ChatGPT Voice, Copilot, etc.) is speaking over another device via conversational markers and reciprocal assistant-greeting loops (`detectAiVoiceAgent`).
- Prevents infinite polite-greeting loops by calmly acknowledging the other AI and asking the human user how they would like to proceed (collaborate on a topic or pause).
