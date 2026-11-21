# Compatibility and validation scope

Validation date: 2026-10-08. The following distinguishes install/configuration, host online execution, and actual media generation — one layer's pass never substitutes for another's.

## Installation and configuration upgrades

In an isolated Git workspace, the official skills CLI actually ran `skills add <local release package> --skill huashu-art-motion --agent <host> --yes --copy`, installing twice consecutively per target. All three targets — claude-code, codex, kimi-code-cli — succeeded, with the install-directory-external media.json byte-identical. What is validated is preference retention across overwrite reinstalls; it does not claim to have fully simulated every historical version's or every installer's update implementation.

Old voice configuration merged the new default fields without rewriting; the new image capability remained unselected and unauthorized. The Codex installation's CLI read the original system preference and revision, and did not revert to public defaults.

## Host online runs

- Codex CLI 0.160.1: a real session loaded the installed skill and guides, ran unconfigured status, disabled generation, no-tools, existing-image import, and private system-preference save; output images were byte-identical to sources and configuration sources matched expectations.
- Claude Code 2.1.287: installation and local CLI usable; the online session hit 429 from the current test environment's weekly quota, so the model-execution regression did not complete. This neither counts as an online pass nor proves the skill incompatible.
- Kimi Code CLI 0.38.0: installation and local CLI usable; the online session hit 403 from the current test account's access rights, so the model-execution regression did not complete. In this version, non-interactive `--prompt` cannot be combined with `--auto` or `--yolo`; the retry command was corrected but the account 403 remained.

These sessions used isolated workspaces and media configuration, reusing this machine's existing logins; they are not three brand-new accounts. Once Claude/Kimi account conditions recover, the online cases still need to run. Tool capability depends on the actual session — a host's name never implies image generation.

## Actual media and automated tests

macOS system voices and Volcengine cloning completed real short-sentence generation; the current Codex session actually called built-in image generation, producing a 1536×1024 PNG with transparent pixels, passing plan → tool call → receipt → project copy and SHA acceptance. The image tool call was made by the agent; the CLI did not substitute. This test proves only the intake path and file properties, not artistic quality.

Automated tests cover configuration merging, permission tightening, concurrent writes, legacy PCM output, incomplete voice streams, image feature/billing choices, cross-session plans, configuration revocation, concurrent image replacement, and release-object checks. CI runs on Linux; real system voices are validated on macOS only — Windows/Linux system-voice backends are not yet implemented.

## Reproducible minimum checks

```sh
python scripts/capabilities.py status --config <an empty JSON file> --explain
python scripts/capabilities.py image-status --config <a JSON forbidding generation> --mode generate
python scripts/capabilities.py use-image --file <existing PNG> --out <project>/images/new-file.png
python -m unittest discover -s tests -v
```

Actual image-tool validation builds a snapshot from the current tools' schema per images.md; with no tools it returns `unavailable` explicitly — never fake success with an invented tool. CI without credentials or authorization never calls paid media services.
