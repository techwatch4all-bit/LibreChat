# Satchida Persona Library (shippable)

Persona data, accuracy rules, and the specification for the conversation-starter
personas shipped to client edge nodes. Everything needed to review or re-derive
the persona layer lives in this directory.

## Contents

| File | What it is | Origin |
|---|---|---|
| `personas.ts` | The 34-persona master library (`AGENT_PERSONAS`) plus the four accuracy rule blocks, exported | Verbatim copy of `satchida-ai-unified-suite/src/lib/constants/personas.constants.ts` (2026-11-09) |
| `specification.md` | Architecture + full 11-category / 44-starter specification (codebase map, staging protocol, ModelSpec overrides) | Copy of the operator spec artifact `SATCHIDA-AI-PERSONAS-SPECIFICATION.md` |
| `README.md` | This file: provenance, wiring map, stale-data audit, shipping checklist | — |

## How personas actually run in LibreChat

A persona in the running product is assembled from three places — none of them
imports this directory yet (tracked as a P2 todo: single-source refactor):

1. **Mode system prompt** — `librechat.yaml` → `modelSpecs.list[].preset.promptPrefix`
   (one per mode: Chat / Work / Pro / Study / Study-Local / Vibecoding / Privacy).
2. **Starter prompt strings** — `client/src/components/Chat/Input/ConversationStarters.tsx`
   (`ALL_CATEGORIES`, 44 starters across 11 categories) and the per-mode
   `conversation_starters` arrays in `librechat.yaml` (the ✨ Suggested tab).
3. **Tool bindings** — each starter's `mcpServers` (component) + each mode's
   `mcpServers` allowlist (yaml). Servers are unioned at request time
   (`packages/api/src/agents/added.ts`).

**Known gap (P0 todo):** the four accuracy rule blocks below exist only in this
library and in the unified-suite runtime — they are *not yet* in any
`promptPrefix`, so the running chat does not enforce them. Porting them is the
first P0 action.

## The four accuracy rule blocks (zero-hallucination design)

| Export | Enforces |
|---|---|
| `MANDATORY_CITATION_RULES` | Answer only what was asked; base live-data answers strictly on `[LIVE INTELLIGENCE ...]` context with clickable markdown links; domain output shapes; never simulate/fabricate |
| `UNIVERSAL_QUERY_RULES` | Identity (Satchida AI, zero intros); **ZERO-HALLUCINATION REQUIREMENT** — no live context ⇒ exact refusal line and stop; banned escape hatches ("based on general knowledge" etc.); model-knowledge answers must carry the verify-before-acting disclaimer; scope/length discipline |
| `FINANCIAL_OUTPUT_FORMAT` | Consolidated market/forex/bullion summary table + sources table, only when the current message asks for market data |
| `NEWS_OUTPUT_FORMAT` | Numbered items with per-item source badges and 4–6 sentence summaries, sources table only after items, never padded/invented stories, plain-font summaries |

## Deltas vs origin (intentional, keep small)

1. Three previously private consts are exported (`MANDATORY_CITATION_RULES`,
   `FINANCIAL_OUTPUT_FORMAT`, `NEWS_OUTPUT_FORMAT`) so the module is importable.
2. Provenance header added at the top.
3. Line endings: origin is CRLF on disk, this file is LF (repo working-tree
   convention). Content is byte-identical otherwise — verified with
   `diff --strip-trailing-cr`.

Verify at any time:

```bash
diff --strip-trailing-cr \
  "D:/LAN-AI-Infra/satchida-ai-unified-suite/src/lib/constants/personas.constants.ts" \
  satchida/personas/personas.ts
# expect only: header block (0a1,11) + three `export const` lines
```

## Stale-data audit (zero-old-data — must clear before client ship, P1)

Volatile facts hardcoded in prompt text go stale silently. Each needs a year
tag + live verification, or removal:

| Location | Stale item | Fix |
|---|---|---|
| `personas.ts` → `civic_banking_consumer_rights` starter | SCSS 8.2% / PPF 7.1% / SSY 8.2% | Remove numbers; require current rates from PIB/EPFO circular via search |
| `personas.ts` → `frontier_ai_hardware` system + starter | Model-era names (Claude 3.7, o3/GPT-4.5, Gemini 2.0, Qwen 2.5/3, Llama 3.3, Gemma 2) | Genericize to "current frontier releases (verify via search)" |
| `personas.ts` → `MANDATORY_CITATION_RULES` + `sovereign_market_intelligence` | 6% BCD + 3% GST gold duty | Tag "verify current Finance Act rate" or source from search |
| `personas.ts` → `satchida_model_manager` | "EXAMPLE entries from May 2026" inventory | Self-labeled + verify-on-use instruction — acceptable; re-date quarterly |
| `mcp/recommended-mcp.ts` | "gemini-1.5-flash" free-tier quota note | Re-verify tier notes before ship |
| LibreChat runtime starters (`ConversationStarters.tsx`, `librechat.yaml`) | No hardcoded rates today — keep it that way; enforce via the rule blocks | P0/P1 prompt rewrites |

## Sync rule

`satchida-ai-unified-suite` remains the upstream master for persona content.
Edits here must be mirrored there (and vice versa) or recorded as a divergence
in `Customizations.md` with a `Changes.md` entry. After the P2 single-source
refactor, this copy becomes the import source for the client build.

## Shipping checklist

- [ ] Stale-data audit above cleared (P1)
- [ ] Rule blocks wired into mode `promptPrefix` (P0)
- [ ] `diff --strip-trailing-cr` clean against origin (or divergence recorded)
- [ ] Specification's staging-protocol behavior verified on the target build
- [ ] Companion manifest reviewed: `satchida/mcp/README.md` (tool bindings exist client-side)
