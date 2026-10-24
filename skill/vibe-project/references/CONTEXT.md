# Project Context — {{PROJECT_NAME}}

> Read first. Everything else in this repository assumes what is written here.

## Objective

{{One or two sentences: the problem this project solves and the outcome it must deliver.}}

## Why it exists

{{Background: what prompted this. Which tenant / audience / operator need it serves. If this is
a "STUDY" learning module, say who the learners are and what they should be able to do at the
end.}}

## Workspace

- Source / working folder: {{absolute path, e.g. D:/LAN-AI-Infra/vibe-apps/<name>}}
- Runtime / data (if any): {{path}}
- Depends on (gateway, models, storage, other services): {{e.g. Satchida Gateway :8700, DeepInfra
  DeepSeek/GLM tiers, LibreChat :3080, MongoDB :27017, Ollama :11434}}

## Product boundaries

- **In scope:** {{what this project does}}
- **Out of scope:** {{what it explicitly will NOT do — write it down now to avoid scope creep}}
- **Non-negotiables:** {{security, child-safety, privacy, cost ceiling — any hard constraints}}

## Who it is for

- Primary users: {{personas}}
- Secondary users / operators: {{admins, teachers, parents}}

## Working agreements

- All docs, code comments, and output are written in **English**.
- No API keys, tokens, passwords, or `.env` contents are ever committed to docs or source.
- `tasks.md` is the single source of truth for pending work; `bugs.md` for defects.
- Documents read in this order: `CONTEXT.md` → `ARCHITECTURE.md` → `PRD.md` → `TRD.md` →
  `Implementation-plan.md` → `tasks.md` → `bugs.md`. Tooling/skill setup lives in `skills.md`.
