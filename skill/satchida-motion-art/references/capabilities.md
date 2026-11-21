# Optional voice: configure, skip, and existing assets

This page covers optional voice: existing audio, macOS system voices, Volcengine cloning. The image channel is in [the image capability guide](images.md). Configuration shares one external file; no services or plugins are installed.

## Before use

Check voice only when the task needs it; silent animations go straight to the picture flow. If the user already provided a suitable track, reuse it unless they explicitly ask for re-narration. Audio-only tasks do not start film design or film review.

`S` denotes the skill directory actually loaded this run — never fixed to the author's machine or any one agent's directory. Claude Code, Codex, and Kimi all use the same CLI calls, with no host-specific hooks.

```sh
python "$S/scripts/capabilities.py" status --explain
# add --project only when reading preferences of an already-trusted project
python "$S/scripts/capabilities.py" status --project <project> --explain
```

The check reads only tool configuration, the selected adapter's designated credential source, and necessary local dependencies; it never verifies online. `configured_unverified` means calling conditions are met but does not claim the account or audio quality is verified; `needs_configuration` means a voice mode must be chosen, and `prompt:false` means the user previously chose manual configuration, so do not re-ask proactively. Actual request success is judged by artifacts and receipts.

On first-run missing configuration, ask exactly one thing needed this time: reuse recordings, system voices, your own clone, or skip. When the user has specified, execute their choice directly; when new cloud calls/payment/training are involved, use only authorization already given this session — otherwise state the gap. Never ask the user to paste keys into chat.

## Save scope and skipping

Ordinary choices apply to this run only; only "from now on / default / remember" saves a user default. Ordinary configuration lives outside the install directory: on macOS/Linux `$XDG_CONFIG_HOME/huashu/media.json` (`~/.config/huashu/media.json` when unset), on Windows `%APPDATA%/huashu/media.json`. `HUASHU_CONFIG_HOME` overrides the directory; `--config` replaces the default user file.

After collecting choices, the agent generates non-sensitive JSON and hands it to the script; the script never blocks waiting on stdin interaction.

```sh
# example JSON: {"preferences":{"voice":{"mode":"system"}}}
python "$S/scripts/capabilities.py" configure --scope user --input <choices.json>
python "$S/scripts/capabilities.py" skip --scope task  # not persisted; skip this run
python "$S/scripts/capabilities.py" skip --scope user  # enable manually later; stop re-asking
python "$S/scripts/capabilities.py" reset --field preferences.voice
python "$S/scripts/capabilities.py" reset --field onboarding.voice
```

"Skipped this run" is recorded in this task's state and must not reopen a questionnaire on the next action. No answer is not consent, and configure does not run. Batch jobs missing required configuration exit nonzero with the reason; a silent preview may be delivered only when the user accepted a basic preview — never call it complete narration.

Preference order: this-run parameters → project preferences → user preferences → public defaults. A project's `<project>/.huashu/media.json` accepts only limited preferences and `deny` policies — never credentials, private voice bindings, or grants. `status --explain` shows each field's source; writes take a cross-process lock, and `--expected-revision` prevents an edit based on stale configuration from overwriting newer configuration.

## Three voice paths

```sh
# 1. Reuse existing audio, preserved byte for byte, and write metadata; if copying is unnecessary, reference the original track directly
python "$S/scripts/capabilities.py" use-audio --audio original-recording.wav --out <project>/audio/voiceover.wav
# 2. System voices: macOS only, fixed 48kHz WAV; for Chinese, pick from installed Mandarin voices
python "$S/scripts/capabilities.py" say "text to speak" --mode system --out <project>/audio/voiceover.wav
# 3. Configured and authorized Volcengine clone
python "$S/scripts/capabilities.py" say "text to speak" --mode clone --out <project>/audio/voiceover.wav
# Legacy calls stay compatible and share the same configuration
python "$S/scripts/koubo.py" say "confirmed patch lines" --out <project>/audio/patch.wav \
  --fit 3.5 --match original-track.wav --match-ss 10 --match-t 3.5
```

Never overwrite existing outputs. On success a sibling `audio-file.json` records duration, sample rate, SHA, and provenance; clones record the requested model, never claiming the server-reported actual model. Raw PCM is accepted as container audio first, then exported s16le, with sample rate and mono format written into the sidecar. System voices do not accept Volcengine model and speech-rate parameters.

The public default is "no voice mode chosen" — not the author's voice. Volcengine's suggested defaults are expressive, fidelity mode, speech rate 0; users can adjust under `provider_options.volcengine`. Private configuration may keep different rates and voices. Full fields: `schemas/media.schema.json` — do not guess fields.

Existing platform voices need no retraining:

```sh
python "$S/scripts/capabilities.py" bind --name narrator --speaker-id S_xxx --default
```

bind registers a local alias only — it does not call the platform, does not touch the original `~/.koubo/voices.json`, and does not auto-enable cloud calls. `--default` changes only the default reference; generation still requires choosing clone.

## Volcengine configuration and authorization

Credentials are read from process environment variables; an existing file may also be named in private `bindings.volcengine.env_file`, or set temporarily with `KOUBO_ENV`. Environment variables take precedence; never auto-scan the current directory, home directory, or the author's workspace for .env files. Configuration stores variable names/file references, never key values.

Enabling cloud cloning requires: `preferences.voice.mode=clone`, a resolvable voice, and both `policy.cloud` and `policy.paid_api` allow — or explicit user authorization given this session. `--allow-cloud` and `--allow-paid-api` only express authorization the user has already given this session; they are not a way to bypass rules and cannot override deny. When the user changes their own prohibitions, change the corresponding configuration explicitly first; host/organization limits still apply. Projects can only tighten, never grant.

Network proxying is controlled by private `bindings.volcengine.trust_env`; the public default follows the environment — do not impose one machine's proxy troubleshooting onto every installation. Basic configuration/existing audio needs only the Python standard library; audio acceptance needs ffprobe, system voices and fitting need ffmpeg, Volcengine additionally needs requests. Report missing dependencies; never auto-install.

Training is a separate operation requiring an explicit voice slot and this-session training authorization; `--force` skips only the low-level check, never authorization. Only passing `--default` sets the training result as the registry default.

```sh
python "$S/scripts/koubo.py" train --audio your-own-recording.wav --speaker S_xxx --name my-voice \
  --allow-cloud --allow-paid-api --allow-voice-training
```

Training changes the remote voice. The example's authorization flags may be used only after the user actually consents; never treat them as a routine pre-step of synthesis.

## Acceptance and failures

Fitting keeps the original coarse-adjust + atempo approach, at most 3 generations; each may bill. A final difference beyond ±0.05 seconds returns failure and keeps `.unfitted` candidates — never claim the duration passed. Synthesis must receive the server's end-of-stream success message; near-empty, silent, or error responses never become the final artifact. A network timeout may already have been billed — mark the result uncertain, and do not blindly repeat the request.

Formal films still need word-by-word read-back and proper-noun listening; the CLI never auto-selects among three candidates or runs ASR. Patch recordings should check seams, subtitles, and picture timing; when a video pipeline was used, hook into its paste-back and subtitle flow, and independent users may use their own edit project.

## Maintenance and evolution

Provenance: 2026-10-08, P0/P1 capability configuration implementation. Before use, read this page and the related API experience; reproducible interface faults get a test before the code is fixed. Reusable parameter rules go here or in `voiceover-api.md`, with date and scope stated; personal listening choices go in private configuration/private feedback and never become public hard requirements. Correcting old conclusions edits the original text; upgrading configuration never wipes preferences or auto-enables new capabilities.
