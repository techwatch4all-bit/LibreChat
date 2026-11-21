# Optional images: existing assets and current-agent generation

Image intake has two halves: the agent observes the current tools and calls them under user authorization; the script parses choices, checks artifacts, and saves them into the project. The script does not simulate host tools, does not borrow other agents' logins, and never switches image APIs automatically.

## Look at the task first, then the configuration

Existing images import directly via `use-image`. Code animation that needs no images skips this page. For new generation, read explicit preferences in the rules loaded this session first, then this tool's configuration; when the user has already asked for generation, execute with the actual tools and existing authorization — do not force another question just to fill in configuration.

```sh
# S is the skill directory actually loaded this run
python "$S/scripts/capabilities.py" image-status
python "$S/scripts/capabilities.py" use-image --file original.png --out <project>/images/asset.png
```

`preferences.image.mode` supports `unconfigured/off/existing/generate`, with provider being the current tool's exact ID or auto. `off` is the default do-not-generate preference, overridable by an explicit request this run; `policy.image_generation=deny` is a prohibition that temporary authorization flags cannot override. Save an explicit user "forbidden" as a policy, not only as a mode.

On first-run missing configuration, ask only: existing assets / allow the current tool to generate / skip. `skip --capability image --scope task` is not persisted; `--scope user` means long-term manual enable. When the user chooses only this run, do not save it as a long-term default. Existing voice configuration survives upgrades; the new image capability stays unselected and never auto-approves.

## Current-tool snapshot

The agent reads names and schemas from the tool list the current session already exposes (or the host's official tool search), confirms supported operations, then writes an in-task snapshot. It must not be inferred by scanning keys, installed skills, or agent names. With no tools, write `tools: []`.

```json
{
  "host": "codex",
  "session_id": "unique id for this task",
  "observed_at": 0,
  "tools": [{
    "id": "actual current tool id",
    "kind": "host",
    "operations": ["generate", "edit"],
    "reference_images": true,
    "transparent_background": true,
    "cost": "subscription",
    "network": "cloud"
  }]
}
```

The example is not a capability claim: `observed_at` must be filled with this run's Unix time, and tool features and IDs must come from the actual schemas observed this run; snapshots are valid 15 minutes. host may be codex, claude-code, kimi, or other; kind may be host or mcp. Billing is subscription/paid_api/unknown/none; network is cloud/local. A subscription does not mean unlimited quota; when billing is unclear use unknown, never none.

All three hosts use this one contract. One Codex session having image_gen does not mean every Codex product surface has it; Claude Code/Kimi may also use suitable MCP image tools if exposed — otherwise import existing images or state what remains to be produced. Do not invent built-in same-name tools for the latter two.

## Plan → host executes → accept

Request JSON:

```json
{
  "prompt": "user-confirmed image description",
  "operation": "generate",
  "references": [],
  "transparent_background": true,
  "min_width": 512,
  "min_height": 512
}
```

Edits use `edit` plus reference files; relative paths resolve against the request JSON. The script verifies reference images decode and saves hashes; later changes invalidate old plans.

```sh
python "$S/scripts/capabilities.py" image-plan --request request.json \
  --host-tools current-tools.json --session this-run-id --mode generate \
  --allow-image-generation --allow-cloud --out execution-plan.json
```

Authorization flags only express authorization the user has already given this run. Cloud reference-image upload additionally needs `--allow-reference-upload`; explicit paid APIs need `--allow-paid-api`; unknown billing needs `--allow-unknown-image-cost`. Long-term allowances go into the corresponding policy fields. Projects may only set deny, never grant these rights. Prohibitions are handled first; when several allowed tools still cannot be uniquely chosen it returns needs_selection rather than guessing a platform.

On receiving `host_action_required`, the agent calls the tool per its real schema; the plan is a semantic requirement, not a cross-platform parameter body. Write the receipt only after generation succeeds:

```json
{
  "status": "success",
  "plan_id": "the id from the execution plan",
  "session_id": "this run's id",
  "tool_id": "the actually called tool id",
  "output_sha256": "actual output file SHA256"
}
```

Keep the actual tool-call record as evidence. A receipt is an agent-reported call record, not platform-signed authentication; reading PNG metadata alone cannot prove which model generated it.

```sh
python "$S/scripts/capabilities.py" accept-image --plan execution-plan.json --receipt receipt.json \
  --host-tools current-tools.json --session this-run-id --file host-output.png \
  --out <project>/images/final-asset.png --allow-image-generation --allow-cloud
```

Acceptance re-checks current authorization, image-related configuration, tools, session, reference images, file hashes, actual dimensions, and transparent pixels. Plans are valid 1 hour; when a capability snapshot expires, refresh it — never edit an old plan to pretend it is still valid. When the original or sidecar exists, never overwrite; static PNG/JPEG/WebP are supported, Pillow is required, and tools are never auto-installed. Image content and reference identity still need visual verification — hashes and dimensions do not replace looking.

On pass, copy into the project and write a sibling JSON with dimensions, transparency, SHA, tool id, plan linkage, and `provenance: agent_reported_tool_call`. Do not reference an agent cache as the project's final asset, and do not claim to have verified a model name the server never returned.

## Extension and flow-back

When adding an image API adapter, first pick a real vendor, then implement its auth, request, output, and error protocols, and write success/failure contract tests. A URL claiming OpenAI-compatibility does not automatically become a usable backend; this version ships no generic API executor or self-installer. Existing MCP tools belong to the current agent's tool channel and are driven by their schema.

2026-10-08: P2 established the choice → host action → asset acceptance interface. Before reuse, read this page and the vendor's current tool documentation; for reproducible failures, add a test and fix the original logic, and personal preferences go only into private configuration. Voice and images enable separately, and upgrades never widen existing authorization. Record deterministic acceptance separately from visual quality conclusions.
