# Architecture — {{PROJECT_NAME}}

> How this project is built and how it connects to the shared Satchida platform. Read after
> `CONTEXT.md`.

## 1. Component view

```
{{Browser / client}}
   │
   ▼
{{App entry (e.g. static page served by LibreChat / OpenVSCode / direct file)}}
   │
   ├──────────────► {{Feature A}} ──► {{Data source}}
   │
   └──────────────► {{Coding / inference via Satchida Gateway :8700}}
                        │
                        ▼
                {{DeepInfra: DeepSeek / GLM tier routes}}
```

## 2. Component responsibilities

| Component | Responsibility | Language / runtime | Where it lives |
|---|---|---|---|
| {{Client / UI}} | {{}} | {{HTML/JS, React, …}} | {{path}} |
| {{Logic / service}} | {{}} | {{}} | {{path}} |
| {{Data}} | {{}} | {{MongoDB / file / none}} | {{path}} |

## 3. Data flow

{{What data moves, in what order, and where it is stored. Explicitly call out: nothing that
must stay secret (API keys, user tokens) is stored in client-visible files; any such value goes
to the operator's dotenv/vault only.}}

## 4. Integration points

- Satchida Gateway `:8700` — inference / model routing (tiers per `MODEL-TIERS.md`).
- LibreChat `:3080` — entrance / chat surface (project launched from here).
- Guardrails — `satchida-guardrails` hooks (`child-safety-gate`, `redact-secrets`,
  `guard-shell`) as relevant.
- {{Other services}} — {{and what for}}.

## 5. Deployment

- Host: {{this LAN AI infra / per-tenant clone / Edge device}}
- How it is served: {{static drop into hosting, OpenVSCode workspace, Docker, …}}
- Secrets: {{named only, never values — see CONTEXT.md working agreements}}

## 6. Known simplification

{{If this is a single-file quick prototype, say so and note the upgrade path.}}
