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
  build:
    'Please execute now and produce the complete, production-ready deliverable with full implementation details.',
};

/**
 * Sovereign HyperResearch 6-Phase Protocol injected when Deep Research is activated.
 */
export const HYPERRESEARCH_PROMPT_PREFIX = `[SOVEREIGN HYPERRESEARCH DIRECTIVE ACTIVE]
You MUST execute the full 6-phase HyperResearch protocol for this inquiry:
Phase 1: Atomic Query Decomposition into 5–8 falsifiable sub-questions.
Phase 2: Multi-Tier Parallel Sweeps across primary government/official records, academic citation graphs, and empirical benchmarks.
Phase 3: Construct a dedicated Markdown "⚔️ Cross-Domain Contradiction & Correlation Matrix" comparing consensus claims vs. dissenting/field evidence with root cause analysis.
Phase 4: Explicitly identify Unresolved Empirical Gaps, omitted parameters, and retracted literature.
Phase 5: 4-Critic Adversarial Audit (Dialectic, Depth, Width, Instruction/Citation rigor).
Phase 6: MANDATORY DOSSIER FILE GENERATION: At the conclusion of your research, you MUST call create_formatted_document(filename="[Topic_Slug]_HyperResearch_Dossier.pdf", content=full_report_content, doc_type="pdf") and output the direct 1-click download link: "[📥 Download Full Research Dossier (.PDF)](/generated/[Filename].pdf)". Never say you cannot generate files.`;

/**
 * Gold-standard contextual prompt enhancer.
 * Applies the industry-standard RSCIT framework (Role, Situation, Constraints, Instructions, Template)
 * along with Chain-of-Thought (CoT), few-shot guidance, and domain heuristics to turn brief, vague,
 * or raw user queries into comprehensive, executive-grade prompts.
 */
export function heuristicEnhance(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return `### 🎯 Objective & Strategic Directive
Provide an exhaustive, executive-level intelligence briefing on today's highest-priority developments, emerging risks, and actionable milestones.

### 📐 Execution Framework (RSCIT Standard)
1. **Role & Perspective**: Senior Strategic Intelligence Officer & Sovereign AI Advisor.
2. **Situation Context**: Real-time cross-domain horizon scanning across technology, markets, policy, and national infrastructure.
3. **Core Tasks**:
   - Deconstruct critical breakthroughs and emerging threats from first principles.
   - Contrast status-quo consensus against empirical dissenting signals.
   - Synthesize quantitative performance metrics, unit economics, and operational run-rates.
4. **Output Architecture**:
   - **Executive Takeaways**: 3–5 bulleted high-signal directives.
   - **Empirical Matrix**: Markdown comparison table with verified metrics.
   - **Risk & Failure Modes**: Edge-case vulnerabilities, regulatory compliance barriers, and mitigation playbooks.
   - **Actionable Roadmap**: Phased milestones (Immediate, Mid-Term, Long-Term).
   - **Verified Citations**: Clickable primary source links [Source Name](URL) with timestamps.`;
  }

  const lower = trimmed.toLowerCase();

  // 1. Coding, Software Architecture & Debugging
  if (
    /code|bug|function|react|typescript|python|api|sql|database|docker|backend|frontend|architect|class|interface|refactor|optimize/i.test(
      lower,
    )
  ) {
    return `### 🧑‍💻 Persona & Engineering Role
You are a Principal Staff Software Architect and Security Auditor specializing in robust, production-grade systems engineering.

### 🎯 Task & Scope
Implement an exhaustive, production-ready solution for the following requirement:
> "${trimmed}"

### 🛡️ Non-Functional Requirements & Constraints
1. **Language & Standards**: Idiomatic, modern TypeScript / Python with strict static types, zero \`any\`, and exhaustive error handling.
2. **Defensive Architecture**: Protect against race conditions, memory leaks, unhandled async rejection, and boundary exceptions.
3. **Performance & Scalability**: Detail computational complexity (Time & Space in Big-O notation), database query plan impact (indexes/locks), and memory footprint.
4. **Zero Pseudo-Code Directive**: Provide complete, copy-paste runnable implementation files with no truncated lines, no \`// TODO\`, and no placeholder ellipses.

### 📋 Deliverable Structure
1. **Architectural Blueprint & Data Flow**: Concise summary of design decisions, component contracts, and Mermaid sequence/architecture diagram (\`\`\`mermaid).
2. **Complete Source Code**: Fully documented, modular, and typed production code.
3. **Verification & Edge-Case Unit Tests**: Jest/PyTest test suites covering happy paths, boundary failures, and invalid payloads.
4. **Deployment & Operational Verification**: Step-by-step local execution commands and verification checklist.`;
  }

  // 2. SHTF / OSINT / Disaster / Crisis Operations
  if (
    /shtf|situational awareness|crisis operations|disaster.*bulletin|natural threat/i.test(lower)
  ) {
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

  // 3. RBI / Banking / Financial Policy / Consumer Loans
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

  // 4. Supreme Court & Gazette Legal Counsel
  if (/supreme court|judiciary|gazette|legal|law|bns|bnss|dpdp|statute|contract/i.test(lower)) {
    return `Provide an exhaustive legal intelligence briefing on the latest landmark Supreme Court rulings, High Court orders, Gazette of India notifications, and central ministry directives:

Subject Inquiry:
> "${trimmed}"

1. 🏛️ Jurisprudential & Statutory Grounding:
   - Applicable constitutional provisions, statutory acts (including BNS, BNSS, BSA, DPDP), and authoritative judicial precedents (AIR/SCC citations).

2. ⚖️ Core Legal Issues & Divergent Interpretations:
   - Structured analysis of legal rights, statutory obligations, procedural mandates, and judicial tests established by the courts.

3. 💼 Practical Institutional & Citizen Impact:
   - Direct compliance burdens, contractual risk exposures, and evidentiary admissibility standards.

4. 🛡️ Risk Mitigation & Strategic Counsel:
   - Actionable legal safeguards, statutory filing procedures, and protective notices.

Output Requirements:
- Formal, precise legal terminology with full section references and hyperlinked official portal citations. Include standard non-advocate legal informational disclaimer.`;
  }

  // 5. Frontier AI & Local SLMs
  if (/frontier ai|local.*llm|slm|gguf|ollama|gpu|vram|llama\.cpp|quantiz/i.test(lower)) {
    return `Provide a comprehensive technical analysis and architectural guide for Frontier AI models, open-weight LLMs, and local on-device Small Language Models (SLMs):

Target Scope:
> "${trimmed}"

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

  // 6. Precious Metals, Markets & Crypto Volatility
  if (/gold|silver|sona|chandi|bullion|nifty|sensex|crypto|bitcoin|fear.*greed/i.test(lower)) {
    return `Provide a comprehensive real-time financial market, precious metals, and crypto risk intelligence dossier:

Inquiry Focus:
> "${trimmed}"

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

  // 7. Medical, Health, Pharmacology & Skincare
  if (
    /health|medicine|drug|treatment|symptom|skincare|disease|clinical|therapy|dose|niacinamide|kojic/i.test(
      lower,
    )
  ) {
    return `### 🩺 Clinical Intelligence & Evidence-Based Synthesis Protocol

Investigative Subject:
> "${trimmed}"

### 🔬 Multi-Dimensional Medical & Biochemical Framework
1. **Biochemical Mechanism of Action**: Exact molecular pathways, cellular receptors, enzymes inhibited/activated, and pharmacokinetics/absorption mechanics.
2. **Clinical Evidence & Peer-Reviewed Efficacy**: Published clinical trial outcomes, randomized controlled trials (RCTs), meta-analyses, and standard effective therapeutic concentration/dosage ranges.
3. **Safety Profile & Adverse Interaction Matrix**:
   - Contraindications, synergistic combinations, and antagonistic pairings.
   - High-friction/sensitive zone application rules and photosensitivity warnings.
4. **Commercial Market Formulations (With Clickable Links)**:
   - 3–4 verified commercially available products in India/Global markets with exact active concentrations and pricing.
   - Illustrative merchant search links: \`[Brand - Product Name](https://www.amazon.in/s?k=Brand+Product+Name)\`.
   - Mandatory commercial independence disclaimer.
5. **Standard Medical Disclaimer**: Mandatory disclaimer callout block stating information is for educational purposes and advising consultation with a board-certified specialist.
6. **Suggested Next Questions**: End with '### 🔄 Suggested Next Questions' containing 3–4 concrete, numbered follow-up questions ready for 1-click execution.`;
  }

  // 8. General Complex Inquiries (RSCIT Full Expansion)
  return `### 🎯 Strategic Context & Objective
Deconstruct and thoroughly analyze the following topic from first principles:
> "${trimmed}"

### 🧠 Analytical Directives (RSCIT Standard)
1. **Multi-Pillar Deconstruction**:
   - **Theoretical Foundation**: Core mechanisms, historical context, and fundamental governing principles.
   - **Empirical Reality & Metrics**: Real-world quantitative data, measured performance, benchmarks, and commercial economics.
   - **Contradiction & Trade-Off Matrix**: Compare competing viewpoints, conflicting claims, and hidden trade-offs in a structured Markdown table.
   - **Edge Cases & Failure Modes**: Vulnerabilities, security risks, common misconceptions, and mitigation strategies.
2. **Quality & Citation Floor**:
   - Base all volatile claims strictly on primary, verified sources.
   - Format all references as clickable Markdown links [Publisher / Document](URL).
3. **Actionable Deliverables**:
   - Executive Summary with bolded high-signal takeaways.
   - Concrete, step-by-step implementation or decision roadmap.
   - 3–4 Standalone follow-up questions tailored to this analysis.`;
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
  3. Put the Correct Answer and its Detailed Conceptual Explanation in a reveal block built from Markdown only — never raw HTML or a collapsible details/summary element, which renders as literal text. Use exactly this shape:
     > **✅ Answer: [letter] — [option text]**
     >
     > **Why it holds:** [one-line mechanism]
     >
     > **Derivation:** [2–4 numbered steps]
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
