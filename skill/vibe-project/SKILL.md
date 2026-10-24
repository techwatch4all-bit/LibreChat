---
name: vibe-project
description: Scaffolds a complete document set for a new vibe-coding project after the coding workspace reports ready. Every new vibe-coding / STUDIES project started from LibreChat gets (1) a fresh empty project folder under the shared vibe-apps workspace, (2) a pre-filled standard doc set copied from the bundled references/ templates, and (3) a skill tree so the coding agent knows which capability skills apply. The scaffold must run before substantive feature code is written, not after.
when-to-use: When a user asks to start / create / begin a new vibe-coding project, app, tool, or "STUDY" learning module from LibreChat; when a generated project lacks a document root; when handing a project to a coding agent (Aider / OpenHands / opencode) that needs context.
allowed-tools: filesystem, memory, bash, Read, Write, Edit
user-invocable: true
always-apply: false
---

# Vibe-Coding Project Scaffold (skill tree entry)

Every vibe-coding project started through LibreChat must be born with a document root, not
grow one later. This skill standardizes that so any coding agent (Aider, OpenHands, opencode)
opens the project and instantly understands **what, why, how, and who it is for** before it
writes a line of code.

## When to run

Run this scaffold **once, at project creation**, immediately after the user describes the idea.
If the project folder already exists but has no `CONTEXT.md`, scaffold anyway (never overwrite a
non-empty `CONTEXT.md` — merge instead).

## The reference templates

The canonical templates live in this skill's `references/` directory. Copy each into the new
project root and replace every `{{PLACEHOLDER}}` with the project's real values:

| Template file (references/) | Becomes (project root) | Purpose |
|---|---|---|
| `CONTEXT.md` | `CONTEXT.md` | Domain language, objective, workspace, product boundaries, working agreements. Read first. |
| `PRD.md` | `PRD.md` | What we build: personas, goals, user stories, requirements, out-of-scope, success metrics. |
| `TRD.md` | `TRD.md` | How it must behave: inputs, outputs, states, errors, non-functional tech constraints. |
| `UI-UX.md` | `UI-UX.md` | Look and feel: layout, flows, components, guidance on schools/kids UX where relevant. |
| `ARCHITECTURE.md` | `ARCHITECTURE.md` | How it is built: components, data flow, integration points, deployment. |
| `Implementation-plan.md` | `Implementation-plan.md` | Phased build order (Phase 0..N) with acceptance criteria per phase. |
| `tasks.md` | `tasks.md` | The living task board: one item per unit of work, statuses, dependencies, owner. |
| `bugs.md` | `bugs.md` | Living defect log. One row per bug: ID, severity, state, evidence, remediation. |
| `skills.md` | `skills.md` | The project's skill tree: which capability skills apply and when to invoke each. |

Optionally also write `AGENTS.md` (the runtime contract for the coding agent) and, when the
project serves minors, `CHILDREN-SAFETY.md` — mirror the repo convention in this workspace.

## Procedure

1. **Confirm the project root.** Default: `D:/LAN-AI-Infra/vibe-apps/<project-name>/`. If the
   user names a different location, use theirs.
2. **Create the folder** if it does not exist (and a `docs/` or `references/` subfolder if the
   project will have many diagrams).
3. **Copy the 9 templates** from this skill's `references/` into the project root.
4. **Fill the placeholders.** Ask the user only for what is genuinely unknowable (target
   audience, core feature, model/stack preference). For everything else, draft the best value
   from the idea already described and flag it as `[DRAFT — confirm]`.
5. **Keep `tasks.md` the single source of truth** for pending work. When any future session asks
   "what's pending", point at `tasks.md` first. Do not let pending items live only in session
   memory — they are lost.
6. **Cross-link.** Edit the project `CONTEXT.md` to note "Documents read in this order" and add
   a pointer to `skills.md` so the coding agent self-orients.

## Rules for the coding agent after scaffolding

- Read `CONTEXT.md` then `ARCHITECTURE.md` before writing feature code.
- Every change lands in `tasks.md` (a task flip to doing/done) or `bugs.md` (a new bug row); a
  change that touches none of them is not finished.
- Do not paste API keys, tokens, or `.env` contents into any of these docs.
- Write in English only.
