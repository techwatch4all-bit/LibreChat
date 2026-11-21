# Voice clone model review

The platform record's `selection` stores the user's listened-and-chosen model, speech rate, voice-registry reference, and upgrade preference. When calling that platform, first run `voice_review.py --provider <platform>` to read the choice; an explicit model this run takes precedence over the stored choice. Periodic updates preserve `selection` — official candidate lists never overwrite a personal choice. Until a generic vendor adapter exists, follow the recorded pointer to the validated project's calling method, and never present a query tool as a synthesis tool.

For pre-clone checks and user-authorized periodic patrols. Records live in `voice-model-review.json` in the same directory as `capabilities.py`'s actual user configuration; private configuration is never committed.

Each platform saves independently:
```json
{"providers":{"qwen":{"checked_at":"2026-10-15T12:00:00+08:00","models":[],"sources":[],"findings":"official listings and account-level availability are recorded separately"}}}
```

`checked_at` updates only after this run successfully reads and cross-checks official material. Failures record `last_attempt_at` and `last_error` while keeping the old success time. `sources` keeps source URLs, access dates, and relevant facts; `models` records exact IDs, purposes, official support, and field-tested status — never lump ordinary TTS, voice design, or realtime conversation in with voice cloning.

For Doubao, first check Volcengine Doubao speech's voice-cloning and synthesis docs; for Qwen, first check Bailian's speech-synthesis model list, voice-cloning guide, and API docs. Leaderboards are candidate leads only — they never count as evidence of a public API ID or account availability. Confirm whether old and new interfaces migrated, reference-audio requirements, pricing, and model deprecations; finding nothing in search does not mean nothing changed.

The weekly check reads only official material and local configuration, updates records, and reports additions, deprecations, or limit changes. Never top up balances, retrain, switch defaults, or repeat paid tests on your own. After a user-authorized test, separately record the requested model, receipt, audio acceptance, and listening feedback; suggest changing a default only with enough actual listening and reliable call evidence.

Provenance: 2026-10-15, the user asked for weekly checks of Doubao/Qwen updates and a report of the current model and last check time at every clone. When official material conflicts with old records, correct the old conclusion and keep the correction's basis; personal listening choices and public capability stay separate.
