# 05 · Rhythm and music

Deconstruction method and reusable rules: `style-recipes/_audiotrack-art-history-speedrun.md` (section 5, "reusable rules", can be followed verbatim); synthesis script template (original example score): `scripts/audio/synth_art_history_speedrun.py`.

## Key points

1. **Fix the BPM grid first; picture and music both land on it.** 128 BPM with 0.234s eighth notes suits speedruns/montage. The `eighths` field in `eras.js` is how many eighth notes each section occupies.
2. **Acceleration comes from shorter sections, not faster tempo.** 6 → 4×5 → 3×4 → 2×3 → 1×3 → extended ending.
3. **One three-note motif per section, played by that style's representative instrument, transposed with the chords.** One four-chord loop of harmony is enough.
4. **Hard onsets between sections, no crossfades, no whooshes.**
5. **Ending SFX: stop — hover — crash — reaction — settle** (ding → falling whistle → shatter → cat meow → low pluck), timed to the picture's event frames.
6. **Loudness**: match the reference's integrated LUFS and true peak; compare relative differences per segment.
7. Omnimodal models' listening is candidate evidence only: instruments are trustworthy; BPM, motif note counts, and SFX timing must be recalibrated with onset detection.

## Counterpoint with the picture

- Transition starts = grid points; the camera impact (scene layer 1.03 → 1.0 over 20 frames) lands on the same point — the audible "click" and the visual jolt are the same event.
- Ending performance action frames (third cup slap, cup hitting the floor) align to audio onsets within 3 frames.
- Without a reference film: write the section table (eighth notes per section) first, then generate the picture timeline and score together; later rhythm changes only touch `eighths`.
