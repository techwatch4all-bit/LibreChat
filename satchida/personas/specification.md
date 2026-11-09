# Satchida Unified AI Personas & Conversation Starters Specification

> **Document Purpose**: Complete architectural and prompt specification of the Satchida Enterprise Personas, their 11 operational clusters, exact prompt strings, input staging/parameter mechanics, MCP tool bindings, and precise code locations within the LibreChat codebase. Designed for technical review, prompt engineering audits, and model alignment benchmarks.

---

## 1. Codebase Locations & Architecture Map

Any reviewing AI or engineer can locate all persona logic and configurations in the following repository paths:

| Component / Layer | Absolute Path in Repository | Role / Responsibility |
|---|---|---|
| **Frontend UI Component** | [`client/src/components/Chat/Input/ConversationStarters.tsx`](file:///d:/LAN-AI-Infra/LibreChat/client/src/components/Chat/Input/ConversationStarters.tsx) | Renders category pill buttons, starter chips, triggers MCP server selection, and handles the smart composer staging logic. |
| **System Model Specifications** | [`librechat.yaml`](file:///d:/LAN-AI-Infra/LibreChat/librechat.yaml#L422-L776) | Declares default mode specs (`Chat`, `Work`, `Study`, `Study-Local`, `Vibecoding`, `Pro`, `Privacy`), their temporal anchors, system prefixes, allowed `mcpServers`, and fallback starters. |
| **Source Persona Repository** | `D:\LAN-AI-Infra\satchida-ai-unified-suite\src\lib\constants\personas.constants.ts` | The upstream 34-persona master library defining full system prompts, domain schemas, and output format constraints (financial tables, news wires, emergency triage). |
| **Composer Form Context** | [`client/src/components/Chat/Input/ChatForm.tsx`](file:///d:/LAN-AI-Infra/LibreChat/client/src/components/Chat/Input/ChatForm.tsx) | Hosts the `prompt-textarea` (`#prompt-textarea`), handles form values via React Hook Form, and receives the staged prompt text. |
| **MCP Values Atom Store** | [`client/src/store/mcp.ts`](file:///d:/LAN-AI-Infra/LibreChat/client/src/store/mcp.ts) | Jotai atom family `mcpValuesAtomFamily(convoKey)` holding selected MCP server names sent with every generation request. |

---

## 2. Interaction Protocol: Staging vs Direct Execution

To prevent premature execution before the user supplies context (such as pasting an email, inputting coordinates, or specifying a stock ticker), the engine enforces a strict **Context Gate**:

```
                  User clicks on Starter Chip
                             │
                             ▼
         Does prompt contain `[...]`, `<...>`, or context flags?
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
         [ YES ]                            [ NO ]
    (Requires Context)              (Self-Contained Query)
            │                                 │
  1. Auto-select required MCPs       1. Auto-select required MCPs
  2. Populate `#prompt-textarea`     2. Dispatch `submitMessage({ text })`
  3. Dispatch input event            3. Immediate execution
  4. Force resize textarea
  5. Focus & auto-highlight `[...]`
  6. WAIT FOR USER INPUT
```

### Staging Logic in `ConversationStarters.tsx`:
```typescript
const isTemplate = /\[|\<|this message/i.test(text);

if (isTemplate) {
  const textarea = document.getElementById(mainTextareaId) as HTMLTextAreaElement | null;
  if (textarea) {
    textarea.value = text;
    methods.setValue('text', text, { shouldDirty: true, shouldValidate: true });
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    forceResize(textarea);
    textarea.focus();

    // Auto-select the first placeholder parameter
    const openBracket = text.indexOf('[');
    const closeBracket = text.indexOf(']', openBracket);
    if (openBracket !== -1 && closeBracket !== -1) {
      textarea.setSelectionRange(openBracket, closeBracket + 1);
    }
  }
  return; // Halted: waits for user to customize & click send
}
```

---

## 3. Comprehensive Persona Catalog (11 Categories & 44 Starters)

### Category 1: 📊 Markets & Bullion (`markets_finance`)
* **Visible Modes**: `Chat`, `Work`, `Pro`
* **Target Audience**: Financial analysts, investors, treasury managers, sovereign wealth planners.
* **Core Capabilities**: Real-time bullion carat pricing (24K, 22K 916, 18K & Silver 999), macro indices, equity DCF valuation, on-chain DeFi audits.

| Badge | Type | Exact Prompt String | Bound MCP Servers |
|---|---|---|---|
| **Markets** | Instant | `Comprehensive Multi-Asset Market Overview: Live Gold & Silver spot rates, crypto fear & greed index, key stock indices (Nifty 50, Sensex, S&P 500, Nasdaq), and top market movers today with trends & catalysts` | `satchida-web-search` |
| **Bullion** | Instant | `Deep Bullion Analysis: Global USD spot prices per oz, domestic 24K/22K/18K gold and 999 silver retail rates across major cities, jeweller making charge spreads, and import duty dynamics` | `satchida-web-search` |
| **Equity** | Staged | `Equity Valuation & Earnings Dossier: Conduct an institutional fundamental & technical equity analysis on asset: [Asset / Ticker / Stock Name] with DCF valuation, multiples comparison, and key earnings drivers` | `satchida-work-suite`, `satchida-web-search` |
| **DeFi Security** | Staged | `Crypto Forensics & Smart Contract Security: Analyze on-chain transaction flows, liquidity pool safety, tokenomics distribution, and contract vulnerabilities for: [Contract Address / Token Symbol]` | `satchida-web-search` |

---

### Category 2: 🩺 Health & Emergency (`family_health`)
* **Visible Modes**: `Chat`, `Privacy`
* **Target Audience**: Families, primary caregivers, clinical practitioners.
* **Core Capabilities**: Generic medicine price ceilings, clinical DDx workups, adverse drug-drug interactions, emergency trauma SOS and air quality advisories.

| Badge | Type | Exact Prompt String | Bound MCP Servers |
|---|---|---|---|
| **Pharma** | Staged | `Jan Aushadhi & Essential Medicine Prices: What are the NPPA ceiling prices and PMBJP generic drug equivalents (with cost savings) for: [Specify disease or prescribed brand medicine]?` | `satchida-health-wellness`, `satchida-web-search` |
| **Clinical DDx** | Staged | `Clinical Differential Diagnosis (DDx) & Workup: Present a structured symptom timeline, differential diagnosis considerations, and relevant lab biomarker panels for this clinical case:\n\n[Describe patient symptoms, age, duration, and vitals here]` | `satchida-health-wellness` |
| **Drug Safety** | Staged | `Drug Interactions & Contraindications: Review this medication schedule for potential adverse drug-drug interactions, dietary contraindications, and boxed warnings:\n\n[List active medications, dosages, and supplements here]` | `satchida-health-wellness`, `openfda-drugs` |
| **Emergency SOS** | Staged | `Emergency Helplines & Air Quality Triage: List verified 24/7 emergency response protocols, trauma helplines, and CPCB real-time AQI health precautions for respiratory safety in: [City / State / Location]` | `satchida-web-search` |

---

### Category 3: 🕉️ Vedic & Holistic Wellness (`vedic_wellness`)
* **Visible Modes**: `Chat`, `Privacy`
* **Target Audience**: Practitioners of Vedic astronomy, astrology, Ayurveda, Yoga therapy, and accessible digital design.
* **Core Capabilities**: Mathematical Drik Panchang, Tithi/Nakshatra/Yoga/Karana calculation, Abhijit Muhurta windows, Tridosha balancing, and WCAG 2.2 accessibility verification.

| Badge | Type | Exact Prompt String | Bound MCP Servers |
|---|---|---|---|
| **Panchang** | Staged | `Calculate today's Vedic Panchang, Tithi, Nakshatra, Yoga, Karana, and auspicious Abhijit Muhurta timings for location: [City / State / Coordinates] on date: [Date (Default: Today)]` | `satchida-panchang-vedic` |
| **Ayurveda** | Staged | `Suggest an authentic personalized Ayurvedic daily regimen (Dinacharya) based on Vata, Pitta, and Kapha dosha balancing for: [Your age, health goals, or current symptoms]` | `satchida-health-wellness` |
| **Festivals** | Staged | `Look up major upcoming Hindu festival calendar dates, lunar tithis, and fasting (Vrat) guidelines for year: [Year / Month]` | `satchida-panchang-vedic` |
| **Yoga/Pranayama** | Staged | `Classical Yoga Asanas & Pranayama breathing techniques for: [Specify goal: stress resilience, respiratory capacity, sleep, or back pain]` | `satchida-health-wellness` |
| **WCAG 2.2** | Staged | `Audit digital accessibility: Check WCAG 2.2 color contrast ratios between foreground and background palette tokens for: [Hex Colors or Component]` | `accessibility-tools` |

---

### Category 4: 🛡️ Citizen Essentials (`citizen_essentials`)
* **Visible Modes**: `Chat`
* **Target Audience**: Indian citizens, households, consumers navigating utilities, food safety, civic rights, and transport.
* **Core Capabilities**: City-wise fuel & LPG rates, water TDS & FSSAI adulteration home tests, school pollution orders, EPFO/consumer grievance, Indian Railways status.

| Badge | Type | Exact Prompt String | Bound MCP Servers |
|---|---|---|---|
| **Energy & Fuel** | Staged | `Fuel (E20/XP95), LPG & Energy Grid: City-wise price comparison of petrol, diesel, domestic 14.2kg LPG cylinder rates, and inverter battery sizing with solar net-metering math for: [City / State]` | `satchida-web-search` |
| **Food & Water** | Instant | `Potable Water & FSSAI Food Adulteration: Drinking water TDS standards (BIS 10500), purification methods, and rapid home tests for food adulteration (milk, spices, oils)` | `satchida-web-search` |
| **Exam/School** | Staged | `School Holidays & Exam Directives: Active District Magistrate (DM) weather/pollution closure orders and latest NTA/CBSE competitive exam schedules for: [District / State]` | `satchida-web-search` |
| **Banking & PF** | Instant | `Citizen Banking & EPFO Grievance: Bank strike alerts, ATM liquidity advisories, emergency online PF withdrawal under Form 31, and Consumer Court helpline filing` | `satchida-web-search` |
| **Transit** | Staged | `Transit & Travel Safety: Indian Railways major delays, special train bulletins, airport fog advisories, and NHAI national highway landslide/closure alerts for route: [Origin to Destination]` | `satchida-web-search` |

---

### Category 5: ⚖️ Legal & Governance (`governance_law`)
* **Visible Modes**: `Work`, `Pro`, `Privacy`
* **Target Audience**: Corporate counsel, compliance officers, procurement teams, auditors.
* **Core Capabilities**: RBI monetary policy & digital lending directions, Supreme Court precedents, Gazette statutory orders, ISO 27001 / SOC 2 GRC matrices, legal contract parsing.

| Badge | Type | Exact Prompt String | Bound MCP Servers |
|---|---|---|---|
| **RBI Regulatory** | Instant | `RBI Master Directions & Banking Compliance: Latest MPC Repo rate impacts, EMI benchmarks, digital lending guidelines, and UPI transaction limit frameworks` | `legal-research`, `satchida-web-search` |
| **Supreme Court** | Staged | `Supreme Court & Gazette Legal Counsel: Landmark constitutional precedents, Gazette of India statutory notifications, and DPDP / Bharatiya Nyaya Sanhita compliance for: [Legal Subject / Case Query]` | `legal-research`, `satchida-web-search` |
| **GRC Audit** | Staged | `Enterprise Governance, Risk & Audit (GRC): Formulate an ISO 27001 / SOC2 Type II internal control checklist, gap remediation matrix, and third-party risk assessment for: [System / Infrastructure]` | `legal-research`, `devops-security` |
| **Contracts** | Staged | `Contract Analysis & Clause Extraction: Review this agreement for indemnification caps, IP assignment, non-solicitation, and governing law clauses:\n\n[Paste contract or clauses here]` | `legal-research`, `satchida-work-suite` |

---

### Category 6: 🛰️ Geopolitics & Defence (`geopolitics_intel`)
* **Visible Modes**: `Chat`, `Work`, `Pro`
* **Target Audience**: Defence analysts, strategic researchers, international business planners.
* **Core Capabilities**: LOC/LAC troop deployments, critical mineral supply bottlenecks, BRICS/Quad multilateral diplomacy, critical infrastructure cyber warfare resilience.

| Badge | Type | Exact Prompt String | Bound MCP Servers |
|---|---|---|---|
| **Border Intel** | Instant | `Strategic Border & Defense Briefing: Current military situation, troop deployments, and intelligence posture along LOC, LAC, and Indian Ocean sea lanes` | `satchida-web-search` |
| **Supply Chains** | Instant | `Critical Mineral & Supply Chain Cartels: Geopolitical control of lithium, rare earths, cobalt, and semiconductor wafer fabs across global trade corridors` | `satchida-web-search` |
| **Foreign Policy** | Instant | `Foreign Policy & Sovereign Alliances: Multilateral geopolitical dynamics across BRICS, Quad, SCO, and bilateral trade corridors under shifting sanction regimes` | `satchida-web-search` |
| **Cyber Warfare** | Instant | `Cyber Sovereignty & Critical Infrastructure: State-sponsored APT groups, underwater cable security, satellite communications, and grid resilience against cyber warfare` | `devops-security`, `satchida-web-search` |

---

### Category 7: 🔒 Cyber & AI Hardware (`security_hardware`)
* **Visible Modes**: `Work`, `Pro`, `Vibecoding`
* **Target Audience**: DevSecOps engineers, security researchers, ML infrastructure engineers.
* **Core Capabilities**: Active CVE assessment, H100 vs B200 SXM cluster sizing, edge CCTV computer vision architecture, SAST secret leak detection.

| Badge | Type | Exact Prompt String | Bound MCP Servers |
|---|---|---|---|
| **CVE Intel** | Staged | `Automated CVE & Exploit Threat Intelligence: Vulnerability assessment of active zero-days, CVSS 3.1 scores, affected package versions, and vendor patches for: [Software / CVE Identifier]` | `devops-security`, `satchida-web-search` |
| **GPU Compute** | Instant | `Frontier AI Compute Architecture: Benchmark H100 vs B200 SXM clusters, NVLink interconnect bandwidth, FP8 matrix throughput, and datacenter thermal envelopes` | `satchida-ai-engineer`, `satchida-web-search` |
| **Edge Vision** | Instant | `Surveillance Architecture & Edge Computer Vision: Design a multi-camera RTSP streaming pipeline with on-device YOLO detection, privacy redaction, and local NVR storage` | `devops-security`, `satchida-work-suite` |
| **Code Security** | Staged | `Static Code Vulnerability & Secret Leak Scan: Inspect codebase for hardcoded credentials, exposed API keys, unsafe deserialization, and SQL/command injection vectors:\n\n[Paste code snippet here]` | `devops-security`, `git-librechat` |

---

### Category 8: 🎓 STEM & Math (`study_core`)
* **Visible Modes**: `Study`, `Study-Local`
* **Target Audience**: K-12 students (CBSE/ICSE/IB), engineering undergraduates (B.Tech/M.Tech), competitive aspirants (JEE/NEET/GATE).
* **Core Capabilities**: Symbolic math with KaTeX, Socratic DeepTutor book creation, Maxwell/Faraday derivations, algorithmic complexity comparisons.

| Badge | Type | Exact Prompt String | Bound MCP Servers |
|---|---|---|---|
| **Symbolic Math** | Instant | `Solve the equation x^3 - 4x = 0 step-by-step with KaTeX formulas, factoring, and roots verification` | `satchida-stem-study` |
| **DeepTutor** | Staged | `Interactive DeepTutor Concept Book: Create a comprehensive learning module with Socratic milestone exercises and practice quizzes on topic: [Specify concept, e.g. Quantum Gates]` | `deeptutor-integration` |
| **Physics** | Instant | `Electromagnetic Induction & Modern Physics: Derive Faraday-Lenz laws and Maxwell equations with step-by-step mathematical rigor` | `satchida-stem-study` |
| **CS Algorithms** | Instant | `Algorithm Complexity & Data Structures: Compare Dijkstra vs A* shortest-path algorithms with time/space complexity analysis and verified code` | `satchida-stem-study` |

---

### Category 9: 🔬 Deep Research & E-Books (`ai_research_books`)
* **Visible Modes**: `Study`, `Study-Local`, `Work`, `Pro`
* **Target Audience**: Academics, technical authors, research scientists, product managers.
* **Core Capabilities**: Multi-turn deep research reports, authoritative manuscript scaffolding, Transformer KV-cache sizing, arXiv/PubMed surveys.

| Badge | Type | Exact Prompt String | Bound MCP Servers |
|---|---|---|---|
| **Deep Research** | Staged | `Multi-Turn Deep Research Dossier: Conduct an exhaustive, citation-backed technical investigation on: [Emerging Technology / Scientific Topic]` | `satchida-web-search`, `academic-search` |
| **E-Book / PRD** | Staged | `Scaffold Authoritative E-Book / Whitepaper: Design a complete multi-chapter manuscript blueprint with executive summary, diagrams, and case studies on: [Book Title / Subject]` | `satchida-knowledge-vault` |
| **AI Architecture** | Instant | `Frontier AI Architecture Sizing: Verify transformer layer dimensions, tensor parallelism, and kv-cache memory requirements for a 7B/14B model` | `satchida-ai-engineer` |
| **Scholar/arXiv** | Staged | `Academic Citation & Peer-Reviewed Survey: Query scholarly literature on arXiv and PubMed for: [Research Field / Scaling Laws]` | `arxiv-search`, `academic-search` |

---

### Category 10: 💻 Vibe Coding & Architecture (`vibecoding_dev`)
* **Visible Modes**: `Vibecoding`, `Work`, `Pro`
* **Target Audience**: Full-stack engineers, software architects, rapid prototypers.
* **Core Capabilities**: Scalable API system design, Git plan execution audit, accessible React/Tailwind prototyping, SQL query execution plan optimization.

| Badge | Type | Exact Prompt String | Bound MCP Servers |
|---|---|---|---|
| **Architecture** | Staged | `Staff Architect Blueprint: Architect a scalable REST / WebSocket API with rate limiting, JWT authentication, and idempotent worker queue for: [Application Requirement]` | `satchida-work-suite`, `devops-security` |
| **Plan Supervisor** | Instant | `Plan Execution Supervisor: Audit the active implementation plan, ground every step in repository files, and propose bounded atomic edits` | `git-librechat` |
| **Vibe UI** | Staged | `Full-Stack Rapid UI Prototype: Build a modern, accessible interactive component in React/TypeScript with Tailwind CSS and responsive design for: [Component Name / Feature]` | `satchida-work-suite` |
| **Database** | Staged | `Database Performance & Query Optimization: Analyze slow query execution plans, design optimal composite indexes, and prevent table locks for: [SQL Query or Schema]` | `satchida-work-suite` |

---

### Category 11: 🔒 Sovereign Vault & Privacy (`privacy_vault`)
* **Visible Modes**: `Privacy`, `Work`
* **Target Audience**: Enterprise executives, privacy-first users, compliance officers.
* **Core Capabilities**: 100% on-device document generation (PPTX, PDF, XLSX, DOCX), private knowledge vault RAG, air-gapped business planning, forensic audit.

| Badge | Type | Exact Prompt String | Bound MCP Servers |
|---|---|---|---|
| **Document Gen** | Staged | `Offline Executive Document Synthesis: Generate a presentation (.pptx), report (.pdf), or spreadsheet (.xlsx) completely on-device without cloud leakage on: [Topic / Presentation Title]` | `satchida-knowledge-vault` |
| **Vault RAG** | Staged | `Sovereign Knowledge Vault RAG: Search private enterprise vaults and query indexed textbooks/policies with exact verified citations for: [Search Query]` | `satchida-knowledge-vault` |
| **Zero Telemetry** | Staged | `Confidential Strategy Formulation: Draft an internal strategic business plan with 100% on-device inference and zero telemetry for: [Initiative / Product Launch]` | `satchida-knowledge-vault` |
| **Forensic Audit** | Staged | `Deep Forensic Document Audit: Cross-examine uploaded financial and legal documents for discrepancies, audit gaps, and hidden obligations:\n\n[Describe documents or paste excerpt]` | `satchida-knowledge-vault` |

---

## 4. ModelSpec Starter Overrides in `librechat.yaml`

When the user selects the default **`✨ Suggested`** tab in the UI, LibreChat resolves the starters specified in the active mode's `modelSpec.conversation_starters` array.

In [`librechat.yaml`](file:///d:/LAN-AI-Infra/LibreChat/librechat.yaml#L543-L557), the `Chat` mode spec has been enhanced to:
1. Include required MCP servers: `satchida-panchang-vedic`, `satchida-health-wellness`, `openfda-drugs`, `satchida-web-search`, `satchida-knowledge-vault`, `time-server`, `web-fetch`, `accessibility-tools`.
2. Map actionable conversation starters with parameter templates:
   - **Multi-Asset Market Overview**: Comprehensive live bullion & stock overview.
   - **Draft Response**: `"Draft a polite and concise response to this message:\n\n[Paste email/message to reply to here]"` *(Staged into composer)*
   - **Vedic Panchang**: `"Calculate today's Vedic Panchang, Tithi, Nakshatra, Yoga, Karana, and auspicious Abhijit Muhurta timings for location: [City / State / Coordinates] on date: [Date (Default: Today)]"` *(Staged into composer)*
   - **Ayurvedic Dinacharya**: Regimen balancing for `[Your age, health goals, or current symptoms]` *(Staged into composer)*
   - **Potable Water & Food Safety**: Drinking water TDS standards and rapid home food tests.
   - **Jan Aushadhi**: NPPA prices & generic drug equivalents for `[Specify disease or prescribed brand medicine]` *(Staged into composer)*

---

## 5. Review Guidelines for Evaluating Agents

When another AI or engineer audits this setup, they should verify:
1. **Context Safety**: Confirm that any prompt containing brackets `[...]` or references to an unsupplied input will never trigger an immediate backend inference request.
2. **Tool Pairing**: Verify that each category's prompt pairs with active MCP servers that can actually service it (e.g. `satchida-panchang-vedic` for lunar astronomy, `satchida-stem-study` for SymPy math, `legal-research` for court rulings).
3. **No Redundant Execution**: Ensure that when a starter is clicked, only the composer state updates without creating phantom turns in the conversation transcript until the user presses Enter or Send.
