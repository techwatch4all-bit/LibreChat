# Satchida Personas & Conversation Starters — Specification

**Status:** current as of 2026-11-13. Supersedes the earlier "staging vs direct execution"
description, where bracket-less cards still auto-submitted.

**The one invariant:** a click on a starter never sends a message. It stages an editable brief.
The same rule is enforced in three places — the card template, the persona system prompts, and
every mode `promptPrefix` in `librechat.yaml` — so it holds whichever entry point the user takes.

---

## 1. Where the pieces live

| Surface | File | Contents |
|---|---|---|
| Card catalog + prompt builder | `client/src/common/starters.ts` | 34 categories, 133 cards, shared contract strings, `findStarterSlots()` |
| Starter UI | `client/src/components/Chat/Input/ConversationStarters.tsx` | staging, slot highlight, Tab navigation, MCP binding, coach strip |
| Persona library | `satchida/personas/personas.ts` | 34 personas with system prompts, 124 starter prompts |
| Mode prompts + ✨ starters | `librechat.yaml` | 9 model specs: `promptPrefix` contract + 46 `conversation_starters` |
| Copy | `client/src/locales/en/translation.json` | category, badge and coach-strip strings |
| Tests | `client/src/components/Chat/Input/__tests__/ConversationStarters.spec.tsx` | behavior + catalog-integrity assertions |

---

## 2. The card contract

Every card is assembled by `starter()` from five authored parts. Nothing about the gate, the
contract or the customization tail is retyped per card, so 133 cards cannot drift apart.

```
<Title> — <one-line intent>.
Inputs: [slot] · [slot] · [slot]
Before you start: restate the brief in one line, name any slot you had to default, and ask "GO?" …
On GO, deliver: <the domain-specific deliverable>
Output contract: <domain rules: citations, formats, safety, scope>
My additions: [ ]   ← type your own constraints here: audience, budget, tone, must-include, must-avoid
```

`starter()` in `client/src/common/starters.ts`:

| Part | Field | Required |
|---|---|---|
| Card title (also the prompt's first line) | `title` | yes, ≤ 44 chars after any leading emoji |
| Card subtitle | `description` | yes, ≤ 140 chars |
| Input slots, rendered as `[slot]` | `inputs` | yes, at least one |
| What the model produces after approval | `deliver` | yes |
| Domain output contract | `contract` | no |
| Display chrome | `badge`, `badgeKey`, `icon`, `engineTag`, `keywords`, `featured`, `mcpServers` | no |

Shared contract constants: `LIVE_CONTRACT`, `SOURCED_CONTRACT`, `DOC_CONTRACT`, `CODE_CONTRACT`,
`CLINICAL_CONTRACT`, `LEGAL_CONTRACT`, `TEACH_CONTRACT`, `MOTION_CONTRACT`, plus `STARTER_GATE`
and `STARTER_TAIL`. A card that needs more appends to the constant rather than writing a new one.

Two behaviours come from the template rather than from the model's good will:

1. **The gate.** The card asks for approval and explicitly forbids searching, calculating or
   writing before the reply. Motion cards use the variant gate, where a filled brief *is* the
   approval because the card is already the parameter set.
2. **The customization tail.** Every staged prompt ends with `My additions: [ ]`, so the last
   thing in the composer invites the user's own constraints.

---

## 3. Interaction flow

```
Click card
  → bind card.mcpServers (if any)
  → write card.prompt into #prompt-textarea and mirror it into react-hook-form
  → select the first real input slot
  → show the coach strip (all modes, dismissible)
  → never call submitMessage

Tab / Shift+Tab
  → next / previous slot, selection replaced in place
  → at either end, focus is released (no keyboard trap)
```

Slot scanning is `findStarterSlots()`, shared by the component and the tests. It skips markdown
links: `[Source](URL)` is an output-format token, not an input, so it is never highlighted and
never eats a Tab stop.

Cards that arrive without `title`/`description` (custom starters configured in
`interface.customWelcome`, which are plain strings) fall back to the first line, split on ` — `
first and then on `:`, so they still render as a title plus subtitle.

---

## 4. Catalog inventory — 34 categories, 133 cards

### 4.1 Chat / Work / Pro / Study / Privacy / Vibecoding (14 categories, 63 cards)

| Category | Modes | Cards |
|---|---|---|
| 📊 Markets & Bullion (`markets_finance`) | Chat, Work, Pro | 4 |
| 🩺 Health & Emergency (`family_health`) | Chat | 4 |
| 🕉️ Vedic & Holistic Wellness (`vedic_wellness`) | Chat, Privacy | 5 |
| 🏙️ Citizen Essentials (`citizen_essentials`) | Chat | 5 |
| ⚖️ Legal & Governance (`governance_law`) | Work, Pro, Privacy | 4 |
| 🌍 Geopolitics & Defence (`geopolitics_intel`) | Chat, Work, Pro | 4 |
| 🛡️ Cyber, CVE & AI Hardware (`security_hardware`) | Work, Pro, Vibecoding | 4 |
| 🧮 STEM & Symbolic Math (`study_core`) | Study, Study-Local | 4 |
| 🎒 School Boards (`school_boards`) | Study, Study-Local | 7 |
| 📖 Textbook Navigator (`textbook_navigator`) | Study, Study-Local | 4 |
| 🐍 Python from Zero (`python_from_zero`) | Study, Study-Local, Vibecoding | 6 |
| 🔬 Deep Research & E-Books (`ai_research_books`) | Study, Study-Local, Work, Pro | 4 |
| ⚡ Vibe Coding & Architecture (`vibecoding_dev`) | Vibecoding, Work, Pro | 4 |
| 🔒 Sovereign Vault & Privacy (`privacy_vault`) | Privacy | 4 |

### 4.2 Motion Studio (5 discipline groups, 20 categories, 70 cards)

| Category | Group | Cards |
|---|---|---|
| 🏛️ Floor Plans & Arch (`motion_architecture`) | Arch & Engineering | 4 |
| 🚁 Drones & UAV (`motion_drones`) | Arch & Engineering | 3 |
| 🌉 Civil & Supply Chains (`motion_civil_logistics`) | Arch & Engineering | 3 |
| 🤖 Robotics & Kinematics (`motion_robotics`) | Robotics & How | 3 |
| ⚙️ How Things Work (`motion_how_it_works`) | Robotics & How | 4 |
| 🔌 Circuits & AI Silicon (`motion_electronics`) | Robotics & How | 3 |
| 🎓 STEM, Chem & Coding (`motion_education`) | STEM & Tech | 5 |
| 🌐 Networks & Cyber (`motion_networks`) | STEM & Tech | 3 |
| 🌌 Space, Earth & Sound (`motion_earth_space`) | STEM & Tech | 3 |
| 🏛️ History & Early Learning (`motion_history_kids`) | STEM & Tech | 3 |
| 📊 Executive & Metrics (`motion_executive`) | Business & Creative | 3 |
| 💼 Professional & SOPs (`motion_productivity`) | Business & Creative | 4 |
| ⚡ Kinetic Typography (`motion_kinetic`) | Business & Creative | 3 |
| ✨ Product & SaaS Launch (`motion_product`) | Business & Creative | 3 |
| 🎨 Art, Cartoon & Sketch (`motion_creative`) | Business & Creative | 4 |
| 🎬 Teasers & Video Render (`motion_media`) | Business & Creative | 3 |
| 🫀 Medical & Clinical (`motion_medical`) | Care & Living | 4 |
| 🥗 Fitness, Yoga & Diet (`motion_wellness`) | Care & Living | 4 |
| 🏡 Home, Interior & Living (`motion_home`) | Care & Living | 4 |
| 👵 Golden Years & Living (`motion_elderly`) | Care & Living | 4 |

---

## 5. Persona library (`satchida/personas/personas.ts`)

34 personas across family survival, health, finance, governance, geopolitics, engineering,
research and privacy. The genre rule blocks (`MANDATORY_CITATION_RULES`,
`UNIVERSAL_QUERY_RULES`, `LIVE_DATA_ENGAGEMENT_RULES`, `FINANCIAL_OUTPUT_FORMAT`,
`NEWS_OUTPUT_FORMAT`) are unchanged.

Applied at module scope, not per string:

- `BRIEF_FIRST_CONTRACT` is appended to all 34 system prompts.
- `stageStarter()` prefixes the approval gate and appends the customization tail to all 124
  starter prompts.

That keeps the upstream master library diff-able: the rule text lives in one exported constant
instead of being scattered through 34 prompt bodies.

---

## 6. Mode prompts and ✨ starters (`librechat.yaml`)

Nine model specs — Vibecoding, Pro, Chat, Work, Study, Study-Local, Privacy, Motion, SceneMosaic.

- Every `promptPrefix` carries a `BRIEF-FIRST CONTRACT` block. Execution instructions that used
  to read "immediately" now read "as soon as the brief is approved", so the mode prompt and the
  contract state the same rule.
- Motion and SceneMosaic get the filled-brief-is-approval variant, because the motion tool call
  must still be the first step once the parameters are set.
- All 46 `conversation_starters` use the same six-part template as the cards, written as literal
  block scalars so the composer keeps the line structure.

`librechat.yaml` is gitignored and live on the running instance: back it up before editing and
re-check `js-yaml` parse after. The `yaml` package rejects this file on a pre-existing quoting
quirk; `js-yaml` is the parser the app actually uses.

---

## 7. Verification

```bash
# catalog contract + staging behaviour
cd client && npx jest src/components/Chat/Input/__tests__/ConversationStarters.spec.tsx

# types (client has pre-existing Admin errors unrelated to starters)
cd client && npx tsc --noEmit

# yaml structure and contract coverage
node -e "const y=require('js-yaml'),f=require('fs');const d=y.load(f.readFileSync('librechat.yaml','utf8'));for(const s of d.modelSpecs.list){console.log(s.name,s.preset.promptPrefix.includes('BRIEF-FIRST CONTRACT'),s.conversation_starters.length)}"
```

The Jest suite asserts the parts that used to drift: every card has a title, a description and at
least one real slot; titles and descriptions stay within the pill budget; every prompt carries the
gate before the deliverable; markdown links are not mistaken for slots; and a click stages,
highlights, mirrors into the form, and never submits.
