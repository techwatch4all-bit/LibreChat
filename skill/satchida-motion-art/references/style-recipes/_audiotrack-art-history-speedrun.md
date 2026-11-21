# Audio-track method · code-synthesized score for speed-run films (deconstruction method + original example)

This page distills a method from one deconstruction: the reference film is X user Tak's (@cherry_mx_reds) 15-second "Art History Speedrun", whose score itself is code-synthesized. Only **how to deconstruct, how to write, how to mix** is kept here — no note-by-note transcription of the original track.

Companion script: `scripts/audio/synth_art_history_speedrun.py`. The score is an **original example** (D minor, harmony Dm–B♭–F–C); the section structure matches the visuals' `scripts/engine/eras.js`; the instrument library and mix chain are reusable as-is — just swap in your own score.

---

## 0. One-line conclusion

A speed-run short film's score can be **a programmatic arrangement on a strict BPM grid**: 17 eras laid out by "eighth-note counts" (6,4,4,4,4,4,3,3,3,3,2,2,2,1,1,1,9), each section shorter toward the end — acceleration comes from "sections getting shorter" while tempo itself never changes. Each section swaps in that era's representative instruments, and one three-note motif transposes with the chords across the whole film. Once the music halts on the grid, a chain of cartoon SFX (ding, slide-whistle fall, crash, cat meow, closing pluck) delivers the ending gag.

---

## 1. How to deconstruct a reference score

| What to measure | Method | Precision/confidence |
|---|---|---|
| Tempo and grid | superflux-style spectral flux over the STFT (hop 2.5ms), peaks as onsets, then least-squares fit `t = t0 + n·E` (28 onsets) | E = 0.23431s (eighth note) → **128.04 BPM**, grid zero t0 = 0.028s. Residuals all within ±4ms — human performance can't do this, so it must be code-scheduled |
| Era boundaries | Three-way corroboration: (1) grid positions; (2) peaks of the MFCC novelty curve (distance of ±0.2s mean windows); (3) peaks of the video's per-frame diff | Audio boundaries (grid) vs MFCC peaks deviate ≤20ms. Visual transitions lag audio 0–0.2s (visuals use 0.1–0.2s wipes/deforms) |
| Pitch | (1) Spotify basic-pitch polyphonic transcription (ONNX, Python 3.11 temp env); (2) 85ms FFT peaks on the 16th-note grid, gain >6dB before/after onset = new note; (3) a hand-written CQT semitone-energy map read by hand | Melody's main voice is high-confidence (two methods agree). Harmony inner voices and the ukiyo-e and Van Gogh sections are medium confidence |
| Timbre | For each melody note take harmonic amplitudes 20–220ms after onset (H1–H8, ±1.5% narrowband), then measure the narrowband envelope's attack time and decay (+50/100/200ms relative to peak) | Polyphony mixes in other voices; harmonic ratios are tendencies only |
| Percussion | Per 16th note, energy jumps >6kHz (noise class) and <150Hz (drum class) | High |
| SFX | FFT peak tracking with 20ms steps over 13–15s, aligned to events via a 2.1s visual contact sheet (one frame per 0.1s) | High |
| Loudness | ffmpeg ebur128; per segment, BS.1770 K-weighted, ungated mean square | Overall **-14.3 LUFS, LRA 0.9 LU, true peak -2.4 dBTP** (the commonly quoted "average -16.6dB" is an RMS mean — a different metric) |
| Omnimodal model "listening" | Have an omnimodal model listen to the whole film once, with composer-view custom questions | Treat only as candidates, verify item by item — see section 4 |

---

Two more lessons: timbre judgment is most stable with "harmonic amplitudes 20–220ms after onset + narrowband envelope decay"; judging "is this code-synthesized" takes three checks — are time residuals within ±5ms, are the timbres all textbook primitives (sine/square/saw/exponential decay), and is there recorded noise floor in the silent spots.

---

## 2. The original example score (the `era()` blocks in the script)

The time unit is the eighth note; start = `t0 + n·E`. The motif ♪♪♩ is labeled "motif".

| # | Era | Length | Instrumentation | Notes the example writes |
|---|---|---|---|---|
| 1 | Cave | 6 | Bone flute + hand drum + weak-beat strikes | Descending expanded A4–G4–D4 |
| 2 | Egypt | 4 | Harp + sistrum | Dm→B♭ arpeggios; motif F5–G5–D5 |
| 3 | Greek black-figure | 4 | Lyre + double aulos | B♭ chord; D5 → F5 |
| 4 | Rome | 4 | Horns + war drums | Motif C5–D5–A4, F→C→Dm |
| 5 | Gothic | 4 | Organ | Dm → Gm/D, D2 pedal |
| 6 | Renaissance | 4 | Harpsichord + bass viol | Motif B♭5–C6–G5, Gm→F |
| 7 | Ukiyo-e | 3 | Koto + taiko + hyoshigi | 16th-note plucks on the D in-sen scale (D–E♭–G–A–B♭) |
| 8 | Impressionism | 3 | Soft piano | Motif variant A5–C6–G5, Fmaj7 → B♭ → Dm9 |
| 9 | Van Gogh | 3 | Bright plucks + wind | D2 bass groove, sparse high A5/F5/D6/E5 |
| 10 | Art Nouveau | 3 | Celesta | Motif D5–E5–A4, B♭→C→Dm |
| 11 | Cubism | 2 | Piano-like struck strings | Deliberately dissonant: D–G♯–C♯ → E♭–A–B♭–E |
| 12 | Bauhaus | 2 | Marimba-like staccato + mechanical ticks | D stacked five octaves → F/A → D |
| 13 | Pop | 2 | Drum machine + cartoon stabs | Kick, offbeat claps, D/F stabs |
| 14 | Pixel | 1 | Square wave | F major triad 32nd-note arpeggio |
| 15 | Ray-trace | 1 | Supersaw | B♭ chord |
| 16 | Memphis | 1 | Supersaw sustained chord + kick + upward gliss (the cat leaps onto the table) | C major triad held over the section end |
| 17 | 2026 | 9 | 128BPM house: four-on-the-floor kick, offbeat open hat, saw bass, square-wave stabs, pad | Modulates to D major add9: F♯5 A5 D6 E6 F♯6 E6 D6 B5 A5 |

When writing your own score: fix the harmonic loop and one three-note motif first, then fill each section's "representative instrument + transposed motif" per the section table; "off-grid" sections (exotic, avant-garde) only change mode or add a tritone — rhythm and grid stay untouched.

---

## 3. Ending SFX (designed as "stop—hang—slam—react—close")

| Event | Synthesis method (functions in the script) |
|---|---|
| Music stops | Bass with a fast ~150ms decay, no hard cut |
| Paw taps cup "ding" | A few 5–7kHz inharmonic ringings + a bit of 1.5kHz (`tink`), with a high-frequency whoosh (`swipe`) |
| Cup falls | Pure sine exponential glide ~1550→325Hz, 0.35s (`slide_whistle`) |
| Ground crash | A ~80Hz thud + broadband noise (centroid 5–7kHz, ~0.45s decay) + ceramic inharmonic overtones + a few shard micro-collisions (`crash`) |
| Cat meows | Harmonic synthesis with a linear zigzag pitch (up then down) + two formants, loudest in the whole film (`meow`) |
| Signature appears | Two soft ~90Hz "bops" with a bright point (`end_thump`) |
| Close | A low pluck landing on the tonic |

All time points align to visual events from the contact sheet (one frame per 0.1s).

---

## 4. Mixing recipe (second half of the script, usable as-is)

1. 0.5s small-room reverb, 12ms pre-delay, 9% wet
2. Per-section low warm bed: under each section's chord root (`BED_ROOT`), lay "triangle wave + octave-below sine, 250Hz lowpass"; level auto-computed from the relative "floor vs section loudness" — sections that already have enough don't get more
3. Per-section 2–6kHz dynamic EQ (`MID_ORIG`)
4. Per-section >6kHz air noise top-up (`HF_ORIG`)
5. Per-section K-weighted loudness alignment to `target`, 4 iterations, 10ms smoothed gain to prevent zipper noise
6. Optional: 15.8kHz steep lowpass simulating streaming AAC
7. Overall LUFS alignment, then look-ahead peak limiting

With a reference film, fill `target / MID_ORIG / HF_ORIG / LOW_FLOOR_ORIG` with per-section measured values (using section 1's method); without one, the example's "uniform relative values" suffice.

Attack-softening lesson: the pluck model's 2ms hard attack sounds too "pointy"; switching to a 10ms linear attack, with higher harmonics attacking later (×1.6 per harmonic order, capped 35ms), attack noise halved plus a 7kHz lowpass — the whole thing gets much more coherent.

Example output: 48k stereo, 15.06s, -14.0 LUFS, true peak -1.5 dBTP.

```
uv run --with numpy --with scipy --with soundfile python scripts/audio/synth_art_history_speedrun.py
```

---

## 5. Reusable rules: code-synthesized scores for any animation

These can be copied directly.

1. **Fix a BPM grid first; everything aligns to it.** 128 BPM (eighth note 0.234s) suits "speed-run, montage" rhythms; edit points, musical onsets, and SFX landings all take `t0 + n·E`. The benefit: however the picture is cut, the music never feels scattered. The reference's time residuals are only ±4ms — that "machine-like precision" is itself part of the style.
2. **Accelerate by "fewer eighth notes per section", not by raising tempo.** This film is 6 → 4×5 → 3×4 → 2×3 → 1×3, with the last section lengthened (9) to let the audience breathe and make room for the gag. Tempo unchanged, yet it sounds increasingly urgent; and every section lands on the grid, naturally in sync with picture cuts. Method: list each section's duration, round to eighth notes, then micro-adjust overall so the decrease becomes regular.
3. **One three-note motif, repeated with different instruments and transposed by chord.** Pick a short, rhythmically distinct cell (the example's is ♪♪♩ "step up, then leap down"), perform it once per scene with that era's or style's representative instrument, pitch following the section's chord. A four-chord loop suffices as harmonic skeleton (the example: Dm–B♭–F–C); "off-grid" sections (exotic, avant-garde) only change mode or add a tritone — rhythm and grid untouched. The opening can use the motif's inversion or augmentation (the example's cave section is a descending dotted quarter) to establish it first.
4. **No crossfades between sections.** The new section attacks hard on the grid; the previous section's notes keep their natural tails (plucks 30–300ms, sustained tones ~150ms release); a bass pedal can bridge two sections as a "seam". Every scene change then has a clear "click" without breaking. No per-section transition whoosh needed (the reference has none).
5. **Ending SFX designed as "stop—hang—slam—react—close"**:
   - Stop: the music halts on the grid with a ~150ms fast decay, no hard cut
   - Hang: one small "ding" as a lead-in, then the falling whistle (pure sine exponential sweep, ~0.35s, over two octaves)
   - Slam: thud + broadband noise + inharmonic overtones + a few shard micro-collisions, ~0.45s decay
   - React: a character vocalization, e.g. the linear-zigzag-pitch "meow", placed ~0.5s after the slam, loudest in the whole film
   - Close: one or two soft "bops" with the signature, ending on a low pluck landing on tonic or dominant
   All aligned by event time from the contact sheet (one frame per 0.1s).
6. **Loudness alignment method**:
   1. First measure the reference's overall values (ffmpeg ebur128: integrated LUFS, LRA, true peak)
   2. Then per-section K-weighted loudness, plus the deltas of 2–6kHz, >6kHz, and the 40–220Hz floor relative to section loudness
   3. After synthesis, in order: per-section low warm bed → per-section mid/high dynamic EQ → per-section air noise → per-section loudness iterative alignment (3–4 times, 10ms smoothed gain to prevent zipper noise)
   4. If the reference is AAC, add a 16kHz lowpass
   5. Finally overall LUFS alignment plus look-ahead peak limiting
   Work entirely with "relative to section loudness" deltas, never absolute values — then swapping material or overall loudness needs no re-measurement.
7. **Turning synth.py into a generic template** (structure unchanged, swap four data blocks):
   - `T0, E`: grid zero and eighth-note duration (BPM → `E = 60 / BPM / 2`)
   - `edges / target / MID_ORIG / HF_ORIG / LOW_FLOOR_ORIG / BED_ROOT`: section boundaries and per-section reference values; without a reference, fill `target` with one uniform value (e.g. -14) and the other three with "no-op"
   - The score blocks of `era(n0, items)`: one line per section, elements `(relative eighth position, instrument function, gain, pan)`. The instrument library (`pluck` family, `additive` sustained family, `kick / clap / hat / taiko` drums, `chip / supersaw` synths) is directly reusable; a new style usually only tweaks `pluck`'s harmonic table and decay parameters
   - The SFX block: call `tink / slide_whistle / crash / meow / end_thump` at event times, with parameters (frequency, duration) measured from the reference or set per section 5's template
   The second half's mix chain (warm bed → EQ → air → loudness iteration → lowpass → limiting) stays as-is.
8. **Order of the analysis workflow**:
   1. Onset-flux grid fitting first, to get BPM and t0
   2. Per-cell FFT new-note detection on the 16th-note grid, cross-validated with basic-pitch polyphonic transcription
   3. Timbre judged by narrowband harmonic ratios and envelope
   4. Percussion judged by high/low-frequency energy jumps
   5. The omnimodal model is candidates only, verified item by item. In practice it was reliable on instrument identification but wrong on tempo (said 120, measured 128), motif note count, "transition whoosh", and SFX timing
