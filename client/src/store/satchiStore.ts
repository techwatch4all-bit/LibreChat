import { createStorageAtom } from '~/store/jotai-utils';

export type SatchiStyle = 'direct' | 'plan' | 'build';
export type SatchiMode = 'Chat' | 'Work' | 'VibeCoder' | 'Study' | 'Privacy';
export type SatchiThinkLevel = 'off' | 'medium' | 'high';

export const satchiStyleAtom = createStorageAtom<SatchiStyle>('satchida_style', 'direct');
export const satchiModeAtom = createStorageAtom<SatchiMode>('satchida_mode', 'Chat');
export const satchiWebSearchAtom = createStorageAtom<boolean>('satchida_websearch', false);
export const satchiThinkAtom = createStorageAtom<SatchiThinkLevel>('satchida_think', 'off');
export const satchiResearchAtom = createStorageAtom<boolean>('satchida_research', false);
export const satchiImageGenAtom = createStorageAtom<boolean>('satchida_imagegen', false);

export const STYLE_PROMPTS: Record<SatchiStyle, string> = {
  direct: '',
  plan: 'Please think step-by-step and produce a clear, actionable plan before taking any action. Detail each phase, required resources, and dependencies, and pause for approval before executing.',
  build: 'Please execute now and produce the complete, production-ready deliverable with full implementation details.',
};

/**
 * Heuristic contextual prompt enhancer that expands drafts into expert instructions.
 * Ported from Satchida Unified Suite reference implementation.
 */
export function heuristicEnhance(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return 'Provide an executive briefing on today\'s top priorities, actionable milestones, and strategic recommendations.';
  }
  const lower = trimmed.toLowerCase();

  // 1. SHTF / OSINT / Disaster / Crisis Dossier
  if (/shtf|situational awareness|crisis operations|disaster.*bulletin|natural threat/i.test(lower)) {
    return `Provide an exhaustive, real-time SHTF / OSINT Situational Awareness Dossier for India (National, Metros & Sensitive Frontier States) covering today's latest ground reality across all 6 critical survival domains:

1. 🌊 Severe Weather, Hydrology & Natural Disasters:
   - IMD active weather tracks, red/orange alerts, flash floods, and river danger levels (CWC telemetry).
   - Himalayan landslides, highway blockades (Uttarakhand, Himachal, J&K), and USGS M4.5+ seismic events.

2. ⚡ Grid, Power & Energy Security:
   - National grid frequency stability, state-level power cuts/blackouts, and thermal coal stock reserves.
   - Retail fuel supply status (Petrol E20, XP95, Diesel) and Domestic 14.2kg / Commercial 19kg LPG cylinder availability.

3. 🛡️ Civil Unrest, Public Order & Security Zones:
   - Active farmer agitations, union strikes, CJP/political protests, section 144 curfews, and police mobilizations.
   - Regional transit ultimatums, city-wide bandhs, and transport strike advisories.

4. 🌾 Food Supply, Mandis & Potable Water:
   - APMC mandi grain arrivals (wheat, rice, pulses, edible oil), supply chain bottlenecks, and wholesale price shocks.
   - Municipal potable water supply status and emergency water tanker operations.

5. 🩺 Mass Sickness, Epidemics & Biological Alerts:
   - ICMR/NCDC disease outbreak warnings (Swine Flu H1N1/H3N2, Nipah, Dengue spikes, unknown fevers).
   - Mass casualties, industrial disasters, chemical/gas leaks, and emergency hospital triage directives.

6. ⚔️ Strategic Border Security & Geopolitical Flashpoints:
   - Eastern Ladakh LAC, Arunachal Pradesh border incursions, military transport flights (China/Turkey/Pakistan), and counter-drone defense.

Output Requirements:
- Structure with clear ### domain headers, timestamps, and clickable source citations [Publisher Name](URL).
- Include an executive Risk Heatmap Table (Domain | Threat Level: CRIT/HIGH/MED | Active Region | Immediate Action).
- Provide actionable off-grid emergency survival recommendations for affected civilians.`;
  }

  // 2. RBI / Banking / Master Directions / Consumer Loan Impact
  if (/rbi|banking|repo rate|master direction|mclr|lending|nbfc|cbdc/i.test(lower)) {
    return `Perform a comprehensive, real-time regulatory compliance and citizen financial impact audit on RBI policy directives and banking operations:

1. 🏦 Monetary Policy & Consumer Loan Impact:
   - Latest RBI MPC decisions on Repo Rate, SDF, and MSF.
   - Direct impact on floating home loan/auto loan EMIs, 1-year MCLR benchmarks, and Fixed Deposit (FD) rates across SBI, HDFC, ICICI, and PNB.

2. 💳 Digital Payments, UPI & Banking Charges:
   - Official RBI limits on UPI transactions (P2P/P2M limits, auto-debit mandates) and interchange fee guidelines.
   - Free monthly ATM withdrawal rules, financial/non-financial ATM fees, and minimum balance non-maintenance penalty rules.

3. 🪙 Digital Rupee (CBDC), Currency Notes & SGBs:
   - Retail Digital Rupee (e-Rupee) wallet pilot regulations and merchant adoption guidelines.
   - Official RBI rules for exchanging soiled/mutilated currency notes and ₹2000 note withdrawal protocols.
   - Sovereign Gold Bond (SGB) premature encashment rates, final redemption price calculation, and gold loan 75% LTV caps.

4. 📋 Statutory Compliance & Regulatory Framework:
   - Clause-by-clause statutory analysis citing exact RBI Master Direction circular numbers, section references, and non-compliance penalty provisions.

Output Requirements:
- Deliver structured comparison tables, exact circular references, and verified RBI portal citations.`;
  }

  // 3. Supreme Court & Gazette Legal Counsel
  if (/supreme court|judiciary|gazette|legal|bns|bnss|dpdp/i.test(lower)) {
    return `Provide an exhaustive legal intelligence briefing on the latest landmark Supreme Court rulings, High Court orders, Gazette of India notifications, and central ministry directives impacting citizen rights and institutional governance:

1. 🏛️ Supreme Court Landmark Judgments:
   - Recent constitutional bench rulings, review petitions, and significant practice directions affecting citizen rights and public interest.

2. 🎓 Education Directives & Admission Mandates:
   - Judicial orders on private school fee hikes, state fee regulatory committees, quota/reservation implementation, and NEET UG/PG admission norms.

3. 🩺 Healthcare Directives & Hospital Price Caps:
   - Enforcement of Article 21 Right to Health, mandatory emergency hospital admissions, capping of ICU/hospital procedure charges, and medical negligence precedents.

4. 📜 Gazette Notifications, DPDP Act & Criminal Laws:
   - Official central notifications in The Gazette of India, rules notified under the Digital Personal Data Protection (DPDP) Act, and procedural enforcement under Bharatiya Nyaya Sanhita (BNS/BNSS/BSA).

Output Requirements:
- Provide statutory case citations (e.g. AIR/SCC references), Gazette notification numbers, and hyperlinked official portal sources.`;
  }

  // 4. Frontier AI & Local SLMs
  if (/frontier ai|local.*llm|slm|gguf|ollama|gpu|vram|llama\.cpp/i.test(lower)) {
    return `Provide a comprehensive technical analysis and architectural guide for Frontier AI models, open-weight LLMs, and local on-device Small Language Models (SLMs):

1. 💻 Top Open-Weight Local LLMs & SLMs for Consumer Hardware:
   - Compare the latest open-weight architectures (DeepSeek-R1/V3 distilled, Qwen 2.5/3 7B/14B/32B, Phi-4, Llama 3.3, Mistral NeMo) for 100% private, sovereign execution.
   - Evaluate GGUF/EXL2 quantization efficiency (Q4_K_M vs Q8_0) and compute overhead.

2. 🖥️ PC Hardware Sizing & GPU VRAM Matrix:
   - Exact VRAM allocations required across 8B, 14B, 32B, and 70B parameter models for offloaded layers.
   - NVIDIA RTX 50/40 series GPU bandwidth, Apple Silicon unified memory configurations, and Llama.cpp / vLLM / Ollama CUDA acceleration parameters.

3. 🤖 Frontier AI Research Breakthroughs & Benchmarks:
   - Latest release news and benchmark metrics across reasoning, coding, math, and context window capabilities.

Output Requirements:
- Include a VRAM & Model Quantization Sizing Table (Model | Quant Level | Context Length | Min VRAM | Tokens/sec Target).`;
  }

  // 5. Precious Metals, Markets & Crypto Volatility
  if (/gold|silver|sona|chandi|bullion|nifty|sensex|crypto|bitcoin|fear.*greed/i.test(lower)) {
    return `Provide a comprehensive real-time financial market, precious metals, and crypto risk intelligence dossier:

1. 🌟 Live Bullion Spot & Retail Price Breakdown:
   - Gold Spot (XAU/USD in $/oz and $/g) and Silver Spot (XAG/USD in $/oz and $/g).
   - India Landed Retail Rates: 24K Pure Gold, 22K Hallmark (916), 18K Jewellery Gold per gram & 10g, and 999/925 Silver per kg across Mumbai, Delhi, Kolkata, and Chennai.
   - Jeweller purchase schemes, making charge offers, and GST/duty breakdown.

2. 🚨 Market Volatility & Sentiment Gauge:
   - India VIX volatility gauge, Nifty 50 and Sensex key support/resistance levels, and FII/DII institutional net flows.
   - Macroeconomic risk factors: crude oil (Brent), USD/INR exchange rate, and US Fed/RBI rate expectations.

3. 🪙 Crypto Ecosystem Sentiment & Liquidation Risks:
   - Bitcoin (BTC), Ethereum (ETH), and Solana (SOL) live price action and 24h range.
   - Crypto Fear & Greed Index score and sentiment classification.
   - Major leverage liquidation risk clusters, exchange open interest, and ETF inflow/outflow metrics.

Output Requirements:
- Format with structured data tables, verified exchange telemetry, and clickable primary source links.`;
  }

  // 6. Fuel, Petrol, Diesel & LPG Gas
  if (/fuel|petrol|diesel|lpg|gas cylinder/i.test(lower)) {
    return 'What are the current official retail prices of Petrol (E20), XP95, Diesel, and Domestic 14.2kg / Commercial 19kg LPG cylinders across Delhi, Mumbai, Kolkata, Lucknow, and Patna today? Detail recent price revisions and state VAT differences.';
  }

  // 7. Earth, Climate, Marine & Geological Science
  if (/sea level|ocean|marine|climate|geolog|earthquake|volcano|rebound|glacier|coastal/i.test(lower)) {
    return `Conduct a comprehensive, data-backed scientific and geopolitical investigation into the following question:
"${trimmed}"

Structure your response with:
1. 🌍 Geographic Breakdown: Exact countries, coastlines, and tectonic basins affected.
2. 📏 Quantitative Measurements & Rate: Empirical measurements (mm/year, meters total) and timeline (since which epoch/year).
3. 🔬 Underlying Geophysical & Climate Mechanisms: Post-glacial isostatic rebound, tectonic uplift, groundwater extraction, or local oceanographic currents.
4. ⚠️ Hazard & Risk Assessment: What geophysical risks (tsunami vulnerability, seismic fault loading, maritime navigation hazards, ecological disruption) this signifies.
5. 📚 Scientific Sources & Citations: Reference empirical monitoring bodies (NOAA, PSMSL, Copernicus, USGS).`;
  }

  // 8. General Structured Multi-point Prompts
  if (trimmed.length > 60 || trimmed.includes('\n') || trimmed.includes('1.')) {
    const refined = trimmed
      .replace(/\[Country\/State\]/gi, 'India (National, Metros & Sensitive Frontier States)')
      .replace(/\[Region[^\]]*\]/gi, 'India & Neighboring Geopolitical Theaters')
      .replace(/\[State\/City\]/gi, 'Major Indian Metros (Delhi, Mumbai, Kolkata, Bengaluru)')
      .replace(/\[Industry \/ Entity\]/gi, 'Indian Banking & Fintech Infrastructure')
      .replace(/\[NBFC Layer\]/gi, 'Middle/Upper Layer NBFCs')
      .replace(/\[Specific Banking Operation\]/gi, 'Digital Lending and Cloud Outsourcing Operations')
      .replace(/\[Specific Legal Matter\]/gi, 'Cognizable Offenses and Electronic Evidence Admissibility')
      .replace(/\[Specific Domain\]/gi, 'Cloud Infrastructure and Identity Access Management')
      .replace(/\[Frontline City\/District\]/gi, 'Eastern Ladakh LAC & Frontier Border Districts');

    return `${refined}\n\nDeliver an exhaustive, structured intelligence report with verified facts, tabular comparisons, exact statutory/agency citations, and actionable strategic takeaways.`;
  }

  // General short prompt enhancement
  return `Analyze the following topic in depth with verified facts, structured domain breakdowns, actionable takeaways, and clickable source citations:\n"${trimmed}"\n\nEnsure comprehensive coverage of background context, direct citizen impact, key metrics, and strategic recommendations.`;
}

/**
 * Interactive Study templates for active recall, comprehension tests, and STEM diagrams.
 */
export function generateStudyQuizPrompt(subjectOrTopic: string): string {
  const topic = subjectOrTopic.trim() || 'the current subject';
  return `Create a high-yield, interactive 5-question Socratic Comprehension Quiz on:
"${topic}"

Format Requirements:
- Mix of Conceptual Deduction, Application Scenario, and Common Pitfall questions.
- For each question:
  1. State the Question clearly.
  2. Provide 4 Multiple-Choice Options (A, B, C, D).
  3. Wrap the Correct Answer and Detailed Conceptual Explanation in a collapsed Markdown block (<details><summary>Reveal Answer & Derivation</summary>...</details>) so I can test myself first!
  4. Include a Socratic "Follow-up Challenge" to test deeper intuition.`;
}

export function generateStudyFlashcardPrompt(subjectOrTopic: string): string {
  const topic = subjectOrTopic.trim() || 'the current chapter';
  return `Generate a set of 8 active-recall spaced repetition Flashcards for mastering:
"${topic}"

Format Requirements:
- Format as a Markdown Table with columns: [Card # | Front (Core Principle / Formula / Key Term) | Back (Intuition, Mechanism & Real-World Example)].
- If formulas or scientific laws are involved, format them strictly in KaTeX ($...$ or $$...$$).
- Keep the Front concise and probing; keep the Back high-density, memorable, and rooted in the Feynman Technique.`;
}

export function generateMermaidDiagramPrompt(concept: string): string {
  const target = concept.trim() || 'System Architecture / Concept Flow';
  return `Visualize the conceptual structure, lifecycle, and dependencies of:
"${target}"

Format Requirements:
- Render a complete, syntactically valid Mermaid Diagram code block (\`\`\`mermaid) using either graph TD, flowchart LR, or stateDiagram-v2.
- Ensure all nodes have descriptive, readable labels.
- Follow immediately with a bulleted architectural walk-through explaining each transition and critical node.`;
}

export function generatePdfChapterPrompt(details: string): string {
  const spec = details.trim() || 'this chapter / document';
  return `Analyze and extract core learning takeaways strictly from:
"${spec}"

Execution Steps:
1. Ground your answers strictly in the attached document text and requested page/chapter scope.
2. Outline the 3 foundational theorems or principles established in this section.
3. List all formulas, mathematical definitions, and technical rules introduced.
4. Formulate 3 practice exam questions testing mastery of this exact material.`;
}

export function generateVibeCodingPrompt(requirement: string): string {
  const req = requirement.trim() || 'full-stack enterprise feature';
  return `You are an elite Staff Software Architect & Full-Stack Vibe-Coding Engineer.
Execute a production-grade implementation for:
"${req}"

Engineering Directives:
1. Architectural Blueprint: File tree, data model schema, and API contracts.
2. Production Code: Full executable files with complete error handling, edge cases, and strict TypeScript types (no placeholders, no ellipses, no // TODO).
3. Verification: Edge case unit tests and step-by-step instructions for running/verifying locally.`;
}

export function generateMathRibbonPrompt(problemOrTopic: string): string {
  const topic = problemOrTopic.trim() || 'mathematical or physics problem';
  return `Provide a rigorous analytical solution with step-by-step derivation for:
"${topic}"

Mathematical Formatting Rules:
1. Format all inline mathematical symbols and variables using KaTeX $...$.
2. Format all major equations, derivations, and final proofs in display blocks $$...$$.
3. Define all variables and physical units (SI standard).
4. Provide an intuitive physical/geometric interpretation of the final result.`;
}

