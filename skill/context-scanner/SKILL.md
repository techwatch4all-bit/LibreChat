---
name: context-scanner
description: Scan any project repository and generate a detailed CONTEXT.md file that lets any AI agent orient to the codebase without re-reading source files. Use when onboarding a new AI session to a repo, when a project lacks a CONTEXT.md, or when existing context is stale. Works on any tech stack (Node/Svelte/React/Rust/Python/Go).
risk: low
source: satchida-local
version: 1.0.0
---

# Context Scanner

Generate a comprehensive `CONTEXT.md` for any project repository so that AI agents can orient instantly — zero source file reads required at session start.

## When to Use

- Starting a new AI session on an unfamiliar repo
- A repo has no `CONTEXT.md` or it is stale (>7 days old)
- User asks "scan this project" or "build context for this repo"
- After major refactors that invalidate existing context

## Execution

### Step 1 — Determine repo path

Use the path provided by the user. If none given, use current working directory.

Confirm: `$RepoPath` is a directory with at least one of: `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `*.csproj`, `svelte.config.*`, `vite.config.*`, `tauri.conf.json`.

### Step 2 — Run the scanner script

**Primary (Windows PowerShell)**:
```powershell
D:\LAN-AI-Infra\skills\context-scanner\scripts\scan_project.ps1 -RepoPath "<path>" [-Force]
```

Use `-Force` to overwrite an existing `CONTEXT.md`.

**Fallback (Python, cross-platform)**:
```bash
python D:\LAN-AI-Infra\skills\context-scanner\scripts\scan_project.py --repo-path "<path>" [--force]
```

### Step 3 — Review and enrich

After the script runs, read the generated `CONTEXT.md` and:
1. Verify the **Architecture Overview** section is accurate — add hand-written notes for non-obvious patterns (e.g., IPC channels, custom build steps, runtime config pipelines)
2. Fill in the **Integration Points** section — list any sibling repos this project depends on or is embedded into
3. Fill in the **Pending Work** section — add known bugs or incomplete features from issue trackers or `TODO` grep
4. Commit the result: `git add CONTEXT.md && git commit -m "docs: add/update CONTEXT.md via context-scanner"`

### Step 4 — Update AGENTS.md

If the repo has an `AGENTS.md`, append this block (if not already present):

```markdown
## ⚡ MANDATORY FIRST STEP FOR EVERY SESSION

**Read `CONTEXT.md` in the repo root BEFORE opening any source file.**

`CONTEXT.md` contains the architecture map, file index, known issues, and session log.
After your session, append one line to the Session Log table in `CONTEXT.md`.
```

### Step 5 — Verify quality

The generated `CONTEXT.md` passes quality if an AI reading ONLY that file can answer:
- [ ] What is this project? What tech stack?
- [ ] Where are the entry points?
- [ ] Where is the config file for X?
- [ ] What are the top 3 known issues?
- [ ] How does this repo connect to its sibling repos?
- [ ] What should I NOT touch?

If any answer is missing, enrich the relevant section manually.

## Output Format

Return to the user:
1. **Path**: where `CONTEXT.md` was written
2. **Sections populated**: list of sections with ✅/⚠️/❌
3. **Manual enrichment needed**: any sections that need human/AI review
4. **Git commit hash**: the commit that captured the result

## Limitations

- Script does NOT read `.env` values — only key names
- Script does NOT traverse `node_modules`, `.git`, `dist`, `build`, `target`, `backup`, `__pycache__`
- For very large repos (>50k files), depth is capped at 3 levels — enrich manually
- Language-specific patterns (e.g., Rust trait objects, Svelte stores) need manual annotation
