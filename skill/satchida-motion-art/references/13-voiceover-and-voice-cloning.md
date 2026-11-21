# 13 · Voiceover and voice cloning

The unified entry and configuration are in [the optional voice guide](capabilities.md); interface details in [the voiceover API](voiceover-api.md).

Existing recordings carry over first; when new narration is needed, choose a system voice or a bound clone voice per the user's configuration. `scripts/koubo.py say/train/voices` keep the legacy entry points and share the same install-directory-external configuration with `scripts/capabilities.py`.

Each `say` produces one take — no automatic three-candidate selection or ASR. Patch recordings keep `--fit/--match`; after completion still verify lines, proper nouns, seams, and subtitles. Concrete models, speech rate, voices, and licensing are not hard-coded here.
