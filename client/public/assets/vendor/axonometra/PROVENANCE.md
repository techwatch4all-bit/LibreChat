# Provenance — vendored Axonometra engine

Everything in this directory is served from our own origin. No CDN, no third-party
runtime requests, consistent with the repo-wide self-hosted assets directive.

- **Upstream project:** Axonometra — https://github.com/qant-au/axonometra
  "An open-source 3D planning engine" (buildings and boats; floor plans at true scale,
  walls/doors/windows, multi-floor, three.js 3D view).
- **Vendored from:** npm package `@axonometra/editor` version **0.8.0**
  (built engine bundles + fonts + language files, zero runtime npm dependencies).
- **License:** MIT — see `LICENSE` in this directory. Axonometra is a maintained fork of
  NeonPlan 3D by Mastershort (MIT); upstream credit is carried in `NOTICE` in this
  directory. Both files ship inside the npm package and are preserved unmodified.
- **Files vendored:** `index.js` (standalone host: `mountAxonometra`, `memoryStore`,
  `browserStore`, `staticSignals`), engine bundles `axonometra.js`, `axonometra-3d.js`,
  `axonometra-editor.js`, `axonometra-wizard.js`, `axonometra-fun.js`,
  `axonometra-vessel.js`, `fonts/` (Figtree, Bricolage Grotesque — OFL licences included
  in the fonts directory), `lang/` (built-in UI languages), `images/solar-pro.jpg`
  (referenced by the wizard bundle).
- **Not vendored:** `types/` (TypeScript declarations), `package.json`, docs.
- **Consumed by:** `skill/satchida-architect-server.py` (Satchida Architect MCP server),
  which generates validated Axonometra plan JSON and emits an artifact HTML that mounts
  the planner via `mountAxonometra(el, { store: memoryStore({ building, revision: 1 }) })`.
- **Vendored on:** 2026-11-13.
- **Upgrade path:** `npm pack @axonometra/editor@<version>` in a scratch directory,
  replace the bundle files here, bump the consuming artifact's cache-buster, and record
  the version change in `Changes.md`.
