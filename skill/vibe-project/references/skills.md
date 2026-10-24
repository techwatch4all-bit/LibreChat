# Skill Tree — {{PROJECT_NAME}}

> The capability skills the vibe-coding agent should invoke for this project and when. This is
> the "skill tree every vibe-coding project starts with" — it tells the coding agent which
> specialized skills are available so it does not reinvent them.

## Core (always present)

| Skill | When to use | Notes |
|---|---|---|
| **vibe-project** (this) | At creation and handoff | Bootstraps + maintains the doc set |
| **ui-design** | Before building any screen | Look & feel, layout, flow |
| **web-development** / **frontend** | Writing UI code | Follow house conventions |
| **backend-patterns** / **api-design** | Any API or data layer | Naming, error handling |
| **security-review** / **security-best-practices** | End of every phase | Sweep for leaks, unsafe input |

## Satchida platform skills (use when relevant)

| Skill | When to use |
|---|---|
| `satchida-mode-routing` | Choosing the model tier for a request (FREE/LOWCOST/WORK/PRO_MID, never FRONTIER here) |
| `satchida-guardrails` hooks | Any chat / inference surface — apply `child-safety-gate`, `redact-secrets`, `guard-shell` |
| `tenant-provisioning` | If this project serves multiple tenants or an Edge deployment |
| `architecture-governance` | Any architectural decision; keep it consistent with the shared platform |
| `child-safety-compliance` | **Required** if any end user is a minor |

## Project-specific (fill in)

| Skill | When to use |
|---|---|
| {{skill or tool}} | {{scenario}} |

## Model routing defaults

- Chat / quick interactions: `LOWCOST` tier (cheap, sub-0.20).
- Coding / reasoning: `WORK` tier (e.g. DeepSeek @0.24) or `PRO_MID` (GLM) where justified.
- `FRONTIER`: never used. Budget basis is total cost, per `MODEL-TIERS.md`.
- Streaming is required for interactive chat; some low-cost models are empty on stream — fall
  back to `--no-stream` for those (as done for Aider + GLM).

## How to extend

When this project adds a skill, add a row above and note it in `CONTEXT.md`'s working
agreements so the next session knows it exists.
