# Provenance

## Upstream

- **Project**: huashu-art-motion ("Art in Motion") by alchaincyf (Huashu)
- **Repository**: https://github.com/alchaincyf/huashu-art-motion
- **License**: MIT License, (c) 2026 alchaincyf (Huashu) — see `LICENSE` in this directory
- The upstream project itself began as a code-only recreation of Tak's ([@cherry_mx_reds](https://x.com/cherry_mx_reds)) 15-second "Art History Speedrun"; its acknowledgments, licensing exceptions (Arphic stroke-order data, OFL fonts, the Huashu likeness, and the Anthropic Clawd mascot), and third-party reference credits carry over unchanged.

## Satchida rebrand

- **Date**: 2026-11-20
- **Product name**: Satchida Motion Art (`satchida-motion-art`)
- **Performed by**: Satchida AI, inside the Satchida AI / LibreChat harness (`D:\LAN-AI-Infra\LibreChat\skill\satchida-motion-art\`)

What the rebrand changed:

1. **Name**: the skill is renamed `satchida-motion-art`; SKILL.md frontmatter carries `name: satchida-motion-art` while `metadata.author`, `homepage`, and `repository` continue to credit the upstream author and repository, and a `rebrand: "Satchida AI, 2026-11-20"` field records this change.
2. **Filenames**: all project-artifact filenames referenced in documentation were converted to ASCII English per the rename contract: the shot-table document became the shot list (`<project>/shot-list.md`, template `references/shot-list-template.md`), the voiceover-script file became `script.txt`, the delivery notes became `delivery-notes.md`, the stills folder became `stills/`, the code project folder became `engine-project/`, the review folder became `review/`, per-shot renders became `shotNN.mp4`, the finished film `film.mp4`, the concat list `concat-list.txt`, voiceover `voiceover.wav`, score `music.wav`.
3. **Language**: all documentation (SKILL.md, README, CHANGELOG, CONTRIBUTING, the numbered method documents 01–18, the named guides, and the nine grammar cards) was translated to English. Chinese strings inside JSON/code examples that represent on-screen content the user sees were translated to English; code identifiers, API names, library namespaces, engine flags, and font family names (`PuHui-*`, `LXGWWenKai-*`, `CMU-*`, `Inter`, `RobotoCondensed`, `NotoSansSC`, `NotoSerifSC`) are unchanged. Quotations attributed to the author were translated; their meaning was preserved, not paraphrased beyond translation.
4. **README**: `README.md` is now the Satchida-rebranded English README; the upstream English guide remains as `README.en.md`; the Indonesian README (`README.id.md`) was removed per the English-only directive.

What the rebrand did not change:

- **Rendering behavior is unchanged.** Engine code, scene code, transition parameters, QA/gate thresholds, and the delivery pipeline are exactly upstream's except where another in-repo translation pass (scripts/, owned separately) applies consistent string changes; those changes are documented in that pass's own records.
- **Licensing is unchanged.** MIT applies to code and documentation; the upstream exceptions listed above still apply, including the demo-use-only restriction on the Huashu likeness and the exclusion of the Clawd fan-film assets from MIT.
- **Update checks still point upstream.** The version-check protocol in SKILL.md reads tags from the upstream repository, because releases continue to be published there.

Any divergence discovered later between this directory and upstream should be recorded either in `CHANGELOG.md` (functional changes) or here (translation/rebrand changes).
