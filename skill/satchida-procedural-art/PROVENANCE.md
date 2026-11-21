# Provenance

- **Upstream project:** claude-drawing-skill by cloveric
  (https://github.com/cloveric/claude-drawing-skill)
- **License:** MIT, Copyright (c) 2026 cloveric — see `LICENSE` (retained verbatim).
- **Satchida rebrand, 2026-11-20:** renamed to `satchida-procedural-art`; all content translated
  to English per operator directive (SKILL.md rewritten within the deployment-loader limits:
  kebab-case name, ≤1024-char description, ≤100k-char body; all file paths ASCII); integrated into
  the Satchida AI / LibreChat harness (deployment skill loader + Satchida Art MCP tools:
  `generate_procedural_art`, `list_procedural_art_styles`).
- **No functional changes** to the rendering library (`lib/*.py`): only docstrings, comments, and
  display strings were translated; seeds, algorithms, and outputs are identical to upstream.
- The upstream quality system is retained in full: per-style example scenes in `examples/`
  (runnable + rendered JPG benchmarks), `docs/GALLERY.md`, `docs/PRINCIPLES.md`, and the per-style
  defect checklists (`docs/defect-checklists.md`).
