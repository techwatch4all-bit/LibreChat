/**
 * Starter data for the chat input - single source of truth extracted from
 * ConversationStarters.tsx. Category labels and badges carry TranslationKeys
 * so the component renders them through useLocalize() with these authored
 * English strings as defaultValue.
 *
 * Personas cross-import deferred: satchida/personas/*.ts sits outside the
 * client tsconfig root, so this module stays independent; keep prompt copy
 * aligned manually (see satchida/personas/README.md).
 */
import type { TranslationKeys } from '~/hooks/useLocalize';

export interface StarterItem {
  prompt: string;
  badge?: string;
  badgeKey?: TranslationKeys;
  mcpServers?: string[];
  title?: string;
  icon?: string;
  description?: string;
}

export interface StarterCategory {
  id: string;
  label: string;
  labelKey: TranslationKeys;
  modes?: string[]; // Allowed modes: 'Chat', 'Work', 'Study', 'Study-Local', 'Privacy', 'Motion'
  starters: StarterItem[];
}

export const ALL_CATEGORIES: StarterCategory[] = [
  {
    id: 'markets_finance',
    label: '📊 Markets & Bullion',
    labelKey: 'starters_cat_markets_finance',
    modes: ['Chat', 'Work', 'Pro'],
    starters: [
      {
        prompt:
          'Comprehensive Multi-Asset Market Overview: Live Gold & Silver spot rates, crypto fear & greed index, key stock indices (Nifty 50, Sensex, S&P 500, Nasdaq), and top market movers today with trends & catalysts. Use web search for every figure; attach a [Source](URL) and an "as of" timestamp to each number, cross-check spot gold across two independent sources, and end with a Sources table. If no live data is retrieved, reply only with the no-live-context refusal line — never fill the table from memory.',
        badge: 'Markets',
        badgeKey: 'starters_badge_markets',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'Deep Bullion Analysis: Global USD spot prices per oz, domestic 24K/22K/18K gold and 999 silver retail rates across major cities, jeweller making charge spreads, and import duty dynamics. Every rate carries a [Source](URL) and "as of" date; separate IBJA benchmark rates from retail jeweller rates; tag duty/GST figures "verify against the latest Finance Act notification". Refuse without live sources rather than estimating.',
        badge: 'Bullion',
        badgeKey: 'starters_badge_bullion',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'Equity Valuation & Earnings Dossier: Conduct an institutional fundamental & technical equity analysis on asset: [Asset / Ticker / Stock Name] with DCF valuation, multiples comparison, and key earnings drivers. Source every DCF input (share count, cash flows, WACC) from the actual filings with links, state the fiscal year used, and show an assumption table with a sensitivity range — never estimate share count or revenue from memory.',
        badge: 'Equity',
        badgeKey: 'starters_badge_equity',
        mcpServers: ['satchida-work-suite', 'satchida-web-search'],
      },
      {
        prompt:
          'Crypto Forensics & Smart Contract Security: Analyze on-chain transaction flows, liquidity pool safety, tokenomics distribution, and contract vulnerabilities for: [Contract Address / Token Symbol] on chain [ETH / BSC / Base / Solana]. Use fetch_page against the block explorer and the project documentation for every claim; end with the scope note: "heuristic review from public data — not a certified audit".',
        badge: 'DeFi Security',
        badgeKey: 'starters_badge_defi_security',
        mcpServers: ['satchida-web-search'],
      },
    ],
  },
  {
    id: 'family_health',
    label: '🩺 Health & Emergency',
    labelKey: 'starters_cat_family_health',
    modes: ['Chat'],
    starters: [
      {
        prompt:
          'Jan Aushadhi & Essential Medicine Prices: What are the NPPA ceiling prices and PMBJP generic drug equivalents (with cost savings) for: [Specify disease or prescribed brand medicine]? Fetch the current PMBJP price list and openfda drug data; COMPUTE the savings percentage from the fetched prices (never state it from memory), cite each price source with its date, and flag Schedule H/H1 drugs. Not a prescription — confirm with your physician or pharmacist.',
        badge: 'Pharma',
        badgeKey: 'starters_badge_pharma',
        mcpServers: ['satchida-health-wellness', 'openfda-drugs', 'satchida-web-search'],
      },
      {
        prompt:
          'Clinical Differential Diagnosis (DDx) & Workup: FIRST screen for red flags (chest pain radiating to arm/jaw, focal neurological deficit, sepsis signs, anaphylaxis, acute abdomen) — if any are present, direct to 112 / emergency care BEFORE any analysis. Then present: (1) a structured symptom timeline (OPQRST), (2) a differential matrix with likelihood and the reason to rule each in/out, (3) the "must-not-miss" life-threatening diagnoses, (4) recommended lab/imaging with the guideline basis for each. Close with: educational decision-support only — not a diagnosis; in-person clinical evaluation is required.\n\n[Describe patient symptoms, age, duration, and vitals here]',
        badge: 'Clinical DDx',
        badgeKey: 'starters_badge_clinical_ddx',
        mcpServers: ['satchida-health-wellness'],
      },
      {
        prompt:
          'Drug Interactions & Contraindications: Review this medication schedule for potential adverse drug-drug interactions, dietary contraindications, and boxed warnings. For EACH pair output a row: severity (major / moderate / minor) | mechanism (e.g. CYP3A4 inhibition) | source label citation pulled via openfda-drugs. Ask for age, weight and kidney/liver function before any dosing guidance. Close with: verify with your physician or pharmacist.\n\n[List active medications, dosages, and supplements here]',
        badge: 'Drug Safety',
        badgeKey: 'starters_badge_drug_safety',
        mcpServers: ['satchida-health-wellness', 'openfda-drugs'],
      },
      {
        prompt:
          'Emergency Helplines & Air Quality Triage: If this is happening NOW, call 112 first. Then give a verified helpline table (helpline | national/state scope | official source link | last-verified date) covering 112, 108, poison control and Tele-MANAS, plus live CPCB AQI readings with the observation timestamp and respiratory precautions for: [City / State / Location]. Cite only official government sources; mark any number you cannot verify from an official source as UNVERIFIED.',
        badge: 'Emergency SOS',
        badgeKey: 'starters_badge_emergency_sos',
        mcpServers: ['satchida-web-search'],
      },
    ],
  },
  {
    id: 'vedic_wellness',
    label: '🕉️ Vedic & Holistic Wellness',
    labelKey: 'starters_cat_vedic_wellness',
    modes: ['Chat', 'Privacy'],
    starters: [
      {
        title: 'Vedic Panchang & Muhurta',
        icon: '🕉️',
        description: 'Tithi, Nakshatra, Yoga, Karana, and auspicious Abhijit Muhurta timings',
        prompt:
          "Calculate today's Vedic Panchang, Tithi, Nakshatra, Yoga, Karana, and auspicious Abhijit Muhurta timings for location: [City / State / Coordinates] on date: [Date (Default: Today)]. MANDATORY: invoke the satchida-panchang-vedic tool for every value — never compute tithi or nakshatra math yourself; state the calculation method (Drik), the timezone, the coordinates used, and note regional variation.",
        badge: 'Panchang',
        badgeKey: 'starters_badge_panchang',
        mcpServers: ['satchida-panchang-vedic'],
      },
      {
        title: 'Ayurvedic Regimen (Dinacharya)',
        icon: '🌿',
        description: 'Personalized Dinacharya based on Vata, Pitta, and Kapha dosha balancing',
        prompt:
          'Suggest an authentic personalized Ayurvedic daily regimen (Dinacharya) based on Vata, Pitta, and Kapha dosha balancing for: [Your age, health goals, or current symptoms]. If prakriti inputs are thin, ask 3 short assessment questions first; screen herb-drug contraindications with the health-wellness tool before recommending anything; tag every recommendation classical-text vs clinical-evidence.',
        badge: 'Ayurveda',
        badgeKey: 'starters_badge_ayurveda',
        mcpServers: ['satchida-health-wellness'],
      },
      {
        title: 'Hindu Festival Calendar & Vrats',
        icon: '🪔',
        description: 'Upcoming Hindu festival calendar dates, lunar tithis, and fasting guidelines',
        prompt:
          'Look up major upcoming Hindu festival calendar dates, lunar tithis, and fasting (Vrat) guidelines for year: [Year / Month]. Use the panchang tool for every tithi; state the calendar convention (Amant vs Purnimant) and region, because festival dates shift with the convention.',
        badge: 'Festivals',
        badgeKey: 'starters_badge_festivals',
        mcpServers: ['satchida-panchang-vedic'],
      },
      {
        prompt:
          'Classical Yoga Asanas & Pranayama breathing techniques for: [Specify goal: stress resilience, respiratory capacity, sleep, or back pain]. For each technique give contraindications and safety red flags for the stated condition, a progression level, and cite the classical source (Patanjali / Hatha Yoga Pradipika).',
        badge: 'Yoga/Pranayama',
        badgeKey: 'starters_badge_yoga_pranayama',
        mcpServers: ['satchida-health-wellness'],
      },
      {
        prompt:
          'Audit digital accessibility: Check WCAG 2.2 color contrast ratios between foreground and background palette tokens for: [Hex Colors or Component]. MANDATORY: compute every ratio with the accessibility-tools server, never mental math; output a pass/fail matrix — element | ratio (2 decimals) | required threshold (4.5:1 body text, 3:1 large text and UI components) | verdict.',
        badge: 'WCAG 2.2',
        badgeKey: 'starters_badge_wcag_2_2',
        mcpServers: ['accessibility-tools'],
      },
    ],
  },
  {
    id: 'citizen_essentials',
    label: '🛡️ Citizen Essentials',
    labelKey: 'starters_cat_citizen_essentials',
    modes: ['Chat'],
    starters: [
      {
        prompt:
          'Fuel (E20/XP95), LPG & Energy Grid: City-wise price comparison of petrol, diesel, domestic 14.2kg LPG cylinder rates, and inverter battery sizing with solar net-metering math for: [City / State]. Stamp every price with a source and an "as of" date — refuse live prices without one; compute the battery sizing (VA/Ah) step by step with the stem-study tool, showing the load-inventory math.',
        badge: 'Energy & Fuel',
        badgeKey: 'starters_badge_energy_fuel',
        mcpServers: ['satchida-web-search', 'satchida-stem-study'],
      },
      {
        prompt:
          'Potable Water & FSSAI Food Adulteration: Drinking water TDS standards (BIS 10500), purification methods, and rapid home tests for food adulteration (milk, spices, oils). Give the exact TDS bands as a table, cite BIS IS 10500 and FSSAI DART official documents with links, and mark which home tests are indicative vs confirmatory.',
        badge: 'Food & Water',
        badgeKey: 'starters_badge_food_water',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'School Holidays & Exam Directives: Active District Magistrate (DM) weather/pollution closure orders and latest NTA/CBSE competitive exam schedules for: [District / State]. Official domains only (nta.gov.in, cbse.gov.in, district administration portals) with an order date on every item; if only aggregator sources are found, say so and do not present them as orders. Stamp everything with the retrieved-at time.',
        badge: 'Exam/School',
        badgeKey: 'starters_badge_exam_school',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'Citizen Banking & EPFO Grievance: LIVE alerts (UFBU bank strikes, ATM liquidity, bank holidays) — use web search, cite the source and an "as of" date per item; if no live source is found, say so instead of guessing. STABLE procedure (EPFO Form 31 auto-settlement steps, NCH 1915 / INGRAM consumer complaint filing) — answer with official links (epfindia.gov.in, nch.gov.in) and append: "Rules and rates — verify against the current circular before acting."',
        badge: 'Banking & PF',
        badgeKey: 'starters_badge_banking_pf',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'Transit & Travel Safety: Indian Railways major delays, special train bulletins, airport fog advisories, and NHAI national highway landslide/closure alerts for route: [Origin to Destination]. Output a table: service | status | as-of timestamp | official source (NTES / DGCA / NHAI only); mark anything found only on aggregators as unofficial.',
        badge: 'Transit',
        badgeKey: 'starters_badge_transit',
        mcpServers: ['satchida-web-search'],
      },
    ],
  },
  {
    id: 'governance_law',
    label: '⚖️ Legal & Governance',
    labelKey: 'starters_cat_governance_law',
    modes: ['Work', 'Pro', 'Privacy'],
    starters: [
      {
        prompt:
          'RBI Master Directions & Banking Compliance: For anything dated or changeable (MPC repo rate, EMI benchmarks, UPI transaction limits, digital lending guidelines) — use web search and cite the RBI circular number and date for every figure. Stable framework questions may be answered from knowledge with the line "current values — verify against the latest RBI circular". No circular, no number.',
        badge: 'RBI Regulatory',
        badgeKey: 'starters_badge_rbi_regulatory',
        mcpServers: ['legal-research', 'satchida-web-search'],
      },
      {
        prompt:
          'Supreme Court & Gazette Legal Counsel: Landmark constitutional precedents, Gazette of India statutory notifications, and DPDP / Bharatiya Nyaya Sanhita compliance for: [Legal Subject / Case Query]. Cite every authority properly — case name | neutral citation | bench | date | judgment PDF link; distinguish the holding from obiter dicta; close with "not legal advice — consult a qualified advocate".',
        badge: 'Supreme Court',
        badgeKey: 'starters_badge_supreme_court',
        mcpServers: ['legal-research', 'satchida-web-search'],
      },
      {
        prompt:
          'Enterprise Governance, Risk & Audit (GRC): Formulate an ISO 27001 / SOC2 Type II internal control checklist, gap remediation matrix, and third-party risk assessment for: [System / Infrastructure]. Use exact control identifiers — ISO/IEC 27001:2022 Annex A (A.5.x / A.6.x / A.8.x) and SOC 2 trust criteria (CC1–CC9); every gap row carries severity, owner and remediation deadline.',
        badge: 'GRC Audit',
        badgeKey: 'starters_badge_grc_audit',
        mcpServers: ['legal-research', 'devops-security'],
      },
      {
        prompt:
          'Contract Analysis & Clause Extraction: Review this agreement for indemnification caps, IP assignment, non-solicitation, and governing law clauses.\n\n[Paste contract or clauses here]\n\nOutput a clause table: excerpt (with line references) | risk rating | jurisdiction note (Indian Contract Act 1872 / Stamp Act / Specific Relief Act); list every schedule or exhibit you could NOT review; close with "not legal advice".',
        badge: 'Contracts',
        badgeKey: 'starters_badge_contracts',
        mcpServers: ['legal-research', 'satchida-work-suite'],
      },
    ],
  },
  {
    id: 'geopolitics_intel',
    label: '🛰️ Geopolitics & Defence',
    labelKey: 'starters_cat_geopolitics_intel',
    modes: ['Chat', 'Work', 'Pro'],
    starters: [
      {
        prompt:
          "Strategic Border & Defense Briefing: Current military situation, troop deployments, and intelligence posture along LOC, LAC, and Indian Ocean sea lanes. Confidence-tier every claim — Confirmed (two or more independent sources) / Claimed (single source) / Unverified — with timestamps, and separate each actor's statement from assessed fact; never present a single-source report as established fact.",
        badge: 'Border Intel',
        badgeKey: 'starters_badge_border_intel',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'Critical Mineral & Supply Chain Cartels: Geopolitical control of lithium, rare earths, cobalt, and semiconductor wafer fabs across global trade corridors. Every production-share statistic carries its year and primary source (e.g. USGS Mineral Commodity Summaries YYYY); label estimates as estimates.',
        badge: 'Supply Chains',
        badgeKey: 'starters_badge_supply_chains',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'Foreign Policy & Sovereign Alliances: Multilateral geopolitical dynamics across BRICS, Quad, SCO, and bilateral trade corridors under shifting sanction regimes. Date every outcome, cite official readouts separately from media reporting, and label assessment vs reported fact.',
        badge: 'Foreign Policy',
        badgeKey: 'starters_badge_foreign_policy',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'Cyber Sovereignty & Critical Infrastructure: State-sponsored APT groups, underwater cable security, satellite communications, and grid resilience against cyber warfare. Attribute with caveats ("assessed by" plus the naming organization), tag MITRE ATT&CK technique IDs and CERT-In advisory numbers, and separate confirmed incidents from reported ones.',
        badge: 'Cyber Warfare',
        badgeKey: 'starters_badge_cyber_warfare',
        mcpServers: ['devops-security', 'satchida-web-search'],
      },
    ],
  },
  {
    id: 'security_hardware',
    label: '🔒 Cyber & AI Hardware',
    labelKey: 'starters_cat_security_hardware',
    modes: ['Work', 'Pro', 'Vibecoding'],
    starters: [
      {
        prompt:
          'Automated CVE & Exploit Threat Intelligence: Vulnerability assessment of active zero-days, CVSS 3.1 scores, affected package versions, and vendor patches for: [Software / CVE Identifier]. Output a table: CVE-ID | CVSS vector string | CISA KEV (yes/no) | affected version ranges | fixed version | advisory link — cross-check NVD against the vendor advisory and never quote a score without its source link.',
        badge: 'CVE Intel',
        badgeKey: 'starters_badge_cve_intel',
        mcpServers: ['devops-security', 'satchida-web-search'],
      },
      {
        prompt:
          'Frontier AI Compute Architecture: Benchmark H100 vs B200 SXM clusters, NVLink interconnect bandwidth, FP8 matrix throughput, and datacenter thermal envelopes. Search first and cite the vendor datasheet for every specification with an "as of" date; state FP8 dense vs sparse and NVLink unidirectional vs bidirectional explicitly; if a spec cannot be sourced, mark it unknown rather than recalling an old datasheet.',
        badge: 'GPU Compute',
        badgeKey: 'starters_badge_gpu_compute',
        mcpServers: ['satchida-ai-engineer', 'satchida-web-search'],
      },
      {
        prompt:
          'Surveillance Architecture & Edge Computer Vision: Design a multi-camera RTSP streaming pipeline with on-device YOLO detection, privacy redaction, and local NVR storage. Deliver a Mermaid architecture diagram, step-by-step bitrate/storage math from the stated camera counts, and DPDP-compliant redaction requirements for the video data.',
        badge: 'Edge Vision',
        badgeKey: 'starters_badge_edge_vision',
        mcpServers: ['devops-security', 'satchida-work-suite'],
      },
      {
        prompt:
          'Static Code Vulnerability & Secret Leak Scan: Inspect codebase for hardcoded credentials, exposed API keys, unsafe deserialization, and SQL/command injection vectors.\n\n[Paste code snippet here — or, if repository access via git-librechat is available, name the directory to scan]\n\nReport each finding as severity [CRITICAL/WARN/INFO] | file:line | fix diff; if only a pasted snippet was reviewed, state that the wider repository was not examined.',
        badge: 'Code Security',
        badgeKey: 'starters_badge_code_security',
        mcpServers: ['devops-security', 'git-librechat'],
      },
    ],
  },
  {
    id: 'study_core',
    label: '🎓 STEM & Math',
    labelKey: 'starters_cat_study_core',
    modes: ['Study', 'Study-Local'],
    starters: [
      {
        prompt:
          'Solve the equation [Equation, e.g. x^3 - 4x = 0] step-by-step with KaTeX formulas, factoring, and roots verification. MANDATORY: verify every root with the satchida-stem-study SymPy tool by substitution, state multiplicities, and include a plot — never sign off on mental algebra alone.',
        badge: 'Symbolic Math',
        badgeKey: 'starters_badge_symbolic_math',
        mcpServers: ['satchida-stem-study'],
      },
      {
        prompt:
          'Interactive DeepTutor Concept Book: Create a comprehensive learning module with Socratic milestone exercises and practice quizzes on topic: [Specify concept, e.g. Quantum Gates]',
        badge: 'DeepTutor',
        badgeKey: 'starters_badge_deeptutor',
        mcpServers: ['deeptutor-integration'],
      },
      {
        prompt:
          'Electromagnetic Induction & Modern Physics: Derive Faraday-Lenz laws and Maxwell equations with step-by-step mathematical rigor. Run a dimensional-analysis check on each key step with the stem-study tool and flag any step the tool cannot verify.',
        badge: 'Physics',
        badgeKey: 'starters_badge_physics',
        mcpServers: ['satchida-stem-study'],
      },
      {
        prompt:
          'Algorithm Complexity & Data Structures: Compare Dijkstra vs A* shortest-path algorithms with time/space complexity analysis and verified code. Give the worst/average-case complexity table, a correctness argument, run the code through the stem-study or work-suite validators before calling it verified, and state the admissibility condition under which A* preserves optimality.',
        badge: 'CS Algorithms',
        badgeKey: 'starters_badge_cs_algorithms',
        mcpServers: ['satchida-stem-study'],
      },
    ],
  },
  {
    id: 'ai_research_books',
    label: '🔬 Deep Research & E-Books',
    labelKey: 'starters_cat_ai_research_books',
    modes: ['Study', 'Study-Local', 'Work', 'Pro'],
    starters: [
      {
        prompt:
          'HyperResearch Dossier: Conduct a full 6-phase sovereign deep research investigation on: [Emerging Technology / Scientific Topic / Policy]. Execute — (1) Atomic decomposition into 5–8 falsifiable sub-questions, (2) Multi-tier parallel sweeps across official registers, academic citations, and empirical benchmarks, (3) Build a Contradiction & Correlation Matrix for conflicting claims, (4) Identify unresolved empirical gaps and retracted literature, (5) Run a 4-critic adversarial self-audit (Dialectic / Depth / Width / Citation), then (6) Generate and save a downloadable PDF dossier using create_formatted_document and provide a 1-click download link.',
        badge: 'Deep Research',
        badgeKey: 'starters_badge_deep_research',
        mcpServers: [
          'satchida-web-search',
          'satchida-knowledge-vault',
          'academic-search',
          'arxiv-search',
        ],
      },
      {
        prompt:
          'Scaffold Authoritative E-Book / Whitepaper: Design a complete multi-chapter manuscript blueprint with executive summary, diagrams, and case studies on: [Book Title / Subject]. Query the knowledge vault FIRST for already-indexed material so the outline does not duplicate it; give per chapter: objective, target word count, figure/table list and sourcing plan.',
        badge: 'E-Book / PRD',
        badgeKey: 'starters_badge_e_book_prd',
        mcpServers: ['satchida-knowledge-vault'],
      },
      {
        prompt:
          'Frontier AI Architecture Sizing: Verify transformer layer dimensions, tensor parallelism, and kv-cache memory requirements for a 7B/14B model. Show the FULL kv-cache arithmetic (2 x layers x kv_heads x head_dim x sequence x batch x bytes) with every value labelled and sourced from the model config.json; compute it with the stem-study tool rather than in your head.',
        badge: 'AI Architecture',
        badgeKey: 'starters_badge_ai_architecture',
        mcpServers: ['satchida-ai-engineer', 'satchida-stem-study'],
      },
      {
        prompt:
          'Academic Citation & Peer-Reviewed Survey: Query scholarly literature on arXiv and PubMed for: [Research Field / Scaling Laws]. HARD RULE: cite ONLY papers the tools actually returned — exact title, authors, arXiv ID or DOI, year — never emit a reference you did not retrieve; if the tools return nothing, say so plainly.',
        badge: 'Scholar/arXiv',
        badgeKey: 'starters_badge_scholar_arxiv',
        mcpServers: ['arxiv-search', 'academic-search'],
      },
    ],
  },
  {
    id: 'vibecoding_dev',
    label: '💻 Vibe Coding & Architecture',
    labelKey: 'starters_cat_vibecoding_dev',
    modes: ['Vibecoding', 'Work', 'Pro'],
    starters: [
      {
        prompt:
          'Staff Architect Blueprint: Architect a scalable REST / WebSocket API with rate limiting, JWT authentication, and idempotent worker queue for: [Application Requirement]. Include non-functional requirements with capacity math (requests/sec to workers and queue depth), a threat model, Mermaid sequence + ER diagrams, an explicit assumptions list, and the chosen idempotency semantics (at-least-once vs exactly-once).',
        badge: 'Architecture',
        badgeKey: 'starters_badge_architecture',
        mcpServers: ['satchida-work-suite', 'devops-security'],
      },
      {
        prompt:
          'Plan Execution Supervisor: Audit the active implementation plan, ground every step in repository files, and propose bounded atomic edits:\n\n[Plan file path, or paste the plan here — if a plan exists in the repository, name it; if none exists, ask which plan to audit rather than inventing one]',
        badge: 'Plan Supervisor',
        badgeKey: 'starters_badge_plan_supervisor',
        mcpServers: ['git-librechat'],
      },
      {
        prompt:
          'Full-Stack Rapid UI Prototype: Build a modern, accessible interactive component in React/TypeScript with Tailwind CSS and responsive design for: [Component Name / Feature]. Ship keyboard navigation, WCAG AA contrast verified with accessibility-tools, loading/empty/error states, and a focused component test — accessibility is part of the deliverable, not a follow-up.',
        badge: 'Vibe UI',
        badgeKey: 'starters_badge_vibe_ui',
        mcpServers: ['satchida-work-suite', 'accessibility-tools'],
      },
      {
        prompt:
          'Database Performance & Query Optimization: Analyze slow query execution plans, design optimal composite indexes, and prevent table locks for: [SQL Query or Schema]. State the scope up front: analysis covers execution plans you paste — the database itself is not queried; require EXPLAIN output, show selectivity math, and give a before/after plan diff.',
        badge: 'Database',
        badgeKey: 'starters_badge_database',
        mcpServers: ['satchida-work-suite'],
      },
    ],
  },
  {
    id: 'privacy_vault',
    label: '🔒 Sovereign Vault & Privacy',
    labelKey: 'starters_cat_privacy_vault',
    modes: ['Privacy'],
    starters: [
      {
        prompt:
          'Offline Executive Document Synthesis: Generate a presentation (.pptx), report (.pdf), or spreadsheet (.xlsx) completely on-device without cloud leakage on: [Topic / Presentation Title]',
        badge: 'Document Gen',
        badgeKey: 'starters_badge_document_gen',
        mcpServers: ['satchida-knowledge-vault'],
      },
      {
        prompt:
          'Sovereign Knowledge Vault RAG: Search private enterprise vaults and query indexed textbooks/policies with exact verified citations for: [Search Query]. Cite document name + page or chunk + a VERBATIM quote; if nothing matches, state "no match found" — never paraphrase a passage and present it as a quote.',
        badge: 'Vault RAG',
        badgeKey: 'starters_badge_vault_rag',
        mcpServers: ['satchida-knowledge-vault'],
      },
      {
        prompt:
          'Confidential Strategy Formulation: Draft an internal strategic business plan with 100% on-device inference and zero telemetry for: [Initiative / Product Launch]',
        badge: 'Zero Telemetry',
        badgeKey: 'starters_badge_zero_telemetry',
        mcpServers: ['satchida-knowledge-vault'],
      },
      {
        prompt:
          'Deep Forensic Document Audit: Cross-examine uploaded financial and legal documents for discrepancies, audit gaps, and hidden obligations.\n\n[Describe documents or paste excerpt]\n\nOutput a discrepancy table with page/section references and a stated materiality threshold, list what was NOT reviewed, and close with "not a substitute for a qualified auditor or lawyer".',
        badge: 'Forensic Audit',
        badgeKey: 'starters_badge_forensic_audit',
        mcpServers: ['satchida-knowledge-vault'],
      },
    ],
  },
  {
    id: 'motion_executive',
    label: '📊 Executive & Metrics',
    labelKey: 'starters_cat_motion_executive',
    modes: ['Motion'],
    starters: [
      {
        title: '3D Executive QBR & Revenue Deck',
        icon: '📊',
        badge: 'Executive',
        badgeKey: 'starters_badge_motion_executive',
        description:
          'Spatial camera sweep across 3D revenue bars, glowing KPI metrics, and year-over-year growth stats',
        prompt:
          'Generate an animated 3D executive report with 60fps camera pan, kinetic charts, and KPI counters for: [Company Name & Key Metrics / Q3 Revenue & Growth Highlights]',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Investor Pitch & Market Traction',
        icon: '🚀',
        badge: 'Investor Pitch',
        badgeKey: 'starters_badge_motion_pitch',
        description:
          'High-energy kinetic deck with glowing glass cards, TAM/SAM sizing, and unit economics',
        prompt:
          'Build a high-energy kinetic investor pitch presentation with 3D perspective depth, glowing glass cards, and market traction figures for: [Startup Name & Value Proposition / Problem & Solution]',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Strategic Milestone Roadmap',
        icon: '🗺️',
        badge: 'Milestone Roadmap',
        badgeKey: 'starters_badge_motion_roadmap',
        description:
          'Continuous forward camera track through a floating 3D chronological roadmap with phased deliverables',
        prompt:
          'Design an immersive 3D timeline camera flight navigating through phased strategic milestones and deliverables for: [Product / Project Initiative Roadmap]',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_kinetic',
    label: '⚡ Kinetic Typography',
    labelKey: 'starters_cat_motion_kinetic',
    modes: ['Motion'],
    starters: [
      {
        title: 'Kinetic Typography Manifesto',
        icon: '⚡',
        badge: 'Kinetic Speech',
        badgeKey: 'starters_badge_motion_kinetic',
        description:
          'Fast-paced rhythmic typography with staggered word reveals, dynamic camera shifts, and contrast bursts',
        prompt:
          'Create a dynamic kinetic typography motion graphic with staggered character animations, bold camera push-throughs, and dramatic audio/visual pacing for: [Core Message / Speech Excerpt / Brand Manifesto]',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Distributed Systems & Architecture Flow',
        icon: '🧩',
        badge: 'Tech Explainer',
        badgeKey: 'starters_badge_motion_tech',
        description:
          'Interactive 3D particle simulation of request routing, API gateways, and distributed event pipelines',
        prompt:
          'Build an interactive 3D motion graphic explaining distributed system flow, microservice handshakes, and data pipelines for: [System Architecture / Pipeline Topic]',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Scientific & Physics Simulation',
        icon: '🔬',
        badge: 'STEM Visualizer',
        badgeKey: 'starters_badge_motion_stem',
        description:
          'SVG path morphing, vector fields, and 3D camera zoom illustrating complex mathematical or physical laws',
        prompt:
          'Simulate and animate complex physical or scientific concepts with GSAP SVG path morphing, particle field, and camera zoom for: [Scientific Phenomenon / Mathematical Formula / Physics Concept]',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_product',
    label: '✨ Product & SaaS Launch',
    labelKey: 'starters_cat_motion_product',
    modes: ['Motion'],
    starters: [
      {
        title: 'Dark-Mode SaaS Hero Launch',
        icon: '💎',
        badge: 'SaaS Launch',
        badgeKey: 'starters_badge_motion_saas',
        description:
          'Cinema-grade teaser featuring floating glass UI mockup cards, pulsing neon laser borders, and feature highlights',
        prompt:
          'Produce a 60fps dark-mode SaaS product launch teaser with glassmorphism, floating UI mockups, and glowing beam highlights for: [Product / Feature Name & Top 3 Capabilities]',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Live Animated Analytics Dashboard',
        icon: '📈',
        badge: 'KPI Analytics',
        badgeKey: 'starters_badge_motion_kpi',
        description:
          'Animated dashboard with rolling number tickers, SVG gradient chart sweeps, and live status beacons',
        prompt:
          'Construct an animated real-time analytics dashboard with counting numbers, glowing SVG line graphs, and donut chart sweeps for: [Metric Dashboard Domain / E-commerce, Cloud Ops, or Financial Analytics]',
        mcpServers: ['satchida-motion'],
      },
      {
        title: '3D Mobile App UX Showcase',
        icon: '📱',
        badge: 'Mobile UX',
        badgeKey: 'starters_badge_motion_mobile',
        description:
          'Sleek angled 3D smartphone frame with swipe transitions, floating UI callouts, and tactile micro-interactions',
        prompt:
          'Create an animated 3D mobile mockup showcase highlighting new mobile app UX, smooth screen transitions, and feature badges for: [App Name & Key Features]',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_media',
    label: '🎬 Teasers & Video Render',
    labelKey: 'starters_cat_motion_media',
    modes: ['Motion'],
    starters: [
      {
        title: 'Futuristic Brand Intro & Logo Reveal',
        icon: '✨',
        badge: 'Brand Stinger',
        badgeKey: 'starters_badge_motion_stinger',
        description:
          '5-second high-octane 3D spatial logo reveal with particle grid sweep, anamorphic lens flares, and sonic typography',
        prompt:
          'Generate a sleek, futuristic 5-second branded video intro/stinger with neon grid particles, camera tilt, and logo reveal for: [Channel / Show Name & Brand Slogan]',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Vertical 9:16 Kinetic Social Reel',
        icon: '📲',
        badge: 'Social Reel',
        badgeKey: 'starters_badge_motion_social',
        description:
          'Mobile-first vertical kinetic graphic with striking hook typography, animated stat callout, and call-to-action',
        prompt:
          'Design an attention-grabbing 9:16 vertical motion graphic with bold typography, animated bar chart, and quote reveal for: [Quote or Statistic / Target Audience]',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Playwright 60fps MP4 Video Exporter',
        icon: '🎥',
        badge: 'MP4 Exporter',
        badgeKey: 'starters_badge_motion_mp4',
        description:
          'Render any GSAP HTML motion graphic artifact directly into a smooth 1080p 60fps MP4 video file',
        prompt:
          'Validate this motion artifact timeline and render a crisp 1080p 60fps MP4 video export with smooth transitions for: [Paste HTML code or describe motion scene]',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
];
