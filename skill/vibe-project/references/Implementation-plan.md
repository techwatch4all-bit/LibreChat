# Implementation Plan — {{PROJECT_NAME}}

> Phased build order with an acceptance gate at the end of each phase. Do not start Phase N+1
> until Phase N's gate passes. Track progress in `tasks.md`.

## Phase 0 — Workspace preparation

- [ ] Scaffold project folder and this document set (this skill). **Gate:** `CONTEXT.md`,
      `PRD.md`, `TRD.md`, `ARCHITECTURE.md`, `tasks.md`, `bugs.md` present and filled.
- [ ] Confirm model tier and guardrail hooks. **Gate:** the coding agent can reach the gateway
      and produce a streaming reply with no console flash.

## Phase 1 — {{First vertical slice}}

- [ ] {{Task — smallest end-to-end working piece}}
- [ ] {{Task}}
- **Gate:** {{e.g. user can open the app and complete the primary flow on real data}}

## Phase 2 — {{Core features}}

- [ ] {{FR-1}}
- [ ] {{FR-2}}
- **Gate:** {{PRD functional requirements verified against TRD acceptance criteria}}

## Phase 3 — {{Hardening / edge cases}}

- [ ] {{Error/empty/loading states}}
- [ ] {{Guardrail + redaction verification}}
- **Gate:** {{all TRD error-handling cases pass; no secrets in logs}}

## Phase 4 — {{Polish / compliance}}

- [ ] {{Accessibility, branding, i18n if needed}}
- [ ] {{Child-safety review if minors}}
- **Gate:** {{UI-UX.md and PRD non-functional requirements met}}

## Phase 5 — {{Ship}}

- [ ] {{Deploy to hosting / workspace}}
- [ ] {{Operational notes for the operator}}
- **Gate:** {{live smoke test from the browser; `bugs.md` has no open HIGH-severity rows}}

## Verification discipline

- Every phase ends with a demonstrable, testable outcome — no "it should work" hand-waves.
- The coding agent records each completed task in `tasks.md` and each discovered defect in
  `bugs.md`.
- On completion, write a `HANDOVER.md` for the next session summarizing what shipped and what
  is left.

## Open items requiring a decision

- {{Decision 1 — who decides / what the options are}}
- {{Decision 2}}
