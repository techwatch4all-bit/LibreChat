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
2. **Starter prompt strings** — `client/src/common/starters.ts` (`ALL_CATEGORIES`,
   extracted from `ConversationStarters.tsx` in P2; 11 categories, labels and
   badges keyed for `useLocalize`) and the per-mode `conversation_starters`
   arrays in `librechat.yaml` (the ✨ Suggested tab).
3. **Tool bindings** — each starter's `mcpServers` (component) + each mode's
   `mcpServers` allowlist (yaml). Servers are unioned at request time
   (`packages/api/src/agents/added.ts`).

**Wired (P0, 2026-11-09):** the four accuracy rule blocks below are appended to
every mode `promptPrefix` in `librechat.yaml` — 7/7 modes verified by marker
scan (SATCHIDA ACCURACY / No live intelligence context / BANNED ESCAPE
HATCHES / FINANCIAL + NEWS format blocks). Three adaptations were made for the
LibreChat fleet and are recorded as deltas vs origin below: identity
**Satchida AI → Satchida SI** (3 occurrences; fleet identity asserted by
`fleet/test/chat.mjs`), refusal wording **"click Force Pull Fresh Data" →
"enable Web Search (or the web-search tool) and resend"** (LibreChat has no
Force Pull control), and the BCD/GST zero-old-data rewording.

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
2. Provenance header added at the top (now also documenting delta 3).
3. Zero-old-data pass (2026-11-09): hardcoded SCSS/PPF/SSY rates, model-era
   names in `frontier_ai_hardware`, and both 6% BCD / 3% GST figures replaced
   with verify-then-state instructions (6 content edits; mirrored into all 7
   yaml promptPrefixes for the BCD/GST line).
4. Line endings: this copy preserves the origin's CRLF.

Verify at any time:

```bash
diff \
  "D:/LAN-AI-Infra/satchida-ai-unified-suite/src/lib/constants/personas.constants.ts" \
  satchida/personas/personas.ts
# expect: header block + three `export const` lines + the delta-3 zero-old-data edits
```

## Stale-data audit (zero-old-data — must clear before client ship, P1)

Volatile facts hardcoded in prompt text go stale silently. Each needs a year
tag + live verification, or removal:

| Location | Stale item | Fix |
|---|---|---|
| `personas.ts` → `civic_banking_consumer_rights` starter | SCSS 8.2% / PPF 7.1% / SSY 8.2% | ✅ done 2026-11-09: numbers removed; requires current MoF quarterly notification + effective date |
| `personas.ts` → `frontier_ai_hardware` system + starter | Model-era names (Claude 3.7, o3/GPT-4.5, Gemini 2.0, Qwen 2.5/3, Llama 3.3, Gemma 2) | ✅ done 2026-11-09: genericized to current-release phrasing with verify-instructions |
| `personas.ts` → `MANDATORY_CITATION_RULES` + bullion systemPrompt | 6% BCD + 3% GST gold duty | ✅ done 2026-11-09: verify-against-Finance-Act/CBIC wording in both spots **and mirrored into all 7 yaml promptPrefixes (7 occurrences)** |
| `personas.ts` → `satchida_model_manager` | "EXAMPLE entries from May 2026" inventory | Self-labeled + verify-on-use instruction — acceptable; re-date quarterly |
| `mcp/recommended-mcp.ts` | "gemini-1.5-flash" free-tier quota note | Re-verify tier notes before ship |
| LibreChat runtime starters (`client/src/common/starters.ts`, `librechat.yaml`) | No hardcoded rates today — keep it that way; enforce via the rule blocks | ✅ P0/P1 rewrites done; labels/badges localized (P2) |

## Sync rule

`satchida-ai-unified-suite` remains the upstream master for persona content.
Edits here must be mirrored there (and vice versa) or recorded as a divergence
in `Customizations.md` with a `Changes.md` entry. After the P2 single-source
refactor, this copy becomes the import source for the client build.

## Shipping checklist

- [x] Stale-data audit above cleared (P1) — remaining: `recommended-mcp.ts`
  gemini tier note re-verified at ship time
- [x] Rule blocks wired into mode `promptPrefix` (P0) — 7/7 modes marker-verified
- [x] `ALL_CATEGORIES` extracted to `client/src/common/starters.ts` and
  localized via `useLocalize` (P2); personas cross-import deferred (outside
  client tsconfig root) — keep prompt copy aligned manually
- [x] `diff` against origin accounts for header + exports + delta-3 edits only
- [ ] Specification's staging-protocol behavior verified on the target build
- [ ] Companion manifest reviewed: `satchida/mcp/README.md` (tool bindings exist client-side)
