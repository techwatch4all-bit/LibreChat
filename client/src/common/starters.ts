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

export type MotionStudioGroupId =
  | 'arch_engineering'
  | 'robotics_how'
  | 'stem_tech'
  | 'business_creative'
  | 'care_living';

export interface MotionStudioGroup {
  id: MotionStudioGroupId;
  label: string;
  labelKey: TranslationKeys;
}

export const MOTION_GROUPS: MotionStudioGroup[] = [
  {
    id: 'arch_engineering',
    label: '🏗️ Arch & Drones',
    labelKey: 'com_ui_motion_group_arch_engineering',
  },
  {
    id: 'robotics_how',
    label: '🤖 Robotics & How',
    labelKey: 'com_ui_motion_group_robotics_how',
  },
  {
    id: 'stem_tech',
    label: '🎓 STEM & Cyber',
    labelKey: 'com_ui_motion_group_stem_tech',
  },
  {
    id: 'business_creative',
    label: '💼 Business & Art',
    labelKey: 'com_ui_motion_group_business_creative',
  },
  {
    id: 'care_living',
    label: '❤️ Health & Home',
    labelKey: 'com_ui_motion_group_care_living',
  },
];

export interface StarterItem {
  prompt: string;
  badge?: string;
  badgeKey?: TranslationKeys;
  mcpServers?: string[];
  title?: string;
  icon?: string;
  description?: string;
  engineTag?: string;
  featured?: boolean;
  keywords?: string[];
}

export interface StarterCategory {
  id: string;
  label: string;
  labelKey: TranslationKeys;
  group?: MotionStudioGroupId;
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
    id: 'motion_architecture',
    label: '🏛️ Floor Plans & Arch',
    labelKey: 'starters_cat_motion_architecture',
    group: 'arch_engineering',
    modes: ['Motion'],
    starters: [
      {
        title: '2D-to-3D Architectural Floor Plan',
        icon: '🏛️',
        badge: 'CAD · 3D Floorplan',
        badgeKey: 'starters_badge_motion_arch_cad',
        engineTag: 'CAD · 3D',
        featured: true,
        keywords: [
          'architect',
          'floor plan',
          'blueprint',
          'cad',
          '3bhk',
          'apartment',
          'interior',
          'extrude',
        ],
        description:
          '2D orthographic CAD walls & door arcs smoothly morphing into an extruded isometric 3D plan with toggleable layers',
        prompt:
          'Build a precision orthographic 2D architectural CAD blueprint (dimension ticks, sq-ft room labels, wall thickness, door swing arcs) that smoothly morphs into an isometric 3D extruded model with toggleable Furniture/Dimension layers and Top/Isometric/Walkthrough camera presets for [Building or Plot: e.g. 1,400 sq ft 3BHK Apartment or Modern Café] featuring [Rooms & Zoning: e.g. Open Kitchen, Master Suite, Living Balcony, Study Nook] styled in [Orientation & Palette: e.g. North-Facing Warm Minimalist Wood & Concrete].',
        mcpServers: ['satchida-motion', 'satchida-work-suite'],
      },
      {
        title: 'Solar Sun-Path & Ventilation Sim',
        icon: '☀️',
        badge: 'Sun & Vastu Sim',
        badgeKey: 'starters_badge_motion_sun_path',
        engineTag: 'Daylight · Sim',
        keywords: ['vastu', 'sun', 'daylight', 'shadow', 'ventilation', 'airflow', 'architecture'],
        description:
          'Time-of-day solar shadow polygons, solstice switch, Vastu compass overlay, and natural cross-ventilation streams',
        prompt:
          'Create an architectural floor and cross-section daylight simulator with an interactive Time-of-Day slider (06:00–20:00), Summer/Winter Solstice toggle, real-time shadow polygons, directional compass/Vastu ring, and cross-ventilation airflow streamlines for [Home or Office Layout & Plot Facing] located in [City / Climate: e.g. Bengaluru Tropical or Delhi Hot-Dry].',
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      },
      {
        title: 'MEP & Structural X-Ray Layers',
        icon: '🏗️',
        badge: 'MEP X-Ray',
        badgeKey: 'starters_badge_motion_mep_xray',
        engineTag: 'X-Ray · SVG',
        keywords: ['mep', 'plumbing', 'hvac', 'electrical', 'structural', 'beams', 'blueprint'],
        description:
          'Interactive structural beam, electrical conduit, plumbing riser, and HVAC duct X-ray layer opacity switcher',
        prompt:
          'Generate an interactive building X-Ray cutaway explorer with opacity toggles for Structural Beams, Electrical Conduits, Plumbing Risers, and HVAC Ducts, plus clickable load and routing pins for [Structure Type: e.g. 2-Storey Duplex Villa or Modular Clinic Wing] prioritizing [System Focus: e.g. Graywater Plumbing, Drain Slopes & Solar Backup Wiring].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Interior Elevation & Kelvin Lab',
        icon: '🛋️',
        badge: 'Room Lighting',
        badgeKey: 'starters_badge_motion_room_lighting',
        engineTag: '2700K–5000K',
        keywords: [
          'interior',
          'kitchen',
          'lighting',
          'kelvin',
          'cabinetry',
          'elevation',
          'ergonomic',
        ],
        description:
          'Wall elevation lighting tester (2700K warm to 5000K task) with material swatch swaps and clearance rulers',
        prompt:
          'Design an interactive interior wall elevation and lighting laboratory featuring a live Color Temperature slider (2700K Warm to 5000K Task), cabinetry and flooring swatch switchers, and ADA ergonomic clearance rulers for [Room: e.g. U-Shaped Modular Kitchen or Studio Bedroom] styled with [Material Palette & Lighting Mood].',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_drones',
    label: '🚁 Drones & UAV',
    labelKey: 'starters_cat_motion_drones',
    group: 'arch_engineering',
    modes: ['Motion'],
    starters: [
      {
        title: 'Multirotor TWR & Propulsion Lab',
        icon: '🚁',
        badge: 'UAV Propulsion',
        badgeKey: 'starters_badge_motion_uav_prop',
        engineTag: 'Three.js · UAV',
        featured: true,
        keywords: [
          'drone',
          'uav',
          'quadcopter',
          'hexacopter',
          'fpv',
          'thrust',
          'twr',
          'propeller',
          'lipo',
        ],
        description:
          'Exploded-to-assembled 3D multirotor frame with CW/CCW prop wash rings, throttle slider, and verified hover math',
        prompt:
          'Compute thrust-to-weight ratio, hover current, and safe endurance first using drone_aerodynamics_and_propulsion, then build an interactive exploded-to-assembled 3D/SVG multirotor simulation with counter-rotating CW/CCW prop wash rings, Center-of-Gravity marker, and a live Throttle slider (0–100%) for [Airframe: e.g. 5-inch FPV Freestyle Quad or 10kg Agri-Sprayer Hexacopter] configured with [Specs: All-up weight (g), Motor thrust (g), Propeller size & LiPo S/mAh].',
        mcpServers: ['satchida-motion', 'satchida-maker-engineering'],
      },
      {
        title: 'Drone SLAM & Waypoint Mission',
        icon: '📡',
        badge: 'Flight Pathfinding',
        badgeKey: 'starters_badge_motion_uav_slam',
        engineTag: 'SLAM · 3D',
        keywords: ['drone', 'slam', 'lidar', 'geofence', 'waypoint', 'pid', 'rth', 'autonomous'],
        description:
          'Terrain corridor with LiDAR cone, no-fly geofence cylinders, wind-drift vector disturbance, and PID stabilization',
        prompt:
          'Animate an autonomous UAV mission corridor with a rotating 3D LiDAR detection cone, dynamic geofence/no-fly cylinders, wind-drift vector disturbance toggle, PID attitude telemetry plot, and low-battery RTH trigger for [Mission Profile: e.g. Warehouse Inventory Scan, Forest Search & Rescue, or Bridge Inspection] navigating [Obstacle or Wind Constraints].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Airfoil Lift, Stall & Vortex Lab',
        icon: '🌬️',
        badge: 'Aerodynamics',
        badgeKey: 'starters_badge_motion_aero',
        engineTag: 'CFD · Lab',
        keywords: [
          'airfoil',
          'vtol',
          'lift',
          'drag',
          'stall',
          'wind tunnel',
          'naca',
          'aerodynamics',
        ],
        description:
          'Interactive wind-tunnel streamline particle solver with Angle-of-Attack slider (-10° to +25°) and stall vortices',
        prompt:
          'Build an interactive wind-tunnel streamline particle solver around a cambered airfoil or VTOL tilt-rotor with a live Angle-of-Attack slider (-10 to +25 deg) visualizing laminar flow breakdown into stall vortices plus live Lift/Drag vectors for [Airfoil or Aircraft: e.g. NACA 2412 Survey Glider or Quad Tilt-Rotor Transition] across [Flight Regime: Takeoff / Cruise / High-AoA Stall].',
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      },
    ],
  },
  {
    id: 'motion_civil_logistics',
    label: '🌉 Civil & Supply Chains',
    labelKey: 'starters_cat_motion_civil_logistics',
    group: 'arch_engineering',
    modes: ['Motion'],
    starters: [
      {
        title: 'Bridge Truss Stress & Load Sim',
        icon: '🌉',
        badge: 'Structural Truss',
        badgeKey: 'starters_badge_motion_truss',
        engineTag: 'FEA · Sim',
        keywords: [
          'bridge',
          'truss',
          'civil',
          'structural',
          'tension',
          'compression',
          'beam',
          'load',
        ],
        description:
          'Color-coded Tension vs Compression truss members bending dynamically as truck load moves across spans',
        prompt:
          'Verify beam stress formulas with mechanical_gear_and_stress, then create a precision vector structural bridge simulator with Tension (cyan) vs Compression (coral) force color-coding, span deflection curves, and a moving Truck Weight & Speed slider for [Bridge Structure: e.g. 120m Steel Warren Truss or Cable-Stayed River Flyover] under [Load Scenario: e.g. Heavy Freight Convoy + Lateral Gust].',
        mcpServers: ['satchida-motion', 'satchida-maker-engineering'],
      },
      {
        title: 'Supply & Cold-Chain Digital Twin',
        icon: '🚢',
        badge: 'Logistics Twin',
        badgeKey: 'starters_badge_motion_logistics',
        engineTag: 'Digital Twin',
        keywords: [
          'supply chain',
          'logistics',
          'port',
          'warehouse',
          'cold chain',
          'inventory',
          'freight',
        ],
        description:
          'End-to-end spatial corridor tracing factory AGV, port cranes, rail/vessel, and bottleneck fault injection',
        prompt:
          'Choreograph a spatial logistics corridor camera flight tracing Raw Material -> Factory AGV -> Smart Port Crane -> Vessel/Rail -> Cold-Chain Truck with live node buffer bars, SLA clock, and a Bottleneck Fault Injection button for [Supply Network / Cargo: e.g. -20C Vaccine Cold-Chain or EV Battery Pack Supply] testing [Disruption Scenario: e.g. Port Congestion Reroute].',
        mcpServers: ['satchida-motion', 'satchida-work-suite'],
      },
      {
        title: 'Smart Traffic & EV Microgrid Flow',
        icon: '🚦',
        badge: 'Smart Mobility',
        badgeKey: 'starters_badge_motion_traffic',
        engineTag: 'Flow · Sim',
        keywords: ['traffic', 'intersection', 'ev', 'smart city', 'urban', 'signals', 'microgrid'],
        description:
          'Adaptive traffic light phase timing simulator with emergency green-wave override and EV charger queue meters',
        prompt:
          'Simulate an interactive urban intersection & EV fast-charging microgrid with queue-length gauges, adaptive signal timing sliders, and an emergency ambulance green-corridor toggle for [City Junction / Campus Zone] balancing [Peak Vehicle Volume & Solar Buffer Target].',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_robotics',
    label: '🤖 Robotics & Kinematics',
    labelKey: 'starters_cat_motion_robotics',
    group: 'robotics_how',
    modes: ['Motion'],
    starters: [
      {
        title: '6-DOF Robotic Arm IK & Torque Lab',
        icon: '🦾',
        badge: 'Arm Kinematics',
        badgeKey: 'starters_badge_motion_arm_ik',
        engineTag: 'Three.js · IK',
        featured: true,
        keywords: [
          'robot',
          'arm',
          'kinematics',
          'ik',
          'fk',
          '6dof',
          'scara',
          'torque',
          'mechatronics',
        ],
        description:
          'Articulated robotic arm with draggable target crosshair (live IK solver), J1–J6 sliders, and reach envelope',
        prompt:
          'Validate joint torque and gear reduction via mechanical_gear_and_stress, then build an interactive articulated robotic arm with a draggable 2D/3D target crosshair (live inverse kinematics solver), individual Joint angle sliders (J1–J6), workspace reach envelope arc, and telemetry HUD for [Robot Config: e.g. 6-Axis Articulated Welder, 4-Axis SCARA Pick-and-Place, or Surgical Arm] handling [Payload & Task: e.g. 5kg Gearbox Assembly].',
        mcpServers: ['satchida-motion', 'satchida-maker-engineering'],
      },
      {
        title: 'Rover SLAM & LiDAR Maze Mapper',
        icon: '🤖',
        badge: 'SLAM Navigation',
        badgeKey: 'starters_badge_motion_rover_slam',
        engineTag: 'LiDAR · Split',
        keywords: ['rover', 'slam', 'lidar', 'astar', 'rrt', 'maze', 'occupancy', 'amr'],
        description:
          'Split-screen rover emitting 360° raycast LiDAR beams alongside a real-time occupancy grid and A* path planner',
        prompt:
          'Construct a synchronized split-screen robotics SLAM simulator: Left shows a differential-drive rover sweeping 360-degree raycast LiDAR beams around obstacles; Right builds the real-time occupancy grid and A*/RRT* planned path with Pause and Shuffle Obstacles controls for [Environment: e.g. Hospital Delivery Corridor, Mars Crater Field, or Autonomous Warehouse] comparing [Planner Strategy].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Factory Cell & PLC State Machine',
        icon: '🏭',
        badge: 'PLC Automation',
        badgeKey: 'starters_badge_motion_plc',
        engineTag: 'State · Sim',
        keywords: ['plc', 'factory', 'conveyor', 'oee', 'automation', 'gripper', 'industrial'],
        description:
          'Synchronized conveyor, optical proximity sensors, diverter piston, live state graph, and E-Stop test toggle',
        prompt:
          'Design an automated industrial conveyor workcell synchronized with optical proximity sensors, pneumatic diverter pistons, robotic gripper pick cycles, a live highlighted PLC state-transition graph, OEE counter, and Emergency E-Stop toggle for [Workcell Line: e.g. EV Cell Sorting & Weld, Beverage Cap Inspector, or Automated Pharmacy] targeting [Cycle Rate & Fault Condition].',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_how_it_works',
    label: '⚙️ How Things Work',
    labelKey: 'starters_cat_motion_how_it_works',
    group: 'robotics_how',
    modes: ['Motion'],
    starters: [
      {
        title: 'Engine & Drivetrain Cutaway Lab',
        icon: '⚙️',
        badge: 'Engine Cutaway',
        badgeKey: 'starters_badge_motion_engine',
        engineTag: 'Cutaway · RPM',
        featured: true,
        keywords: [
          'how things work',
          'engine',
          'piston',
          'turbine',
          'jet',
          'ev motor',
          'cutaway',
          'wankel',
        ],
        description:
          'Synchronized cutaway animation with RPM throttle slider (600–7000 RPM), spark/exhaust particles, and phase gauges',
        prompt:
          'Create an intricate synchronized mechanical cutaway animation featuring an interactive RPM Throttle slider (600–7000 RPM), intake/compression/power/exhaust phase indicators, thermal spark/airflow particle bursts, and crank-angle telemetry explaining [Machine: e.g. 4-Stroke Otto ICE Engine, High-Bypass Turbofan Jet, Brushless EV Traction Motor, or Wankel Rotary] in [View Style: Isometric Cutaway / Thermal Stress].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Gearbox, Hydraulics & Lever Lab',
        icon: '🔧',
        badge: 'Mechanical Lab',
        badgeKey: 'starters_badge_motion_gearbox',
        engineTag: 'Gears · Force',
        keywords: [
          'gearbox',
          'planetary',
          'differential',
          'hydraulics',
          'brake',
          'escapement',
          'torque',
        ],
        description:
          'Meshing involute gear teeth / hydraulic pistons with RPM & load sliders, torque math, and exploded scrubber',
        prompt:
          'Calculate exact gear ratios, torque multiplication, and Pascal pressure using mechanical_gear_and_stress, then animate meshing involute gears or hydraulic cylinders with Input RPM & Load sliders plus an Exploded Assembly scrubber for [Mechanism: e.g. Planetary Epicyclic Gearbox, Car Bevel Differential, Hydraulic Disc Brake, or Mechanical Watch Escapement] at [Ratio / Pressure Target].',
        mcpServers: ['satchida-motion', 'satchida-maker-engineering'],
      },
      {
        title: 'Optics, Lens & Laser Ray-Tracing',
        icon: '🔭',
        badge: 'Optics Lab',
        badgeKey: 'starters_badge_motion_optics',
        engineTag: 'Raytrace · Lab',
        keywords: [
          'optics',
          'camera',
          'lens',
          'aperture',
          'laser',
          'telescope',
          'refraction',
          'eye',
        ],
        description:
          'Live light-ray refraction through multi-element glass lenses with f-stop Aperture and Focal Distance sliders',
        prompt:
          'Simulate geometric ray-tracing through curved glass lenses or mirrors with interactive Aperture (f/1.4 to f/16) and Focal Distance sliders visualizing focal plane convergence, bokeh spread, and dispersion for [Optical System: e.g. 50mm Camera Prime Lens, Reflecting Astronomical Telescope, Human Eye Myopia Correction, or Fiber-Optic Total Internal Reflection].',
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      },
      {
        title: 'Inside Everyday Appliances & Tech',
        icon: '🔋',
        badge: 'Inside Devices',
        badgeKey: 'starters_badge_motion_devices',
        engineTag: 'Exploded · 3D',
        keywords: [
          'microwave',
          'refrigerator',
          'battery',
          'lithium',
          'headphones',
          'anc',
          'appliances',
        ],
        description:
          'Peel-away cutaway revealing lithium-ion migration, refrigerant heat loops, magnetron microwaves, or ANC cancellation',
        prompt:
          'Build a multi-layer peeled cutaway revealing invisible working physics—such as ion intercalation, phase-change cooling loops, acoustic wave cancellation, or RF heating—with toggleable housing layers and annotated callouts for [Device: e.g. Microwave Oven Magnetron, Inverter Refrigerator Compressor, Active Noise-Cancelling Headphones, or Lithium-Ion Battery Cell].',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_electronics',
    label: '🔌 Circuits & AI Silicon',
    labelKey: 'starters_cat_motion_electronics',
    group: 'robotics_how',
    modes: ['Motion'],
    starters: [
      {
        title: 'Circuit Simulator & Oscilloscope',
        icon: '🔌',
        badge: 'Circuit Scope',
        badgeKey: 'starters_badge_motion_circuit',
        engineTag: 'Scope · Live',
        keywords: [
          'circuit',
          'pcb',
          'oscilloscope',
          '555',
          'op-amp',
          'buck',
          'rectifier',
          'voltage',
        ],
        description:
          'Animated current pulse dots along schematics synced with R/C/Gain sliders and dual-channel oscilloscope traces',
        prompt:
          'Compute RC/RLC timing and component values using electronics_circuit_designer, then animate glowing current flow along a crisp vector schematic paired with interactive R/C/Gain sliders and a live dual-channel Oscilloscope waveform for [Circuit: e.g. 555 Timer Astable Blinker, Inverting Op-Amp, Full-Wave Bridge Rectifier, or Buck DC-DC Converter] targeting [Voltage / Frequency Spec].',
        mcpServers: ['satchida-motion', 'satchida-maker-engineering'],
      },
      {
        title: 'CPU Pipeline & LLM AI Silicon',
        icon: '🧠',
        badge: 'Compute Arch',
        badgeKey: 'starters_badge_motion_compute',
        engineTag: 'Logic · AI',
        keywords: [
          'cpu',
          'riscv',
          'logic gates',
          'adder',
          'pipeline',
          'transformer',
          'kv cache',
          'gpu',
        ],
        description:
          'Clock-stepped datapath showing ALU/logic signal pulses OR Transformer Q-K-V attention & KV-cache memory meters',
        prompt:
          'Construct a synchronized clock-stepped compute visualizer with Single-Step and Auto-Clock controls tracing gate/pipeline execution or Transformer Q-K-V self-attention & KV-cache memory meters (verified with llm_vram_and_compute_estimator where AI applies) for [Architecture: e.g. 4-Bit Ripple-Carry Adder, RISC-V 5-Stage Pipeline, or LLM Self-Attention & KV-Cache].',
        mcpServers: ['satchida-motion', 'satchida-ai-engineer'],
      },
      {
        title: 'Solar MPPT & EV Battery BMS Lab',
        icon: '⚡',
        badge: 'Power Electronics',
        badgeKey: 'starters_badge_motion_mppt',
        engineTag: 'MPPT · Sim',
        keywords: ['solar', 'mppt', 'inverter', 'bms', 'ev', 'charger', 'grid', 'battery'],
        description:
          'PV string DC -> MPPT tracker -> BMS cell balancing -> pure sine inverter trace with Irradiance & Load sliders',
        prompt:
          'Design an interactive renewable power-electronics schematic with Solar Irradiance & Home Load sliders tracing PV DC -> MPPT duty-cycle tracking -> BMS cell balance bars -> pure sine-wave grid output for [System: e.g. 5kW Hybrid Home Solar + LFP Pack or 800V EV Fast Charger] under [Cloud / Grid Outage Scenario].',
        mcpServers: ['satchida-motion', 'satchida-maker-engineering'],
      },
    ],
  },
  {
    id: 'motion_education',
    label: '🎓 STEM, Chem & Coding',
    labelKey: 'starters_cat_motion_education',
    group: 'stem_tech',
    modes: ['Motion'],
    starters: [
      {
        title: 'Physics Forces & Wave-Field Lab',
        icon: '⚛️',
        badge: 'Physics Sim',
        badgeKey: 'starters_badge_motion_physics',
        engineTag: 'Physics · Lab',
        featured: true,
        keywords: [
          'physics',
          'wave',
          'gravity',
          'electromagnetism',
          'pendulum',
          'jee',
          'quantum',
          'optics',
        ],
        description:
          'Interactive force vectors, particle waves, tunable Mass/Field/Slit sliders, and verified quantitative readouts',
        prompt:
          'Verify quantitative physics relations using scientific_physics_solver, then simulate an interactive physics experiment with live vector force arrows, particle wave fields, tunable parameter sliders (Mass / Wavelength / Field), and Play/Reset controls for [Physics Topic: e.g. Double-Slit Quantum Interference, Orbital Escape Velocity, or Faraday Electromagnetic Induction] at [Student Level: e.g. CBSE Class 12 / JEE / University].',
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      },
      {
        title: 'Dynamic Math & Calculus Proofs',
        icon: '📐',
        badge: 'Math Morph',
        badgeKey: 'starters_badge_motion_math',
        engineTag: 'SymPy · SVG',
        keywords: [
          'math',
          'calculus',
          'fourier',
          'derivative',
          'integral',
          'theorem',
          'geometry',
          'algebra',
        ],
        description:
          'SVG geometric shear/morph proofs with interactive Fourier harmonic N-sliders and tangent derivative steppers',
        prompt:
          'Verify symbolic math derivations using solve_symbolic_math or calculus_derivative_integral, then build a smooth geometric SVG morphing proof with interactive Secant-to-Tangent or Fourier N-Harmonic sliders (N=1..15) and KaTeX equation highlights for [Theorem or Concept: e.g. Pythagorean Area Shear Proof, Fourier Square-Wave Harmonics, or Gradient Descent Optimization].',
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      },
      {
        title: 'Chemistry Orbitals & Kinetics',
        icon: '🧪',
        badge: 'Chemistry Lab',
        badgeKey: 'starters_badge_motion_chemistry',
        engineTag: '3D · Chem',
        keywords: [
          'chemistry',
          'molecule',
          'orbitals',
          'reaction',
          'titration',
          'ph',
          'catalyst',
          'benzene',
        ],
        description:
          'Balanced molecular orbital covalent bonding, activation-energy catalyst curve slider, or pH titration drop sim',
        prompt:
          'Balance stoichiometry and verify molar ratios with balance_chemical_equation, then animate 3D/2D electron orbital hybridization, bond formation arrows, an Activation Energy barrier chart with Catalyst & Temperature sliders, or an interactive burette pH titration curve for [Reaction or Molecule: e.g. SN2 Nucleophilic Attack, Benzene Pi Orbitals, NaOH + HCl Titration, or Haber Ammonia Synthesis] focusing on [Orbital / Equilibrium Focus].',
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      },
      {
        title: 'Cellular Biology Micro-Journey',
        icon: '🧬',
        badge: 'Bio Animation',
        badgeKey: 'starters_badge_motion_bio',
        engineTag: 'Bio · 3D',
        keywords: [
          'biology',
          'dna',
          'cell',
          'crispr',
          'mitosis',
          'photosynthesis',
          'synapse',
          'neet',
        ],
        description:
          'Microscopic 3D flythrough across cell membranes and DNA forks with Organelle X-Ray labels and Phase Stepper',
        prompt:
          'Animate a microscopic 3D biological spatial flythrough showing membranes, enzymes, and genetic complexes with toggleable Organelle X-Ray callouts and a manual Phase Stepper (Pause / Next Phase) for [Biological Process: e.g. DNA Replication Fork, CRISPR-Cas9 Target Cleavage, Photosynthesis ATP Synthase, or Synapse Neurotransmission].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Algorithm & Recursion Tracer',
        icon: '💻',
        badge: 'Algo & Code',
        badgeKey: 'starters_badge_motion_algo',
        engineTag: 'Trace · Step',
        keywords: [
          'algorithm',
          'coding',
          'sorting',
          'dijkstra',
          'recursion',
          'heap',
          'stack',
          'trees',
        ],
        description:
          'Steppable array/graph visualizer with custom input editor, live call-stack frames, and Big-O swap counters',
        prompt:
          'Build a deterministic interactive algorithm & code tracer featuring an editable custom input array/graph, Step Forward/Back & Speed buttons, synchronized visual swap/path canvas, and a live Call-Stack / Heap Pointer / Big-O telemetry panel for [Algorithm: e.g. QuickSort Partitioning, Dijkstra Priority Queue, DFS/BFS Maze Solver, or Dynamic Programming Knapsack].',
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      },
    ],
  },
  {
    id: 'motion_networks',
    label: '🌐 Networks & Cyber',
    labelKey: 'starters_cat_motion_networks',
    group: 'stem_tech',
    modes: ['Motion'],
    starters: [
      {
        title: 'DNS, TCP & TLS 1.3 Packet Journey',
        icon: '🌐',
        badge: 'Packet Flow',
        badgeKey: 'starters_badge_motion_packet',
        engineTag: 'Network · Lab',
        keywords: ['network', 'tcp', 'dns', 'tls', 'https', 'bgp', 'quic', 'packet', 'handshake'],
        description:
          'Flying inspectable network packets across Client/Resolver/CDN/Origin with Latency & Packet-Drop fault sliders',
        prompt:
          'Animate an end-to-end network swimlane & sequence flight where any flying packet can be paused to inspect frame headers, equipped with a Latency & Packet-Loss slider plus Retransmit animation for [Protocol Flow: e.g. HTTPS DNS + TCP + TLS 1.3 0-RTT, BGP Anycast Routing, WebSocket Upgrade, or OAuth2 PKCE Exchange] under [Condition: Healthy vs Packet Drop].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'K8s Autoscaling & Failover Sim',
        icon: '☸️',
        badge: 'Cloud Topology',
        badgeKey: 'starters_badge_motion_cloud',
        engineTag: 'K8s · Chaos',
        keywords: [
          'kubernetes',
          'k8s',
          'cloud',
          'autoscaling',
          'failover',
          'kafka',
          'load balancer',
          'sre',
        ],
        description:
          'Isometric node/pod cluster with load pulses and interactive "Spike Load / Kill Node" chaos engineering controls',
        prompt:
          'Create an isometric distributed cluster showing load-balancer traffic pulses, CPU/memory gauge bars, HPA pod scaling animations, and interactive "Spike Traffic" and "Kill Primary Node" chaos buttons for [Architecture: e.g. Kubernetes HPA Microservices, Kafka Partition Rebalance, or Multi-Region Database Failover] under [Traffic Target].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Kill-Chain vs Zero-Trust Defense',
        icon: '🛡️',
        badge: 'Cyber Defense',
        badgeKey: 'starters_badge_motion_cyber',
        engineTag: 'Red vs Blue',
        keywords: [
          'cybersecurity',
          'zero trust',
          'sqli',
          'phishing',
          'waf',
          'ddos',
          'mitre',
          'mfa',
        ],
        description:
          'Side-by-side Red-Team intrusion kill-chain neutralized by Blue-Team mTLS, WAF sanitization, and hardware MFA',
        prompt:
          'Contrast an attack kill-chain against hardened defense side-by-side: animate intrusion payloads meeting WAF sanitization, mTLS verification, micro-segmentation, and EDR containment shields with clear stage callouts for [Threat Scenario: e.g. Credential Phishing vs Hardware Passkey MFA, Volumetric DDoS Mitigation, or SQL Injection Parameterization].',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_earth_space',
    label: '🌌 Space, Earth & Sound',
    labelKey: 'starters_cat_motion_earth_space',
    group: 'stem_tech',
    modes: ['Motion'],
    starters: [
      {
        title: 'Orbital & Hohmann Transfer Sim',
        icon: '🛰️',
        badge: 'Orbital Sim',
        badgeKey: 'starters_badge_motion_orbital',
        engineTag: 'Three.js · Space',
        keywords: [
          'space',
          'orbit',
          'satellite',
          'hohmann',
          'isro',
          'chandrayaan',
          'mars',
          'gravity',
        ],
        description:
          '2D/3D planetary gravity well with Δv thruster burns, live apogee/perigee telemetry, and time-warp scrubber',
        prompt:
          'Verify orbital period and velocity parameters with scientific_physics_solver, then create a 3D/2D orbital mechanics simulator featuring delta-v burn ignition pulses, live apogee/perigee & velocity HUD, and a Time-Warp / Launch Window scrubber for [Mission: e.g. Earth-to-Mars Hohmann Transfer, Chandrayaan Trans-Lunar Injection, or JWST L2 Halo Orbit] highlighting [Maneuver Controls].',
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      },
      {
        title: 'Tectonics, Cyclones & Clean Grid',
        icon: '🌍',
        badge: 'Earth & Climate',
        badgeKey: 'starters_badge_motion_earth',
        engineTag: 'Earth · Sim',
        keywords: ['earth', 'tectonic', 'cyclone', 'climate', 'earthquake', 'weather', 'renewable'],
        description:
          'Geological crust subduction cutaway, cyclone Coriolis wind bands, or solar-wind-battery grid dispatch flow',
        prompt:
          'Construct an interactive Earth-science cross-section simulator with Time/Intensity sliders showing fault-line crust subduction stress, atmospheric Coriolis cyclone streamlines, or clean microgrid load balancing for [Earth System: e.g. Himalayan Tectonic Collision, Tropical Cyclone Eye & Storm Surge, or 24-Hour Solar-Wind-Battery Dispatch].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Standing Waves & Music Acoustics',
        icon: '🎵',
        badge: 'Sound & Music',
        badgeKey: 'starters_badge_motion_music',
        engineTag: 'Audio · FFT',
        keywords: [
          'music',
          'sound',
          'acoustics',
          'fft',
          'harmonics',
          'guitar',
          'chords',
          'frequency',
        ],
        description:
          'Vibrating string/pipe harmonics synced with FFT overtone meters, Circle-of-Fifths ring, and optional mute audio',
        prompt:
          'Build an acoustics & music visualizer combining vibrating standing-wave nodes, live FFT overtone bar charts, interactive Harmonic / Chord sliders, and an optional muted-by-default Web Audio playback toggle for [Acoustics Topic: e.g. Plucked Guitar Overtones & Timbre, Noise-Cancellation Phase Inversion, or Jazz ii-V-I Chord Voice Leading].',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_history_kids',
    label: '🏛️ History & Early Learning',
    labelKey: 'starters_cat_motion_history_kids',
    group: 'stem_tech',
    modes: ['Motion'],
    starters: [
      {
        title: 'Historical Atlas & Trade Timeline',
        icon: '🗺️',
        badge: 'History Map',
        badgeKey: 'starters_badge_motion_history',
        engineTag: 'Timeline · Map',
        keywords: [
          'history',
          'civilization',
          'atlas',
          'trade routes',
          'silk road',
          'indus',
          'timeline',
        ],
        description:
          'Interactive century-scrubber map tracing trade routes, empire boundaries, and era artifact discoveries',
        prompt:
          'Choreograph a stylized SVG/spatial map flyover paired with an interactive Century Scrubber slider animating maritime & overland trade routes, city beacons, and era artifact cards for [Historical Era or Topic: e.g. Indus Valley & Maritime Spice Trade, Golden Age Indian Mathematics, Silk Road Caravans, or Space Race Milestones].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Kids Fractions & Phonics Play',
        icon: '🧩',
        badge: 'Kids Playbook',
        badgeKey: 'starters_badge_motion_kids',
        engineTag: 'K-5 · Playful',
        keywords: ['kids', 'children', 'fractions', 'phonics', 'counting', 'school', 'math games'],
        description:
          'Oversized playful tactile counters, interactive fraction pizza slices, and bouncing frog number-line hops',
        prompt:
          'Create an oversized, joyful, child-friendly interactive learning playground with tactile click/step buttons, bouncy visual counters, colorful fraction pizza slices, and hopping number-line animations for [Concept & Age Group: e.g. Equivalent Fractions Age 8, Phonetic Blending Rhymes Age 6, or Place-Value Blocks Age 7].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Vedic Astronomy & Sundial Lab',
        icon: '🔭',
        badge: 'Cosmic Heritage',
        badgeKey: 'starters_badge_motion_cosmic',
        engineTag: 'Astronomy · 3D',
        keywords: [
          'jantar mantar',
          'sundial',
          'nakshatra',
          'astronomy',
          'ecliptic',
          'solstice',
          'aryabhata',
        ],
        description:
          'Jantar Mantar shadow-angle sundial and 27-Nakshatra lunar ecliptic wheel with Day-of-Year & Latitude sliders',
        prompt:
          'Animate celestial shadow angles across an interactive Samrat Yantra sundial and 27-Nakshatra ecliptic wheel with Day-of-Year and Latitude sliders for [Subject: e.g. Equinox & Solstice Shadow Geometry, Lunar Nakshatra Orbit Wheel, or Classical Indian Trigonometry & Sine Chords].',
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      },
    ],
  },
  {
    id: 'motion_executive',
    label: '📊 Executive & Metrics',
    labelKey: 'starters_cat_motion_executive',
    group: 'business_creative',
    modes: ['Motion'],
    starters: [
      {
        title: '3D Executive QBR & Revenue Deck',
        icon: '📊',
        badge: 'Executive',
        badgeKey: 'starters_badge_motion_executive',
        engineTag: '3D · KPI',
        featured: true,
        keywords: ['executive', 'qbr', 'revenue', 'boardroom', 'kpi', 'growth', 'metrics'],
        description:
          'Spatial 3D camera sweep across revenue charts, counting KPI tickers, and Base/Bull scenario toggles',
        prompt:
          'Generate an animated 3D executive report with 60fps camera pan, kinetic SVG charts, interactive hover tooltips, KPI counters, and a Scenario Toggle (Conservative / Base / Bull) for [Company Name & Quarter] highlighting [Key Metrics: Revenue, NRR & Growth Highlights].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Investor Pitch & Market Traction',
        icon: '🚀',
        badge: 'Investor Pitch',
        badgeKey: 'starters_badge_motion_pitch',
        engineTag: 'Spatial · Deck',
        keywords: ['investor', 'pitch', 'startup', 'tam', 'sam', 'ltv', 'traction', 'fundraising'],
        description:
          'High-energy 3D glass deck with concentric TAM/SAM/SOM rings, cohort retention curves, and unit economics',
        prompt:
          'Build a high-energy kinetic investor pitch presentation with 3D perspective depth, glowing glass cards, animated TAM/SAM/SOM rings, and unit economics counters for [Startup Name & Value Proposition] detailing [Traction Milestones & Capital Ask].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Strategic Milestone Roadmap',
        icon: '🗺️',
        badge: 'Milestone Roadmap',
        badgeKey: 'starters_badge_motion_roadmap',
        engineTag: 'Timeline · 3D',
        keywords: ['roadmap', 'strategy', 'milestones', 'q1', 'q4', 'deliverables', 'executive'],
        description:
          'Continuous forward 3D timeline track through phased deliverables, dependency connectors, and owner pills',
        prompt:
          'Design an immersive 3D timeline camera flight navigating through phased strategic milestones, team ownership pills, and dependency lines for [Initiative / Product Roadmap] spanning [Phase Windows: e.g. Q1–Q4 Launch Gates].',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_productivity',
    label: '💼 Professional & SOPs',
    labelKey: 'starters_cat_motion_productivity',
    group: 'business_creative',
    modes: ['Motion'],
    starters: [
      {
        title: 'Animated Workflow & SOP Replay',
        icon: '📋',
        badge: 'Workflow SOP',
        badgeKey: 'starters_badge_motion_sop',
        engineTag: 'Flow · Step',
        keywords: ['sop', 'workflow', 'onboarding', 'approval', 'process', 'sla', 'operations'],
        description:
          'Pulsing swimlane diagram guiding teams through handoffs, decision gates, SLAs, and Pause/Step controls',
        prompt:
          'Construct an interactive animated corporate SOP diagram with glowing node transitions, decision branches, SLA clocks, and Pause/Next-Gate stepping for [Business Process: e.g. Enterprise Client Onboarding, Change Advisory Review, or Procurement Sign-Off] detailing [Handoff Teams & SLAs].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'SaaS Unit Economics & Runway Lab',
        icon: '💹',
        badge: 'Financial Sim',
        badgeKey: 'starters_badge_motion_fincalc',
        engineTag: 'Live · Model',
        keywords: [
          'finance',
          'saas',
          'unit economics',
          'churn',
          'cac',
          'ltv',
          'arr',
          'pricing',
          'sensitivity',
        ],
        description:
          'Interactive Price, Churn %, and CAC sliders dynamically re-animating payback period & 36-month ARR runway',
        prompt:
          'Build an interactive business unit-economics simulator with live sliders for Monthly ARPA, Churn %, Gross Margin %, and CAC that recalculate and animate LTV:CAC ratio, CAC payback months, and a 36-month ARR sensitivity curve for [Business / Product Tier] modeling [Baseline & Expansion Assumptions].',
        mcpServers: ['satchida-motion', 'satchida-work-suite'],
      },
      {
        title: 'Incident Postmortem & SLA Replay',
        icon: '🚨',
        badge: 'Incident Replay',
        badgeKey: 'starters_badge_motion_postmortem',
        engineTag: 'Postmortem',
        keywords: [
          'incident',
          'postmortem',
          'outage',
          'sre',
          'sla',
          'rca',
          'latency',
          'mitigation',
        ],
        description:
          'Interactive timeline scrubber tracing Alert Trigger -> Blast Radius -> Mitigation -> Follow-up Actions',
        prompt:
          'Create an objective, blameless incident postmortem replay combining a synchronized latency graph, cascading service blast-radius map, interactive Phase Scrubber (Detection -> Triage -> Mitigation -> Resolution), and hardened action items for [Incident Summary & Impacted Services].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Sprint Velocity & Gantt Timeline',
        icon: '🏃',
        badge: 'Sprint & Gantt',
        badgeKey: 'starters_badge_motion_retro',
        engineTag: 'Agile · Gantt',
        keywords: ['sprint', 'agile', 'retrospective', 'gantt', 'burndown', 'velocity', 'pmo'],
        description:
          'Burndown velocity curve sweeps, critical-path Gantt dependencies, epic highlights, and team shoutouts',
        prompt:
          'Produce an upbeat sprint retrospective and critical-path Gantt timeline animation with burndown velocity curves, critical dependency highlights, and delivered feature cards for [Sprint or Program Name] covering [Dates, Velocity Stats & Key Deliverables].',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_kinetic',
    label: '⚡ Kinetic Typography',
    labelKey: 'starters_cat_motion_kinetic',
    group: 'business_creative',
    modes: ['Motion'],
    starters: [
      {
        title: 'Kinetic Typography Manifesto',
        icon: '⚡',
        badge: 'Kinetic Speech',
        badgeKey: 'starters_badge_motion_kinetic',
        engineTag: 'Kinetic · 60fps',
        keywords: ['kinetic', 'typography', 'speech', 'manifesto', 'keynote', 'quotes', 'text'],
        description:
          'High-impact rhythmic word staggers, spatial camera punch-ins, beat markers, and font-style switcher',
        prompt:
          'Create a dynamic kinetic typography motion graphic with staggered word choreography, bold camera push-throughs, visual beat markers, and a Typography Theme Switcher (Editorial Serif / Brutalist Mono / Broadcast Sans) for [Core Message / Keynote Quote] in [Mood & Color Palette].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Distributed Systems & API Flow',
        icon: '🧩',
        badge: 'Tech Explainer',
        badgeKey: 'starters_badge_motion_tech',
        engineTag: 'Arch · Spatial',
        keywords: [
          'architecture',
          'api',
          'microservices',
          'events',
          'pipeline',
          'kafka',
          'explainer',
        ],
        description:
          'Interactive 3D particle simulation tracing API gateways, async queues, caches, and failover flows',
        prompt:
          'Build an interactive 3D spatial explainer illustrating request routing, microservice handshakes, queue backpressure, and Healthy vs Latency-Spike toggles for [System Architecture / Pipeline Topic] covering [Key Services].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Book & Mental-Model Summary',
        icon: '📚',
        badge: 'Book Digest',
        badgeKey: 'starters_badge_motion_book',
        engineTag: 'Story · Morph',
        keywords: ['book', 'summary', 'framework', 'essay', 'mental models', 'venn', 'explainer'],
        description:
          'Chapter-by-chapter animated digest morphing mental models smoothly between Venn, matrix, and quote cards',
        prompt:
          'Transform a non-fiction book, whitepaper, or strategy thesis into a chapter-by-chapter kinetic visual summary where SVG frameworks morph cleanly between mental models and pull-quotes for [Book Title / Paper / Framework] emphasizing [3 Core Takeaways].',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_product',
    label: '✨ Product & SaaS Launch',
    labelKey: 'starters_cat_motion_product',
    group: 'business_creative',
    modes: ['Motion'],
    starters: [
      {
        title: 'Dark-Mode SaaS Hero Launch',
        icon: '💎',
        badge: 'SaaS Launch',
        badgeKey: 'starters_badge_motion_saas',
        engineTag: 'UI · Teaser',
        keywords: ['saas', 'launch', 'product', 'hero', 'glassmorphism', 'feature', 'landing'],
        description:
          'Floating glass UI cards, laser border beams, interactive feature-tab switcher, and capability spotlights',
        prompt:
          'Produce a 60fps dark-mode SaaS product launch teaser featuring glassmorphism, floating UI mockups, glowing beam highlights, and interactive feature tabs for [Product / Feature Name] showcasing [Top 3 Capabilities].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Live Animated Analytics Dashboard',
        icon: '📈',
        badge: 'KPI Analytics',
        badgeKey: 'starters_badge_motion_kpi',
        engineTag: 'Dashboard · SVG',
        keywords: [
          'analytics',
          'dashboard',
          'charts',
          'telemetry',
          'revenue',
          'ecommerce',
          'metrics',
        ],
        description:
          'Counting tickers, cubic-bezier SVG area sweeps, donut breakdowns, and 7D/30D/YTD time-range filters',
        prompt:
          'Construct an animated real-time analytics dashboard with rolling tickers, glowing SVG area graphs, donut chart sweeps, and interactive Time-Range filters (7D / 30D / YTD) for [Dashboard Domain: e.g. E-commerce Growth, Cloud FinOps, or Payment Gateway Volume].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: '3D Mobile App UX Showcase',
        icon: '📱',
        badge: 'Mobile UX',
        badgeKey: 'starters_badge_motion_mobile',
        engineTag: '3D · Mobile',
        keywords: ['mobile', 'app', 'iphone', 'android', 'ux', 'prototype', 'swipe', 'mockup'],
        description:
          'Angled 3D phone stage with choreographed gesture swipes, tap ripples, and Light/Dark UI theme preview',
        prompt:
          'Create an animated 3D mobile mockup showcase highlighting smooth screen transitions, tap ripple indicators, floating feature badges, and Light/Dark UI preview toggle for [App Name & Target Users] walking through [Core 3-Screen Flow].',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_creative',
    label: '🎨 Art, Cartoon & Sketch',
    labelKey: 'starters_cat_motion_creative',
    group: 'business_creative',
    modes: ['Motion'],
    starters: [
      {
        title: '2D Rigged Character Walk-Cycle',
        icon: '🎭',
        badge: 'Character Rig',
        badgeKey: 'starters_badge_motion_char_rig',
        engineTag: '2D Rig · SVG',
        keywords: [
          'character',
          'rig',
          'walk cycle',
          'cartoon',
          'animation',
          'expressions',
          'onion skin',
        ],
        description:
          'Articulated SVG character rig with Gait speed slider (Idle/Walk/Run), Emotion switcher, and Onion-Skinning',
        prompt:
          'Design an articulated multi-limb SVG character rig featuring squash-and-stretch physics, interactive Gait Speed slider (Idle / Walk / Run), Expression switcher buttons (Joy / Curious / Shock), and toggleable Onion-Skinning motion trails for [Character Concept: e.g. Explorer Astronaut, Friendly Bot Mascot, or Comic Hero] set against [Backdrop Style].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Pencil Sketch to Ink Line Reveal',
        icon: '✏️',
        badge: 'Sketch Draw',
        badgeKey: 'starters_badge_motion_sketch',
        engineTag: 'Stroke · SVG',
        keywords: ['sketch', 'drawing', 'pencil', 'ink', 'line art', 'illustration', 'artist'],
        description:
          'Hand-drafted construction guidelines progressively resolving via stroke-dasharray into inked & tinted illustration',
        prompt:
          'Animate a realistic artist drafting progression using staggered SVG stroke-dasharray underdrawing lines resolving into crisp ink cross-hatching and watercolor wash fills with Speed & Step-Replay scrubber for [Art Subject: e.g. Heritage Arch Monument, Botanical Lotus, or Vintage Watch Movement].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Cartoon Storyboard & Comic',
        icon: '🎨',
        badge: 'Cartoon Story',
        badgeKey: 'starters_badge_motion_cartoon',
        engineTag: 'Comic · Panels',
        keywords: ['comic', 'manga', 'storyboard', 'cartoon', 'speech bubbles', 'storytelling'],
        description:
          'Multi-panel manga/comic transitions with halftone shading, bouncing dialogue bubbles, and panel stepper',
        prompt:
          'Build an animated comic-book/cartoon storyboard sequence with camera panel punch-ins, kinetic speech bubbles, halftone shading, action bursts, and Next/Previous Panel buttons for [Story Premise: e.g. Cat Astronaut on Mars, Time-Traveling Inventor, or Classroom Mystery].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Sacred Geometry & Perspective',
        icon: '🌀',
        badge: 'Generative Art',
        badgeKey: 'starters_badge_motion_generative',
        engineTag: 'Parametric',
        keywords: [
          'geometry',
          'mandala',
          'perspective',
          'fibonacci',
          'kaleidoscope',
          'vanishing point',
        ],
        description:
          'Parametric mandalas or interactive 1-Point/2-Point vanishing perspective guide with symmetry & palette sliders',
        prompt:
          'Craft an interactive generative art or architectural drawing studio featuring kaleidoscopic symmetry OR 1-Point/2-Point Perspective vanishing-point guides with Symmetry Fold & Color Palette sliders for [Art Mode: e.g. Golden-Ratio Fibonacci Bloom, Sacred Mandala, or 2-Point Street Perspective Tutor].',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_media',
    label: '🎬 Teasers & Video Render',
    labelKey: 'starters_cat_motion_media',
    group: 'business_creative',
    modes: ['Motion'],
    starters: [
      {
        title: 'Brand Intro & 3D Logo Stinger',
        icon: '✨',
        badge: 'Brand Stinger',
        badgeKey: 'starters_badge_motion_stinger',
        engineTag: '5s Stinger',
        keywords: ['intro', 'logo', 'stinger', 'brand', 'youtube', 'opener', 'reveal'],
        description:
          'High-octane 5s 3D logo stinger with neon light trails, glass prism text, and deterministic MP4 timing',
        prompt:
          'Generate a sleek 5-second branded video intro stinger with neon particle sweep, 3D camera tilt, chromatic logo lockup, and clean MP4-ready window.__TIMELINE__ pacing for [Channel / Brand Name] featuring [Slogan & Accent Color].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Vertical 9:16 Kinetic Social Reel',
        icon: '📲',
        badge: 'Social Reel',
        badgeKey: 'starters_badge_motion_social',
        engineTag: '9:16 · Reel',
        keywords: ['shorts', 'reels', 'vertical', '9:16', 'instagram', 'youtube shorts', 'social'],
        description:
          'Mobile-first vertical 1080×1920 format with instant 1.5s hook typography, animated stat bar, and CTA',
        prompt:
          'Design an attention-grabbing 9:16 vertical motion graphic (1080x1920 composition) with instant hook typography, animated chart callout, readable timed captions, and bold CTA for [Topic / Hero Stat] aimed at [Target Audience].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Playwright 60fps MP4 Video Exporter',
        icon: '🎥',
        badge: 'MP4 Exporter',
        badgeKey: 'starters_badge_motion_mp4',
        engineTag: 'FFmpeg · MP4',
        keywords: ['mp4', 'export', 'video', 'render', 'ffmpeg', '60fps', 'playwright'],
        description:
          'Validate deterministic timeline + window.__SEEK_FRAME__ hooks and render H.264 60fps MP4 file',
        prompt:
          'Validate timeline determinism using validate_motion_html (fixing any unlinked animation loops via window.__SEEK_FRAME__ if needed) and call render_motion_to_video to export a crisp H.264 MP4 file for [Paste HTML code or describe scene, resolution 1280x720 or 1080x1920, duration & fps].',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_medical',
    label: '🫀 Medical & Clinical',
    labelKey: 'starters_cat_motion_medical',
    group: 'care_living',
    modes: ['Motion'],
    starters: [
      {
        title: 'Disease & Anatomical Progression',
        icon: '🫀',
        badge: 'Clinical Pathology',
        badgeKey: 'starters_badge_motion_pathology',
        engineTag: 'Bio · 3D',
        featured: true,
        keywords: [
          'medical',
          'doctor',
          'disease',
          'anatomy',
          'pathology',
          'diabetes',
          'heart',
          'asthma',
        ],
        description:
          'Anatomical cross-section comparing Healthy vs Progressive stages with interactive Stage Scrubber',
        prompt:
          'Simulate a clinical-grade anatomical cross-section with a Stage Progression scrubber (Healthy -> Early -> Moderate -> Severe) comparing normal vs affected organ perfusion/structure, plus an objective "Educational visualization — not medical advice" footer for [Medical Condition: e.g. Coronary Atherosclerosis, Type-2 Diabetes Insulin Resistance, or Asthmatic Airway Constriction].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'ECG, Lab Panel & Spirometry',
        icon: '🩺',
        badge: 'Lab & Vitals',
        badgeKey: 'starters_badge_motion_ecg',
        engineTag: 'ECG · Wave',
        keywords: [
          'ecg',
          'ekg',
          'spirometry',
          'hba1c',
          'vitals',
          'labs',
          'patient education',
          'doctor',
        ],
        description:
          'Side-by-side Normal vs Altered ECG/Spirometry/HbA1c waveform explorer with callout pins & BPM slider',
        prompt:
          'Build a patient-friendly diagnostic waveform explorer comparing Normal vs Altered traces side-by-side with clear anatomical callout pins, Heart-Rate/Severity slider, and educational disclaimer footer for [Diagnostic Visual: e.g. 12-Lead ECG P-QRS-T vs Atrial Fibrillation, Spirometry Healthy vs COPD Flow Loop, or HbA1c 90-Day Glucose Curve].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Drug Mechanism of Action (MoA)',
        icon: '💊',
        badge: 'Drug MoA',
        badgeKey: 'starters_badge_motion_moa',
        engineTag: 'Molecular',
        keywords: ['pharma', 'drug', 'moa', 'receptor', 'enzyme', 'glp1', 'clinical', 'doctor'],
        description:
          'Molecular 3D receptor-docking flight illustrating target enzyme binding and downstream therapeutic effect',
        prompt:
          'Build a 3D pharmacological mechanism-of-action animation showing therapeutic molecules docking with target cell receptors, modulating signaling pathways, and step-by-step Pause/Next captions (educational only) for [Drug Class / Molecule: e.g. GLP-1 Receptor Agonists, ACE Inhibitors, or SGLT2 Renal Transport Blockers].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Surgical, Inhaler & CPR Trainer',
        icon: '🏥',
        badge: 'Clinical Skills',
        badgeKey: 'starters_badge_motion_surgical',
        engineTag: 'Trainer · Step',
        keywords: [
          'surgery',
          'stent',
          'inhaler',
          'cpr',
          'epipen',
          'patient',
          'procedure',
          'first aid',
        ],
        description:
          'Step-by-step reassuring clinical procedure guide or timed Inhaler/CPR/Auto-Injector practice trainer',
        prompt:
          'Design a calm, clinical-grade procedural explainer or patient technique trainer (including timed countdown rings or 110 BPM compression metronome visual where applicable) with numbered Phase Tabs and safety footer for [Procedure or Skill: e.g. Metered-Dose Inhaler with Spacer Technique, Coronary Stent Angioplasty, Auto-Injector Epinephrine, or Hands-Only CPR].',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_wellness',
    label: '🥗 Fitness, Yoga & Diet',
    labelKey: 'starters_cat_motion_wellness',
    group: 'care_living',
    modes: ['Motion'],
    starters: [
      {
        title: 'Exercise Form & Joint Angle Lab',
        icon: '🏋️',
        badge: 'Exercise Form',
        badgeKey: 'starters_badge_motion_form',
        engineTag: 'Form · Lab',
        keywords: ['fitness', 'exercise', 'squat', 'deadlift', 'workout', 'form', 'posture', 'gym'],
        description:
          'Skeleton vector overlay showing prime-mover glow, safe joint angles, Ideal vs Common Mistake toggle & tempo slider',
        prompt:
          'Construct an interactive exercise biomechanics lab with an articulated skeleton overlay highlighting active prime-mover muscles, live knee/hip/spine joint-angle protractors, Common Mistake vs Ideal Form toggle, and Rep Tempo slider for [Exercise: e.g. Bodyweight / Barbell Squat, Romanian Deadlift Hinge, Scapular Push-Up, or Kettlebell Swing].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Yoga Asana Flow & Breath Pacer',
        icon: '🧘',
        badge: 'Yoga Alignment',
        badgeKey: 'starters_badge_motion_yoga',
        engineTag: 'Breath · Flow',
        keywords: [
          'yoga',
          'pranayama',
          'breathing',
          'asana',
          'surya namaskar',
          'flexibility',
          'meditation',
        ],
        description:
          'Expanding breath-pacer geometry (Inhale/Hold/Exhale) paired with calm spine alignment & safety contraindications',
        prompt:
          'Verify classical alignment & safety notes with yoga_asana_and_pranayama_guide, then create a soothing yoga & pranayama pacer with an expanding geometric breath ring (Inhale / Hold / Exhale counters), alignment vectors, and gentle contraindication flags for [Sequence / Goal: e.g. Surya Namaskar 12-Step Flow, Evening Spine Decompression, or Nadi Shodhana / 4-7-8 Breathwork].',
        mcpServers: ['satchida-motion', 'satchida-health-wellness'],
      },
      {
        title: 'Metabolic Calorie & Macro Plate',
        icon: '🥗',
        badge: 'Nutrition Lab',
        badgeKey: 'starters_badge_motion_nutrition',
        engineTag: 'Macros · Calc',
        keywords: [
          'diet',
          'nutrition',
          'calories',
          'macros',
          'protein',
          'weight loss',
          'tdee',
          'meal',
        ],
        description:
          'TDEE-backed interactive meal plate decomposing carbs, protein, fiber, and fats with live macro sliders',
        prompt:
          'Compute personalized TDEE and macro splits first using metabolic_nutrition_planner, then animate an interactive rotating meal plate where adjusting protein, complex carbs, fiber, and healthy fat portions updates real-time satiety & calorie bars for [Target Profile: e.g. 1800 kcal Fat-Loss Indian Veg Plate, 2500 kcal Muscle Recomposition, or High-Fiber PCOS Balance].',
        mcpServers: ['satchida-motion', 'satchida-health-wellness'],
      },
      {
        title: 'Desk Rehab & Meal Glycemic Curve',
        icon: '🩺',
        badge: 'Rehab & Glucose',
        badgeKey: 'starters_badge_motion_rehab',
        engineTag: 'Curve · Sim',
        keywords: [
          'glucose',
          'glycemic',
          'diabetes',
          'rehab',
          'neck pain',
          'back pain',
          'desk',
          'posture',
        ],
        description:
          '180-minute blood-glucose meal comparison curve OR cervical/lumbar desk mobility stretch routine timer',
        prompt:
          'Ground nutritional numbers via glycemic_and_calorie_lookup when diet applies, then build a clean comparison simulator showing EITHER a 180-minute Blood Glucose curve ([Meal A vs Meal B]) OR a Cervical/Lumbar Desk Posture Rehab sequence with muscle-release timers for [Focus: e.g. White Rice vs Millets + Dal Glucose Curve or 5-Minute Neck & Hip Flexor Desk Stretch].',
        mcpServers: ['satchida-motion', 'satchida-health-wellness'],
      },
    ],
  },
  {
    id: 'motion_home',
    label: '🏡 Home, Interior & Living',
    labelKey: 'starters_cat_motion_home',
    group: 'care_living',
    modes: ['Motion'],
    starters: [
      {
        title: 'Room Layout & Festive Makeover',
        icon: '✨',
        badge: 'Décor & Room',
        badgeKey: 'starters_badge_motion_decor',
        engineTag: 'Room · 2D/3D',
        featured: true,
        keywords: [
          'home',
          'interior',
          'decor',
          'room',
          'diwali',
          'furniture',
          'homemaker',
          'lighting',
        ],
        description:
          'Day-to-Festive Evening room styler with interactive wall/cushion color swatches and furniture clearance layout',
        prompt:
          'Design an interactive home interior layout & festive styling studio where users toggle Day vs Warm Evening lighting, swap wall/curtain color swatches, and preview sofa/table placements with walking-clearance dimensions for [Room & Occasion: e.g. 16x12ft Living Room Diwali Makeover, Cozy Study & Guest Room, or Balcony Tea Corner] in [Preferred Palette & Furniture List].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Weekly Family Meal & Pantry Plan',
        icon: '🍱',
        badge: 'Meal Rhythm',
        badgeKey: 'starters_badge_motion_meal',
        engineTag: 'Planner · SVG',
        keywords: ['meal plan', 'grocery', 'kitchen', 'tiffin', 'family', 'homemaker', 'recipes'],
        description:
          'Mon–Sun rotating meal matrix with smart leftover reuse, prep-batch timers, and clickable pantry checklist',
        prompt:
          'Create an animated Monday-to-Sunday family kitchen meal & grocery planner with rotating dish cards, Sunday Prep Batch timelines, and an interactive clickable pantry/veggie checklist for [Dietary Style & Family Size: e.g. 4-Person Indian Vegetarian Weeknight Plan, Kids Nutritious School Tiffins, or Diabetic-Friendly Household Menu].',
        mcpServers: ['satchida-motion', 'satchida-health-wellness'],
      },
      {
        title: 'Wardrobe & Kitchen Decluttering',
        icon: '🏡',
        badge: 'Home Organize',
        badgeKey: 'starters_badge_motion_organize',
        engineTag: 'Zones · Grid',
        keywords: ['wardrobe', 'declutter', 'pantry', 'kitchen', 'organize', 'storage', 'shelf'],
        description:
          'Before/After spatial drawer & shelf transformation slider zoning Daily Reach, Weekly, and Seasonal bins',
        prompt:
          'Animate a satisfying Before-vs-After spatial storage organization blueprint dividing shelves and drawers into Daily Reach, Weekly, and Seasonal zones with modular bin footprints for [Space: e.g. Modular Kitchen Spice & Pantry Drawers, Capsule Master Wardrobe, or Compact Craft Corner].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Balcony Garden & Home Budget',
        icon: '🪴',
        badge: 'Home Garden',
        badgeKey: 'starters_badge_motion_garden',
        engineTag: 'Seasonal · Sim',
        keywords: ['garden', 'balcony', 'plants', 'herbs', 'budget', 'household', 'homemaker'],
        description:
          'Sun-exposure companion-planting balcony grid by season OR visual Monthly Household Envelope Budget flow',
        prompt:
          'Build an animated seasonal planner showing sun-angle exposure, companion-plant pot spacing grids (mint, tomato, basil, marigold), and a Season Switcher (Summer / Monsoon / Winter) OR a Monthly Household Envelope Budget flow for [Space or Goal: e.g. West-Facing 8x4ft Herb Balcony Garden or Family Monthly Groceries, Gold & School Savings Flow].',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
  {
    id: 'motion_elderly',
    label: '👵 Golden Years & Living',
    labelKey: 'starters_cat_motion_elderly',
    group: 'care_living',
    modes: ['Motion'],
    starters: [
      {
        title: 'Large-Print Medicine & Water',
        icon: '💊',
        badge: 'Senior Routine',
        badgeKey: 'starters_badge_motion_elderly',
        engineTag: 'AAA · Large',
        keywords: ['senior', 'elderly', 'medicine', 'pills', 'hydration', 'routine', 'accessible'],
        description:
          'Soothing >= 20px WCAG AAA high-contrast Morning-to-Night pillbox guide with calm 0.65x pacing & giant buttons',
        prompt:
          'Build a gentle, ultra-clear Daily Medicine & Wellness Schedule strictly enforcing large >= 20px body typography, high WCAG AAA contrast (dark navy on warm cream or crisp white on deep slate), slow 0.65x speed, Morning/Afternoon/Night pillbox visuals, water check buttons, and giant Play/Pause controls for [Medication & Routine: e.g. Morning BP & Sugar Tablets Before Breakfast, Evening Walk & Calcium].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Smartphone & UPI Safety Tutor',
        icon: '📱',
        badge: 'Phone & UPI Tutor',
        badgeKey: 'starters_badge_motion_pension',
        engineTag: 'AAA · Practice',
        keywords: [
          'upi',
          'senior',
          'smartphone',
          'pension',
          'jeevan pramaan',
          'bill',
          'whatsapp',
          'tutorial',
        ],
        description:
          'Magnified interactive phone mockup with numbered glowing tap circles, >= 20px text & Next/Repeat buttons',
        prompt:
          'Create a reassuring, magnified smartphone practice simulator strictly using >= 20px jargon-free captions, numbered glowing tap rings, slow 0.6x pacing, and giant Next Step / Repeat buttons illustrating safely step by step how to complete [Digital Task: e.g. Scanning a Shopkeeper UPI QR Code, Jeevan Pramaan Life Certificate, or Family Video Call].',
        mcpServers: ['satchida-motion'],
      },
      {
        title: 'Chair Physio & Joint Mobility',
        icon: '🪑',
        badge: 'Senior Mobility',
        badgeKey: 'starters_badge_motion_mobility',
        engineTag: 'AAA · 0.6x Calm',
        keywords: [
          'senior',
          'physiotherapy',
          'chair yoga',
          'arthritis',
          'knee',
          'balance',
          'elderly',
        ],
        description:
          'Calm seated mobility guide with >= 20px instructions, 0.6x slow repetition counter, and Anytime Rest button',
        prompt:
          'Build a calm, seated senior physiotherapy & joint-mobility guide strictly enforcing >= 20px captions, soft WCAG AAA contrast, slow 0.6x repetition pacing, ankle/knee/shoulder range highlights, and an anytime Rest/Pause button for [Mobility Focus: e.g. Morning Knee & Ankle Chair Warmup, Gentle Neck & Shoulder Relief, or Deep Calm Breathing].',
        mcpServers: ['satchida-motion', 'satchida-health-wellness'],
      },
      {
        title: 'Elder Fraud & OTP Scam Shield',
        icon: '🛡️',
        badge: 'Safety Alert',
        badgeKey: 'starters_badge_motion_fraud',
        engineTag: 'AAA · Safety',
        keywords: ['scam', 'fraud', 'otp', 'senior', 'safety', 'cyber', 'digital arrest', 'bank'],
        description:
          'High-contrast >= 20px Red-Flag Trap vs Safe Golden Rule cards guarding elders against OTP & impersonation scams',
        prompt:
          'Create an unmistakable, calm high-contrast Scam Shield guide enforcing >= 20px typography and WCAG AAA >= 7:1 contrast comparing Dangerous Caller Traps side-by-side against Safe Golden Rules ("Never share OTP, PIN, or install screen-sharing apps") with numbered hang-up checklist steps for [Scam Scenario: e.g. Fake Bank KYC / Electricity Disconnection SMS, Fake Digital Arrest Video Call, or Parcel OTP Trap].',
        mcpServers: ['satchida-motion'],
      },
    ],
  },
];
