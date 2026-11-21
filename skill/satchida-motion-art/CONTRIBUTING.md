# Maintenance and extension

Public code and public recommendations live inside the package; personal platforms, voices, and credential references stay outside the install directory. Never turn one person's experience into everyone's default authorization.

## Local checks

```sh
python -m pip install requests Pillow
# ffmpeg/ffprobe must also be installed on the system; never auto-installed during normal skill activation
node tests/test_portrait_stage_centers.cjs
python -m unittest discover -s tests -v
```

Unit tests never call real voice/image services. Real-host acceptance is recorded in [the compatibility log](references/compatibility.md). A new adapter must state explicitly: configuration, probing, request and output contracts, and failure behavior; swapping only a base_url does not make it compatible with another platform.

## Image tool bridging

Read [the image guide](references/images.md). The host provides the actual tool declarations, the agent executes the calls, and the CLI generates the plan and accepts the artifacts. A receipt is not platform-signed provenance. Existing images, forbidden generation, no tools, unknown billing, reference-image permissions, and generation failures all need coverage.

A standalone image API executor remains an optional extension; this version does not auto-install it, register accounts, or borrow other agents' login state.

## Preserving user configuration across updates

The install directory may be replaced wholesale; user media.json must never be written into it. Old configuration gains new fields through default merging; new capabilities stay unselected/unauthorized, and existing voices are never retrained or reset automatically. When a field's semantics change, provide an explicit migration and rollback path.

## Release checks

After reviewing changes, stage this release's public files and generate the file manifest:

```sh
python scripts/check_release.py manifest --repo .
git add release-manifest.json
python scripts/check_release.py check --repo . --ref INDEX
# after committing, check all pending commits; base is replaced with the actual remote baseline
python scripts/check_release.py check --repo . --ref HEAD --base origin/main
```

The check inspects Git objects, not merely disk files; credentials written and later deleted in intermediate commits are still caught. The manifest proves only that the audited file set is consistent — it does not replace code review, real-media acceptance, or license verification. Bypassing the checks or rebuilding history to pose as a first release is forbidden.

When reusing code, keep the original licensing boundaries of the fonts, stroke-order data, and character demos. Personal feedback stays in personal configuration; only methods and interface experience with reproduction evidence enter public documentation, tagged with date, scope, and validation status.
