# Technical Requirements — {{PROJECT_NAME}}

> The "how it must behave" spec. Complements PRD (the "what"). Used by the coding agent as the
> contract it must satisfy.

## 1. System context

{{Where this component sits: who calls it, what it calls, data sources. One short diagram in
text/ASCII or a `docs/` reference.}}

## 2. Inputs / outputs

- Inputs:
  - {{payload / event / user action — types, structure, constraints}}
- Outputs:
  - {{response / side effect / file written — types, structure}}

## 3. States and transitions

{{Describe each state the system can be in and the events that cause transitions. Missing-state
handling must be explicit.}}

## 4. Error handling

- {{Error 1}}: {{what triggers it → what the user sees → what the system logs}}
- {{Error 2}}: {{what triggers it → what the user sees → what the system logs}}
- **Fail-open / fail-closed policy:** {{for guardrail-gated operations. Default: fail closed on
  active harm categories, fail open on tool latency so the agent is never silently blocked}}

## 5. Technical constraints

- Runtime / language: {{e.g. plain HTML/JS, React, Node}}
- Model / API dependencies: {{DeepSeek-V4-Flash, GLM-5.3-Flash, tier routes per MODEL-TIERS}}
- Data store: {{MongoDB collection / file / in-memory}}
- Integration points: {{gateway :8700, LibreChat :3080, Ollama :11434, etc.}}
- Guardrails: {{which satchida-guardrails hooks apply}}

## 6. Acceptance criteria (per requirement)

- TR-1 (from FR-1): {{testable behavior}}
- TR-2 (from FR-2): {{testable behavior}}
- TR-3 (from FR-3): {{testable behavior}}

## 7. Out of scope for this build

{{Explicitly deferred items so the agent does not invent them.}}
