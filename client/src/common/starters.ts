/**
 * Starter (persona) catalog - single source of truth for the landing cards.
 *
 * Every card is assembled by `starter()` from five parts so behaviour stays
 * uniform: title, one-line intent, the input slots the user fills, what to
 * deliver once the brief is approved, and the domain output contract. The
 * assembled prompt always ends with the GO gate and a place for the user's own
 * words, so clicking a card stages a reviewable brief instead of firing a
 * command. Category labels and badges carry TranslationKeys so the component
 * renders them through useLocalize() with these authored English strings as
 * defaultValue.
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

/**
 * The two levers every card ends with: an approval gate and a place for the
 * user's own words. Defined once so 130+ cards cannot drift apart.
 */
export const STARTER_GATE =
  'Before you start: restate the brief in one line, name any slot you had to default, and ask "GO?" — if a slot cannot be answered without me, ask at most 3 short questions instead and stop. Do not search, calculate or write anything until I reply.';

export const STARTER_TAIL =
  'My additions: [ ]   ← type your own constraints here: audience, budget, tone, must-include, must-avoid';

/** Domain output contracts, reused instead of retyped per card. */
export const LIVE_CONTRACT =
  'cite every live figure with [Source](URL) and an "as of" time; compute derived numbers from the fetched values instead of recalling them; if live data cannot be retrieved, say so in one line and stop.';
export const SOURCED_CONTRACT =
  'cite every claim with [Source](URL), mark anything you could not verify, and never state a number you did not fetch or compute.';
export const DOC_CONTRACT =
  'produce file-ready structure — title, numbered sections, and tables where they help — with no placeholder text left in the deliverable.';
export const CODE_CONTRACT =
  'complete runnable code with no placeholders or ellipses, plus the one command that runs it and the output it should print.';
export const CLINICAL_CONTRACT =
  'reference guidance only, not a diagnosis or prescription; surface red-flag symptoms that need in-person care and never state a dose from memory.';
export const LEGAL_CONTRACT =
  'general information, not legal advice; name the statute, section or judgment you rely on and its date.';
export const TEACH_CONTRACT =
  'teach, do not dump: one idea per turn, a worked example, then one question for me to attempt — and wait for my answer before continuing.';
export const MOTION_CONTRACT =
  'render with the motion tool once, keep it deterministic and under 15 seconds, and return the file link plus the exact change I could ask for next.';

export interface StarterParts {
  title: string;
  description: string;
  inputs?: string[];
  deliver: string;
  contract?: string;
}

/**
 * Assembles a staged brief. `title` and `description` are also the card copy,
 * so authoring one string serves both the catalogue and the composer.
 */
export const starter = ({
  title,
  description,
  inputs = [],
  deliver,
  contract,
  ...card
}: StarterParts & Omit<StarterItem, 'prompt' | 'title' | 'description'>): StarterItem => {
  const parts: string[] = [`${title} — ${description}`];
  if (inputs.length > 0) {
    parts.push(`Inputs: ${inputs.map((input) => `[${input}]`).join(' · ')}`);
  }
  parts.push(STARTER_GATE, `On GO, deliver: ${deliver}`);
  if (contract) {
    parts.push(`Output contract: ${contract}`);
  }
  parts.push(STARTER_TAIL);
  return { title, description, prompt: parts.join('\n'), ...card };
};

export interface StarterSlot {
  start: number;
  end: number;
}

/**
 * Bracketed slots the user is meant to fill. Markdown links such as
 * `[Source](URL)` and any other bracket immediately followed by `(` are
 * output-format tokens, never inputs, so they are skipped.
 */
export const findStarterSlots = (text: string): StarterSlot[] => {
  const slots: StarterSlot[] = [];
  const pattern = /\[([^\]\n]{1,120})\]/g;
  let match: RegExpExecArray | null = pattern.exec(text);
  while (match !== null) {
    const end = match.index + match[0].length;
    if (text[end] !== '(') {
      slots.push({ start: match.index, end });
    }
    match = pattern.exec(text);
  }
  return slots;
};

export const ALL_CATEGORIES: StarterCategory[] = [
  {
    id: 'markets_finance',
    label: '📊 Markets & Bullion',
    labelKey: 'starters_cat_markets_finance',
    modes: ['Chat', 'Work', 'Pro'],
    starters: [
      starter({
        title: 'Market Overview',
        description: 'Live indices, bullion, crypto and movers, every figure timestamped.',
        inputs: ['scope — India / US / global', 'time horizon — today / this week'],
        deliver:
          'one consolidated market overview: Nifty 50, Sensex, Bank Nifty, India VIX, S&P 500, Nasdaq, Dow, Brent, USD/INR and DXY; gold and silver spot in USD/oz and USD/g plus INR retail by karat; the crypto fear & greed index; and the five biggest movers with the catalyst behind each move.',
        contract: LIVE_CONTRACT,
        badge: 'Markets',
        badgeKey: 'starters_badge_markets',
        mcpServers: ['satchida-web-search'],
      }),
      starter({
        title: 'Bullion Desk',
        description: 'Spot, retail by karat, making charges and duty for one market.',
        inputs: [
          'city / market',
          'karat set — 24K / 22K / 18K / 999 silver',
          'purpose — buying / selling / watching',
        ],
        deliver:
          'international spot in USD/oz and USD/g, INR retail rates by karat and for 999 silver, the making-charge spread between the IBJA benchmark and retail jewellers, the current duty and GST position, and a seven-day direction read with its drivers.',
        contract: LIVE_CONTRACT,
        badge: 'Bullion',
        badgeKey: 'starters_badge_bullion',
        mcpServers: ['satchida-web-search'],
      }),
      starter({
        title: 'Equity Dossier',
        description: 'Fundamental and technical valuation for one listed company.',
        inputs: ['asset — company / ticker / exchange', 'fiscal year', 'horizon — 1 / 3 / 5 years'],
        deliver:
          'a DCF with every input pulled from the filing and linked, a multiples comparison against three named peers, the earnings drivers that move the case, and an assumption table with a sensitivity range on the two inputs that matter most.',
        contract: `${SOURCED_CONTRACT} State the fiscal year used and never estimate share count or revenue from memory.`,
        badge: 'Equity',
        badgeKey: 'starters_badge_equity',
        mcpServers: ['satchida-work-suite', 'satchida-web-search'],
      }),
      starter({
        title: 'DeFi Contract Review',
        description: 'On-chain flow, liquidity and contract risk for one address.',
        inputs: ['contract address or token symbol', 'chain — ETH / BSC / Base / Solana'],
        deliver:
          'transaction-flow and holder-distribution analysis, liquidity-pool safety, token unlock schedule, and the specific contract risks visible in the verified source, each with the explorer or docs link you used.',
        contract: `${SOURCED_CONTRACT} Scope note: heuristic review from public data, not a certified audit.`,
        badge: 'DeFi Security',
        badgeKey: 'starters_badge_defi_security',
        mcpServers: ['satchida-web-search'],
      }),
    ],
  },
  {
    id: 'family_health',
    label: '🩺 Health & Emergency',
    labelKey: 'starters_cat_family_health',
    modes: ['Chat'],
    starters: [
      starter({
        title: 'Generic Medicine Prices',
        description: 'NPPA ceiling and PMBJP generic price for one medicine.',
        inputs: ['condition or prescribed brand'],
        deliver:
          'the NPPA ceiling price, the PMBJP generic equivalent, the savings computed as a percentage of the branded price, and the Schedule H / H1 status — each price with its source and date.',
        contract: `${SOURCED_CONTRACT} Not a prescription: confirm with your physician or pharmacist before switching.`,
        badge: 'Pharma',
        badgeKey: 'starters_badge_pharma',
        mcpServers: ['satchida-health-wellness', 'openfda-drugs', 'satchida-web-search'],
      }),
      starter({
        title: 'Clinical DDx Workup',
        description: 'Symptom timeline, differential matrix and must-not-miss list.',
        inputs: ['age and sex', 'symptoms and duration (OPQRST)', 'vitals and existing conditions'],
        deliver:
          'a symptom timeline, a differential matrix with the reason to rule each option in or out, the must-not-miss life-threatening diagnoses, and the labs or imaging to order with the guideline basis for each.',
        contract: `${CLINICAL_CONTRACT} Screen for red flags first and direct to 112 or emergency care before any analysis if one is present.`,
        badge: 'Clinical DDx',
        badgeKey: 'starters_badge_clinical_ddx',
        mcpServers: ['satchida-health-wellness'],
      }),
      starter({
        title: 'Drug Interaction Check',
        description: 'Severity, mechanism and label source for every drug pair.',
        inputs: [
          'active medications and doses',
          'supplements',
          'age, weight, kidney and liver function',
        ],
        deliver:
          'one row per interacting pair: severity (major / moderate / minor), mechanism (for example CYP3A4 inhibition) and the label citation pulled from openfda — with no dosing guidance until age, weight and organ function are known.',
        contract: `${CLINICAL_CONTRACT} Close with: verify with your physician or pharmacist.`,
        badge: 'Drug Safety',
        badgeKey: 'starters_badge_drug_safety',
        mcpServers: ['satchida-health-wellness', 'openfda-drugs'],
      }),
      starter({
        title: 'Emergency & AQI Triage',
        description: 'Verified helplines and live air quality for one location.',
        inputs: ['city / state / location'],
        deliver:
          'a helpline table (112, 108, poison control, Tele-MANAS) with national or state scope, official source link and last-verified date, plus live CPCB AQI readings with their observation time and the precautions they imply.',
        contract: `${SOURCED_CONTRACT} If this is happening now, call 112 first, and mark any number you could not verify from an official source as UNVERIFIED.`,
        badge: 'Emergency SOS',
        badgeKey: 'starters_badge_emergency_sos',
        mcpServers: ['satchida-web-search'],
      }),
    ],
  },
  {
    id: 'vedic_wellness',
    label: '🕉️ Vedic & Holistic Wellness',
    labelKey: 'starters_cat_vedic_wellness',
    modes: ['Chat', 'Privacy'],
    starters: [
      starter({
        title: 'Panchang & Muhurta',
        icon: '🕉️',
        description: 'Tithi, nakshatra, yoga, karana and the Abhijit window.',
        inputs: ['city / state / coordinates', 'date — today by default'],
        deliver:
          'the panchang for that date and place: tithi, nakshatra, yoga, karana and the auspicious Abhijit Muhurta window, with the Drik method, timezone and coordinates used, and a note on regional variation.',
        contract:
          'take every value from the panchang tool — never compute tithi or nakshatra math yourself.',
        badge: 'Panchang',
        badgeKey: 'starters_badge_panchang',
        mcpServers: ['satchida-panchang-vedic'],
      }),
      starter({
        title: 'Ayurvedic Daily Regimen',
        icon: '🌿',
        description: 'Dinacharya balancing vata, pitta and kapha for your profile.',
        inputs: ['age', 'health goals or current symptoms', 'diet and sleep pattern'],
        deliver:
          'a daily regimen (dinacharya) built for the dosha balance you infer, with each practice, its timing and its classical source, tagging every recommendation as classical text or clinical evidence.',
        contract:
          'ask 3 short assessment questions if the prakriti inputs are thin, and screen herb-drug contraindications with the health tool before recommending anything.',
        badge: 'Ayurveda',
        badgeKey: 'starters_badge_ayurveda',
        mcpServers: ['satchida-health-wellness'],
      }),
      starter({
        title: 'Festival Calendar & Vrats',
        icon: '🪔',
        description: 'Upcoming festival dates, lunar tithis and fasting guidance.',
        inputs: ['year / month', 'region'],
        deliver:
          'the upcoming festival dates with their lunar tithi and fasting (vrat) guidance, stated under both Amant and Purnimant conventions where they diverge.',
        contract:
          'take every tithi from the panchang tool and name the calendar convention and region you used.',
        badge: 'Festivals',
        badgeKey: 'starters_badge_festivals',
        mcpServers: ['satchida-panchang-vedic'],
      }),
      starter({
        title: 'Yoga & Pranayama Plan',
        icon: '🧘',
        description: 'Techniques, contraindications and progression for one goal.',
        inputs: ['goal — stress / breathing / sleep / back pain', 'current level', 'minutes a day'],
        deliver:
          'a short sequence naming each asana or pranayama, its contraindications and safety red flags for my stated condition, one progression step, and the classical source.',
        contract: CLINICAL_CONTRACT,
        badge: 'Yoga/Pranayama',
        badgeKey: 'starters_badge_yoga_pranayama',
        mcpServers: ['satchida-health-wellness'],
      }),
      starter({
        title: 'WCAG Contrast Audit',
        icon: '🛡️',
        description: 'Pass/fail matrix for a colour pair or component.',
        inputs: ['foreground and background hex', 'element — body / large text / UI component'],
        deliver:
          'a pass/fail matrix: element | ratio to two decimals | required threshold (4.5:1 body text, 3:1 large text and UI components) | verdict, plus the failing token pair to change first.',
        contract: 'compute every ratio with the accessibility tool — never mental math.',
        badge: 'WCAG 2.2',
        badgeKey: 'starters_badge_wcag_2_2',
        mcpServers: ['accessibility-tools'],
      }),
    ],
  },
  {
    id: 'citizen_essentials',
    label: '🛡️ Citizen Essentials',
    labelKey: 'starters_cat_citizen_essentials',
    modes: ['Chat'],
    starters: [
      starter({
        title: 'Fuel & LPG Prices',
        icon: '⛽',
        description: 'City fuel and LPG prices, plus inverter and solar sizing.',
        inputs: ['city / state', 'load — fans, lights, laptop, router', 'backup hours'],
        deliver:
          'petrol, diesel and 14.2 kg LPG prices for my city, then step-by-step inverter VA/Ah sizing for my load list and backup hours, with the solar net-metering offset.',
        contract: LIVE_CONTRACT,
        badge: 'Energy & Fuel',
        badgeKey: 'starters_badge_energy_fuel',
        mcpServers: ['satchida-web-search', 'satchida-stem-study'],
      }),
      starter({
        title: 'Water & Food Safety',
        icon: '💧',
        description: 'TDS bands and rapid home adulteration tests.',
        inputs: ['water source — municipal / borewell / tanker'],
        deliver:
          'the BIS IS 10500 TDS bands as a table with the purification method that fits my source, and rapid home tests for milk, spice and oil adulteration, each marked indicative or confirmatory.',
        contract: 'cite BIS IS 10500 and FSSAI DART documents with links.',
        badge: 'Food & Water',
        badgeKey: 'starters_badge_food_water',
        mcpServers: ['satchida-web-search'],
      }),
      starter({
        title: 'School Orders & Exams',
        icon: '🎒',
        description: 'Closure orders and NTA/CBSE schedules for one district.',
        inputs: ['district / state', 'exam — NTA / CBSE / state board'],
        deliver:
          'active district magistrate closure orders and the current exam schedule, each with an order or notification date and an official source link.',
        contract:
          'official domains only; if only aggregators carry an item, say so and do not present it as an order.',
        badge: 'Exam/School',
        badgeKey: 'starters_badge_exam_school',
        mcpServers: ['satchida-web-search'],
      }),
      starter({
        title: 'Banking & EPFO Help',
        icon: '🏦',
        description: 'Strike alerts plus Form 31 and consumer complaint steps.',
        inputs: ['query — strike / ATM / PF withdrawal / consumer complaint'],
        deliver:
          'live bank-strike and ATM-liquidity alerts with an as-of date, then the exact Form 31 PF withdrawal or NCH 1915 complaint steps with official links.',
        contract: `${LIVE_CONTRACT} Rules and rates: verify against the current circular before acting.`,
        badge: 'Banking & PF',
        badgeKey: 'starters_badge_banking_pf',
        mcpServers: ['satchida-web-search'],
      }),
      starter({
        title: 'Transit & Route Alerts',
        icon: '🚆',
        description: 'Rail, flight and highway status for one route.',
        inputs: ['origin', 'destination', 'travel date'],
        deliver:
          'a status table — service | status | as-of time | official source (NTES / DGCA / NHAI) — covering delays, cancellations, fog advisories and highway closures on my route.',
        contract: 'mark anything found only on aggregators as unofficial.',
        badge: 'Transit',
        badgeKey: 'starters_badge_transit',
        mcpServers: ['satchida-web-search'],
      }),
    ],
  },
  {
    id: 'governance_law',
    label: '⚖️ Legal & Governance',
    labelKey: 'starters_cat_governance_law',
    modes: ['Work', 'Pro', 'Privacy'],
    starters: [
      starter({
        title: 'RBI Compliance Check',
        icon: '⚖️',
        description: 'Repo, EMI, UPI limits and lending rules with circular cites.',
        inputs: ['topic — repo / EMI / UPI / digital lending', 'institution type'],
        deliver:
          'the current position on my topic with the RBI circular number and date for every figure, plus what changed in the last two revisions and what it means for my institution type.',
        contract: `${LEGAL_CONTRACT} No circular, no number — stable framework questions may be answered from knowledge, marked as such.`,
        badge: 'RBI Regulatory',
        badgeKey: 'starters_badge_rbi_regulatory',
        mcpServers: ['legal-research', 'satchida-web-search'],
      }),
      starter({
        title: 'Case Law & Gazette',
        icon: '🏛️',
        description: 'Precedents, notifications and DPDP / BNS compliance.',
        inputs: ['legal subject or case query', 'jurisdiction'],
        deliver:
          'the controlling precedents and Gazette notifications with case name, neutral citation, bench, date and judgment link, the holding separated from obiter dicta, and the compliance position under DPDP or the Bharatiya Nyaya Sanhita.',
        contract: LEGAL_CONTRACT,
        badge: 'Supreme Court',
        badgeKey: 'starters_badge_supreme_court',
        mcpServers: ['legal-research', 'satchida-web-search'],
      }),
      starter({
        title: 'ISO 27001 / SOC 2 Audit',
        icon: '📋',
        description: 'Control checklist, gap matrix and third-party risk.',
        inputs: ['system or infrastructure', 'target — ISO 27001 / SOC 2 / both'],
        deliver:
          'an internal control checklist using exact ISO/IEC 27001:2022 Annex A and SOC 2 CC1–CC9 identifiers, a gap matrix with severity, owner and remediation deadline, and the third-party risk questions to send vendors.',
        contract: 'every control carries its exact identifier; no paraphrased control names.',
        badge: 'GRC Audit',
        badgeKey: 'starters_badge_grc_audit',
        mcpServers: ['legal-research', 'devops-security'],
      }),
      starter({
        title: 'Contract Clause Review',
        icon: '📝',
        description: 'Indemnity, IP, non-solicit and governing law, clause by clause.',
        inputs: ['contract text', 'your side — customer / vendor / employer'],
        deliver:
          'a clause table: excerpt with line reference | risk rating | jurisdiction note under the Indian Contract Act 1872, Stamp Act and Specific Relief Act — plus every schedule or exhibit you could not review.',
        contract: LEGAL_CONTRACT,
        badge: 'Contracts',
        badgeKey: 'starters_badge_contracts',
        mcpServers: ['legal-research', 'satchida-work-suite'],
      }),
    ],
  },
  {
    id: 'geopolitics_intel',
    label: '🛰️ Geopolitics & Defence',
    labelKey: 'starters_cat_geopolitics_intel',
    modes: ['Chat', 'Work', 'Pro'],
    starters: [
      starter({
        title: 'Border & Defence Brief',
        icon: '🛰️',
        description: 'LOC, LAC and sea-lane posture with confidence tiers.',
        inputs: ['theatre — LOC / LAC / Indian Ocean', 'window — 24h / 7d / 30d'],
        deliver:
          'the current posture with deployments and force movements, each claim tiered Confirmed (two or more independent sources) / Claimed (single source) / Unverified, timestamped, with each actor’s statement separated from assessed fact.',
        contract: SOURCED_CONTRACT,
        badge: 'Border Intel',
        badgeKey: 'starters_badge_border_intel',
        mcpServers: ['satchida-web-search'],
      }),
      starter({
        title: 'Critical Minerals Map',
        icon: '⛏️',
        description: 'Who controls lithium, rare earths, cobalt and fabs.',
        inputs: ['mineral or component', 'horizon — current / 2030 outlook'],
        deliver:
          'control of production and refining by country and company, with production share, the year of each figure and its primary source (for example the USGS Mineral Commodity Summaries).',
        contract: 'label every estimate as an estimate.',
        badge: 'Supply Chains',
        badgeKey: 'starters_badge_supply_chains',
        mcpServers: ['satchida-web-search'],
      }),
      starter({
        title: 'Alliance & Sanctions Map',
        icon: '🌐',
        description: 'BRICS, Quad, SCO dynamics and trade corridors.',
        inputs: ['bloc or corridor', 'question — alignment / trade / sanctions'],
        deliver:
          'the dynamics across the blocs I named, dated, with official readouts cited separately from media reporting and every assessment labelled as assessment.',
        contract: SOURCED_CONTRACT,
        badge: 'Foreign Policy',
        badgeKey: 'starters_badge_foreign_policy',
        mcpServers: ['satchida-web-search'],
      }),
      starter({
        title: 'State Cyber Threat Brief',
        icon: '🔐',
        description: 'APTs, cable and grid risk with ATT&CK and CERT-In IDs.',
        inputs: ['sector — telecom / power / finance / government', 'actor, if known'],
        deliver:
          'the state-linked threat picture with MITRE ATT&CK technique IDs, CERT-In advisory numbers, and confirmed incidents separated from reported ones.',
        contract: 'attribute with caveats — "assessed by" plus the naming organisation.',
        badge: 'Cyber Warfare',
        badgeKey: 'starters_badge_cyber_warfare',
        mcpServers: ['devops-security', 'satchida-web-search'],
      }),
    ],
  },
  {
    id: 'security_hardware',
    label: '🔒 Cyber & AI Hardware',
    labelKey: 'starters_cat_security_hardware',
    modes: ['Work', 'Pro', 'Vibecoding'],
    starters: [
      starter({
        title: 'CVE Threat Brief',
        icon: '🐞',
        description: 'Status, CVSS vector and fix version for one CVE or product.',
        inputs: ['software / CVE identifier', 'your exposure — version and internet-facing?'],
        deliver:
          'a table: CVE-ID | CVSS 3.1 vector string | CISA KEV yes/no | affected version ranges | fixed version | advisory link, cross-checked between NVD and the vendor advisory, then the one action to take first for my exposure.',
        contract:
          'never quote a score without its source link, and mark any field you cannot source as unknown.',
        badge: 'CVE Intel',
        badgeKey: 'starters_badge_cve_intel',
        mcpServers: ['devops-security', 'satchida-web-search'],
      }),
      starter({
        title: 'GPU Cluster Comparison',
        icon: '🖥️',
        description: 'H100 vs B200: interconnect, FP8 throughput and thermal limits.',
        inputs: ['accelerator pair', 'workload — training / inference / mixed', 'cluster size'],
        deliver:
          'a comparison of the two accelerators with NVLink bandwidth, FP8 dense and sparse throughput, and the datacenter thermal envelope, each figure taken from the vendor datasheet with an as-of date.',
        contract:
          'state dense vs sparse and unidirectional vs bidirectional explicitly, and mark any spec you cannot source as unknown rather than recalling an old datasheet.',
        badge: 'GPU Compute',
        badgeKey: 'starters_badge_gpu_compute',
        mcpServers: ['satchida-ai-engineer', 'satchida-web-search'],
      }),
      starter({
        title: 'Edge Vision Architecture',
        icon: '📹',
        description: 'RTSP pipeline, on-device detection and DPDP-safe redaction.',
        inputs: ['camera count and resolution', 'detection goal', 'retention days'],
        deliver:
          'a Mermaid architecture diagram, step-by-step bitrate and storage math from my camera counts, the on-device model and hardware spec, and the redaction requirements for DPDP-compliant video handling.',
        contract:
          'show the arithmetic — never estimate storage without the formula and its inputs.',
        badge: 'Edge Vision',
        badgeKey: 'starters_badge_edge_vision',
        mcpServers: ['devops-security', 'satchida-work-suite'],
      }),
      starter({
        title: 'Code & Secret Scan',
        icon: '🔍',
        description: 'Hardcoded keys, deserialisation and injection, file by file.',
        inputs: ['code snippet or repository path', 'language and framework'],
        deliver:
          'each finding as severity [CRITICAL/WARN/INFO] | file:line | fix diff, ordered by exploitability, with the reachable path that makes each one matter.',
        contract: 'if only a snippet was reviewed, say that the wider repository was not examined.',
        badge: 'Code Security',
        badgeKey: 'starters_badge_code_security',
        mcpServers: ['devops-security', 'git-librechat'],
      }),
    ],
  },
  {
    id: 'study_core',
    label: '🎓 STEM & Math',
    labelKey: 'starters_cat_study_core',
    modes: ['Study', 'Study-Local'],
    starters: [
      starter({
        title: 'Symbolic Math Solver',
        icon: '🧮',
        description: 'Step-by-step solution, verified roots and a plot.',
        inputs: ['equation', 'variable', 'domain if restricted'],
        deliver:
          'a step-by-step solution with KaTeX, the factoring or substitution used, every root with its multiplicity, a substitution check for each root, and a plot of the function.',
        contract:
          'verify every root with the stem-study SymPy tool before signing off — never mental algebra alone.',
        badge: 'Symbolic Math',
        badgeKey: 'starters_badge_symbolic_math',
        mcpServers: ['satchida-stem-study'],
      }),
      starter({
        title: 'Visual Concept & Animated Physics Lab',
        icon: '🎬',
        description: 'Physical concepts with downloaded animated GIFs and video lessons.',
        inputs: ['physical or natural phenomenon', 'level — school / undergraduate'],
        deliver:
          'the core principle explained intuitively, 1–2 downloaded animated GIFs or apparatus diagrams embedded via fetch_learning_visuals, mathematical derivation in KaTeX, and 2–3 recommended video lessons from Khan Academy, MIT OCW, or 3Blue1Brown via search_curated_learning_videos.',
        contract:
          'always embed verified local visual media and clickable video links for complete multi-modal learning.',
        badge: 'Visual Physics & STEM',
        badgeKey: 'starters_badge_visual_physics',
        mcpServers: ['satchida-stem-study'],
      }),
      starter({
        title: 'Concept Book Builder',
        icon: '📘',
        description: 'A Socratic learning module with milestones and quizzes.',
        inputs: ['topic', 'level — school / undergraduate / professional', 'time available'],
        deliver:
          'a learning module with milestones, Socratic exercises per milestone, a practice quiz with answers held back, and the one misconception that usually breaks this topic.',
        contract: TEACH_CONTRACT,
        badge: 'DeepTutor',
        badgeKey: 'starters_badge_deeptutor',
        mcpServers: ['deeptutor-integration'],
      }),
      starter({
        title: 'Derivation Coach',
        icon: '🧲',
        description: 'Faraday-Lenz and Maxwell, dimension-checked step by step.',
        inputs: ['derivation or topic', 'level — school / undergraduate'],
        deliver:
          'the derivation with each step justified, a dimensional-analysis check on every key step run through the stem-study tool, and the physical meaning of the result.',
        contract: 'flag any step the tool cannot verify instead of asserting it.',
        badge: 'Physics',
        badgeKey: 'starters_badge_physics',
        mcpServers: ['satchida-stem-study'],
      }),
      starter({
        title: 'Academic Literature Preview',
        icon: '📄',
        description: 'Targeted survey of foundational concepts with citations.',
        inputs: ['topic or query', 'focus area'],
        deliver:
          'a targeted preview summary of foundational academic concepts, key terminology, and landmark papers from the knowledge base, highlighting where deeper multi-tier sweeps and dossier synthesis are unlocked in Pro.',
        contract:
          'ground all explanations strictly in verified academic references without speculation.',
        badge: 'Academic Lit Preview',
        badgeKey: 'starters_badge_lit_preview',
        mcpServers: ['satchida-knowledge-vault'],
      }),
      starter({
        title: 'Algorithm Comparison',
        icon: '🧠',
        description: 'Dijkstra vs A*, complexity table and verified code.',
        inputs: ['algorithm pair or problem', 'graph size and constraints'],
        deliver:
          'a worst-case and average-case complexity table, a correctness argument, runnable code for both, and the measured result on my constraint set.',
        contract: `${CODE_CONTRACT} State the admissibility condition under which A* keeps optimality, and run the code through the validators before calling it verified.`,
        badge: 'CS Algorithms',
        badgeKey: 'starters_badge_cs_algorithms',
        mcpServers: ['satchida-stem-study'],
      }),
    ],
  },
  {
    id: 'school_boards',
    label: '🎒 CBSE, IGCSE & IB STEM',
    labelKey: 'starters_cat_school_boards',
    modes: ['Study', 'Study-Local'],
    starters: [
      starter({
        title: 'CBSE Chapter Tutor',
        description: 'A chapter taught from zero, with a quiz I answer first.',
        inputs: ['class — 6 to 12', 'subject', 'chapter'],
        deliver:
          'the chapter taught from the beginning for a first-time learner: simple language, one idea at a time, a worked example after each idea, and the exact NCERT terminology and formulas.',
        contract:
          'end with a 5-question self-check quiz and wait for my answers before giving solutions — do not dump the whole chapter in one reply.',
        badge: 'CBSE Tutor',
        badgeKey: 'starters_badge_cbse_tutor',
      }),
      starter({
        title: 'IGCSE Topic Tutor',
        description: 'Cambridge wording, command words and a past-paper question.',
        inputs: [
          'programme — Checkpoint / Lower Secondary / IGCSE',
          'subject',
          'topic',
          'tier — Core / Extended',
        ],
        deliver:
          'the topic taught to the Cambridge syllabus wording, the command words it attracts (state / explain / calculate) and what each demands, and one past-paper-style question worked step by step.',
        contract:
          'finish with 3 practice questions at my tier and wait for my answers before marking them.',
        badge: 'IGCSE Tutor',
        badgeKey: 'starters_badge_igcse_tutor',
      }),
      starter({
        title: 'IB DP Science & Math Coach',
        description: 'IB criteria A/B/C/D breakdown, command terms and inquiry.',
        inputs: ['level — SL or HL', 'subject — Physics/Chem/Bio/Math AA/AI', 'topic or question'],
        deliver:
          'the concept mapped directly to the IB syllabus guide, unpacking the specific command terms (analyze, deduce, evaluate), with one worked standard-level and one higher-level exemplar.',
        contract:
          'prompt with an IB-style inquiry question and wait for my approach before showing the mark-scheme scoring breakdown.',
        badge: 'IB DP Coach',
        badgeKey: 'starters_badge_ib_dp_coach',
        mcpServers: ['satchida-stem-study'],
      }),
      starter({
        title: 'Chemistry Equation & Stoichiometry Lab',
        description: 'Balance redox/reactions, mole ratios and limiting reagent math.',
        inputs: ['chemical reaction or reactants', 'known masses or molarities', 'target output'],
        deliver:
          'the balanced molecular and net ionic equation, step-by-step oxidation state tracking, mole ratio calculations, limiting reagent deduction, and theoretical yield.',
        contract:
          'compute all molar masses and stoichiometric conversions using verified arithmetic line-by-line; verify conservation of mass.',
        badge: 'Chemistry / Stoichiometry',
        badgeKey: 'starters_badge_chem_balancer',
        mcpServers: ['satchida-stem-study'],
      }),
      starter({
        title: 'Board Exam Drill',
        description: 'A timed paper in exact board pattern, marked strictly.',
        inputs: ['board — CBSE / IGCSE', 'class or year', 'subject', 'chapters'],
        deliver:
          'a timed practice paper in the exact board pattern — section marks, internal choice and mark allotment per question.',
        contract:
          'I attempt it first; then mark my answers against a board-style marking scheme, award marks question by question, and show where steps earned or lost marks.',
        badge: 'Board Drill',
        badgeKey: 'starters_badge_board_drill',
        mcpServers: ['satchida-stem-study'],
      }),
      starter({
        title: 'Book-Back Exercise Solver',
        description: 'Full worked solution for each exercise question, steps shown.',
        inputs: ['class — 6 to 12', 'subject', 'chapter', 'exercise and question numbers'],
        deliver:
          'the full worked solution exactly as the exercise asks, every step shown, with units and reasoning stated and a one-line check that verifies the result.',
        contract:
          'if you are not certain of the exact question wording, ask me to type or photograph the question first instead of guessing it.',
        badge: 'Book Exercises',
        badgeKey: 'starters_badge_book_exercises',
        mcpServers: ['satchida-stem-study'],
      }),
      starter({
        title: 'Doubt Clinic',
        description: 'Diagnose the gap, explain the smallest fix, then I try one.',
        inputs: ['board — CBSE / IGCSE', 'class', 'subject', 'my doubt — paste the exact question'],
        deliver:
          'a diagnosis of what I am likely missing and the smallest fix, then one similar question for me to try myself.',
        contract: 'wait for my answer before revealing the solution.',
        badge: 'Doubt Clinic',
        badgeKey: 'starters_badge_doubt_clinic',
      }),
      starter({
        title: 'Formula Flashcards',
        description: 'One card at a time, wrong ones re-asked at the end.',
        inputs: ['board', 'class', 'subject', 'chapter list'],
        deliver:
          'one card at a time — prompt on one turn, reveal only after I attempt it — covering every formula, definition, law and unit in those chapters.',
        contract: 'track which ones I get wrong and re-ask those at the end.',
        badge: 'Flashcards',
        badgeKey: 'starters_badge_flashcards',
      }),
      starter({
        title: 'Biology & Living Systems Visual Lab',
        description:
          'Cell biology, anatomy & physiology with verified animated GIFs and video demos.',
        inputs: [
          'board and grade',
          'biological concept — e.g. mitosis / cardiac cycle / photosynthesis',
        ],
        deliver:
          'step-by-step biological mechanism, 1–2 downloaded animated GIFs or anatomical cutaway diagrams embedded into the chat via fetch_learning_visuals, labeled cellular stages, and curated Khan Academy or CrashCourse video recommendations via search_curated_learning_videos.',
        contract:
          'deliver rich visual evidence with local image embeds; follow with an exam-style identification question.',
        badge: 'Visual Biology Lab',
        badgeKey: 'starters_badge_visual_biology',
        mcpServers: ['satchida-stem-study'],
      }),
      starter({
        title: 'Concept Gap Diagnostic',
        description: 'Ten questions, then a report card and revision order.',
        inputs: ['board', 'class', 'subject', 'chapter'],
        deliver:
          'a 10-question diagnostic spanning the chapter from easy to exam-hard, then a report card naming the strong and weak sub-topics and a numbered revision plan ordered by exam weightage.',
        contract: 'wait for my answers before producing the report card.',
        badge: 'Diagnostic',
        badgeKey: 'starters_badge_diagnostic',
      }),
    ],
  },
  {
    id: 'textbook_navigator',
    label: '📖 Textbook Navigator',
    labelKey: 'starters_cat_textbook_navigator',
    modes: ['Study', 'Study-Local'],
    starters: [
      starter({
        title: 'Textbook Page Guide',
        description: 'What one exact page or section teaches, in student words.',
        inputs: ['subject', 'book name and edition', 'chapter', 'page (and paragraph)'],
        deliver:
          'what that exact section teaches in words a student in my class can follow, one everyday example, and a quick 3-question check.',
        contract:
          'if you do not reliably know that page of that edition, say so and ask me to type or photograph it rather than inventing its contents.',
        badge: 'Page Guide',
        badgeKey: 'starters_badge_page_guide',
      }),
      starter({
        title: 'Homework Helper',
        description: 'Socratic hints one turn at a time, never the answer first.',
        inputs: [
          'book and chapter',
          'page and question number',
          'the question or "photo attached"',
        ],
        deliver: 'one hint per turn that lets me attempt the next step myself.',
        contract:
          'give the full worked solution only after I have tried or explicitly ask for it — never hand over the answer on the first turn.',
        badge: 'Homework',
        badgeKey: 'starters_badge_homework',
      }),
      starter({
        title: 'Chapter Summary & Map',
        description: 'A one-page revision sheet plus a text mind map.',
        inputs: ['book and edition', 'subject', 'chapter'],
        deliver:
          'a one-page revision summary (key concepts, formulas and definitions, diagrams described, common exam traps) plus a text mind map I can paste into notes.',
        contract:
          'flag anything you are not certain matches this exact edition so I can verify against my copy.',
        badge: 'Summary',
        badgeKey: 'starters_badge_summary',
      }),
      starter({
        title: 'Exercise Answer Bank',
        description: 'Every question in one exercise, solved and numbered to match.',
        inputs: ['book and edition', 'chapter', 'exercise name or number'],
        deliver:
          'every question in that exercise solved with full steps, numbered to match the book, as a clean answer key I can revise from.',
        contract:
          'where you are not certain of the exact question text in this edition, list it as "needs my textbook" instead of guessing.',
        badge: 'Answer Bank',
        badgeKey: 'starters_badge_answer_bank',
        mcpServers: ['satchida-stem-study'],
      }),
      starter({
        title: 'Multi-Source Concept Explainer & Video Hub',
        description:
          'Deep conceptual breakdown with textbook context, visual diagrams, and multi-source video links.',
        inputs: [
          'topic or concept',
          'curriculum — NCERT / Cambridge / IB / College',
          'target depth — simple / detailed / rigorous',
        ],
        deliver:
          'a comprehensive explanation using first principles, 1–2 downloaded curriculum diagrams or animated GIFs embedded via fetch_learning_visuals, step-by-step mathematical formulation in KaTeX, and a curated list of top video tutorials from Khan Academy, MIT OCW, CrashCourse, and 3Blue1Brown via search_curated_learning_videos.',
        contract:
          'combine verbal clarity, verified KaTeX equations, local media embeds, and authoritative video links in one unified lesson.',
        badge: 'Visual Concept & Video Hub',
        badgeKey: 'starters_badge_concept_video_hub',
        mcpServers: ['satchida-stem-study'],
      }),
    ],
  },
  {
    id: 'python_from_zero',
    label: '🐍 Python from Zero',
    labelKey: 'starters_cat_python_from_zero',
    modes: ['Study', 'Study-Local', 'Vibecoding'],
    starters: [
      starter({
        title: 'Python Lesson',
        description: 'One concept per turn, one exercise, then I answer.',
        inputs: ['lesson number or "start from Lesson 1"'],
        deliver:
          'one small concept per turn in this order: print and variables → input → numbers and math → strings → if/else → loops → lists → functions → dictionaries → files → mini-projects. Each turn: the idea in two plain sentences, a 3–5 line runnable example with expected output, and one exercise.',
        contract:
          'stop after the exercise and wait for my answer; do not teach the next concept until I reply, and resume from the lesson I stopped at.',
        badge: 'Lesson',
        badgeKey: 'starters_badge_lesson',
      }),
      starter({
        title: 'Python Course Map',
        description: 'The 20-lesson path, where I am, and what to do next.',
        inputs: ['last completed lesson or "new"'],
        deliver:
          'the lesson-by-lesson syllabus for lessons 1–20, one line each with the concept and what I will be able to build, my current position marked, and the next lesson to take.',
        contract: 'one line per lesson — no full explanation of the content.',
        badge: 'Syllabus',
        badgeKey: 'starters_badge_syllabus',
      }),
      starter({
        title: 'Python Practice Set',
        description: 'Three exercises that use only the concepts I have learned.',
        inputs: ['topic — loops / lists / functions', 'difficulty — easy / medium / hard'],
        deliver:
          'three exercises of increasing difficulty that use only concepts up to my topic, with no advanced features.',
        contract:
          'wait for my attempted code, then check it and point out bugs gently; show a model solution only after my attempt.',
        badge: 'Practice',
        badgeKey: 'starters_badge_practice',
      }),
      starter({
        title: 'Python Debug Coach',
        description: 'Find the line, explain the gap, let me fix it.',
        inputs: ['my code', 'what I expected', 'what actually happened'],
        deliver:
          'the exact line at fault and what that line does versus what I think it does, so I can attempt the fix myself.',
        contract: 'do not fix it for me immediately; confirm my corrected version afterwards.',
        badge: 'Debug Coach',
        badgeKey: 'starters_badge_debug_coach',
      }),
      starter({
        title: 'Python Quiz',
        description: 'Mixed theory and predict-the-output, one at a time.',
        inputs: ['lesson range', 'question count — 5 or 10'],
        deliver:
          'mixed theory and predict-the-output questions, one at a time, marked as I answer with a running score.',
        contract: 'at the end tell me which lesson to revise.',
        badge: 'Quiz',
        badgeKey: 'starters_badge_quiz',
      }),
      starter({
        title: 'Python Mini-Project',
        description: 'Build it with me, one small step per turn.',
        inputs: ['project — number guessing / unit converter / to-do list / quiz game'],
        deliver:
          'the plan first (what functions we need), then one small step per turn where I write the code and you review it.',
        contract:
          'do not write the whole project yourself — the goal is that I write most of the lines.',
        badge: 'Mini-Project',
        badgeKey: 'starters_badge_mini_project',
      }),
    ],
  },
  {
    id: 'ai_research_books',
    label: '🔬 Deep Research, PhD & Thesis',
    labelKey: 'starters_cat_ai_research_books',
    modes: ['Work', 'Pro'],
    starters: [
      starter({
        title: 'Deep Research Dossier',
        description: 'Six-phase investigation ending in a downloadable PDF dossier.',
        inputs: ['topic or policy', 'depth — briefing / full dossier', 'deadline'],
        deliver:
          'a six-phase investigation: 5–8 falsifiable sub-questions, multi-tier sweeps across official registers, academic citations and benchmarks, a contradiction matrix for conflicting claims, the unresolved empirical gaps and retracted literature, and a four-critic adversarial self-audit (dialectic / depth / width / citation) — then saved as a PDF with a one-click link.',
        contract: `${DOC_CONTRACT} Cite only sources you actually retrieved.`,
        badge: 'Deep Research',
        badgeKey: 'starters_badge_deep_research',
        mcpServers: [
          'satchida-web-search',
          'satchida-knowledge-vault',
          'academic-search',
          'arxiv-search',
        ],
      }),
      starter({
        title: 'PhD Thesis & Defense Synthesizer',
        description: 'Methodology validation, literature matrix, and oral defense critique.',
        inputs: [
          'research domain',
          'thesis statement / methodology',
          'target journal or university',
        ],
        deliver:
          'an exhaustive doctoral-level literature synthesis matrix, methodological boundary analysis, statistical validity critique, and a simulated defense panel interrogation addressing underlying assumptions and falsifiability.',
        contract:
          'rigorous academic citation standards with verified DOIs or arXiv identifiers; evaluate conflicting peer-reviewed literature with explicit methodological critique.',
        badge: 'PhD Thesis & Defense',
        badgeKey: 'starters_badge_phd_thesis',
        mcpServers: ['arxiv-search', 'academic-search', 'satchida-web-search'],
      }),
      starter({
        title: 'Advanced Theoretical Physics & Math Lab',
        description:
          'Hamiltonians, quantum state vectors, differential geometry and tensor proofs.',
        inputs: ['physical system or equation', 'gauge or coordinate basis', 'boundary conditions'],
        deliver:
          'the complete analytical derivation with every tensor index and coordinate transformation explicit, differential geometric properties, conserved currents via Noether theorem, and dimensional consistency checks.',
        contract:
          'compute through the symbolic math environment and verify index symmetries and boundary regularity explicitly.',
        badge: 'Advanced Math & Physics',
        badgeKey: 'starters_badge_advanced_math_physics',
        mcpServers: ['satchida-stem-study'],
      }),
      starter({
        title: 'Robotics Kinematics & Embedded Hardware Lab',
        description:
          'Forward/inverse kinematics, Denavit-Hartenberg matrices, and PCB signal timings.',
        inputs: [
          'robot architecture (DOF) or circuit',
          'link lengths / sensor bus (SPI/I2C/CAN)',
          'dynamic constraints',
        ],
        deliver:
          'the closed-form or numerical DH-parameter transformation matrices, Jacobian calculation for singularity detection, trajectory planning polynomial, and embedded hardware bus latency analysis.',
        contract:
          'validate singularity angles and ensure circuit electrical parameters (impedance, rise-time, current budget) are rigorously verified.',
        badge: 'Robotics & Embedded',
        badgeKey: 'starters_badge_robotics_hardware',
        mcpServers: ['satchida-stem-study', 'satchida-ai-engineer'],
      }),
      starter({
        title: 'E-Book Blueprint',
        description: 'Chapter-by-chapter manuscript plan with sourcing per chapter.',
        inputs: ['title or subject', 'audience', 'target length'],
        deliver:
          'a multi-chapter blueprint with executive summary, diagrams and case studies, and per chapter: objective, target word count, figure and table list, and sourcing plan.',
        contract:
          'query the knowledge vault first so the outline does not duplicate indexed material.',
        badge: 'E-Book / PRD',
        badgeKey: 'starters_badge_e_book_prd',
        mcpServers: ['satchida-knowledge-vault'],
      }),
      starter({
        title: 'Transformer Sizing',
        description: 'KV-cache and tensor-parallel math from the model config.',
        inputs: [
          'model — 7B / 14B / your checkpoint',
          'sequence length',
          'batch size and precision',
        ],
        deliver:
          'the full kv-cache arithmetic (2 × layers × kv_heads × head_dim × sequence × batch × bytes) with every value labelled and sourced from the model config, plus the tensor-parallel plan that fits my GPU count.',
        contract:
          'compute with the stem-study tool rather than in your head, and show the arithmetic line by line.',
        badge: 'AI Architecture',
        badgeKey: 'starters_badge_ai_architecture',
        mcpServers: ['satchida-ai-engineer', 'satchida-stem-study'],
      }),
      starter({
        title: 'Peer-Reviewed Survey',
        description: 'Only papers the tools actually returned, with IDs.',
        inputs: ['research field', 'years to cover'],
        deliver:
          'a survey of what the search tools returned, each entry with exact title, authors, arXiv ID or DOI and year, grouped by the question it answers.',
        contract:
          'cite only papers the tools actually returned — never emit a reference you did not retrieve; if nothing comes back, say so plainly.',
        badge: 'Scholar/arXiv',
        badgeKey: 'starters_badge_scholar_arxiv',
        mcpServers: ['arxiv-search', 'academic-search'],
      }),
    ],
  },
  {
    id: 'vibecoding_dev',
    label: '💻 Vibe Coding & Architecture',
    labelKey: 'starters_cat_vibecoding_dev',
    modes: ['Vibecoding', 'Work', 'Pro'],
    starters: [
      starter({
        title: 'API Architecture Blueprint',
        description: 'Capacity math, threat model and idempotency semantics.',
        inputs: [
          'application requirement',
          'scale — requests/sec and data volume',
          'deployment target',
        ],
        deliver:
          'the service design with non-functional requirements and capacity math (requests/sec to workers and queue depth), a threat model, Mermaid sequence and ER diagrams, an explicit assumptions list, and the chosen idempotency semantics (at-least-once vs exactly-once).',
        contract: 'state assumptions explicitly; no unlabelled guesses in the capacity math.',
        badge: 'Architecture',
        badgeKey: 'starters_badge_architecture',
        mcpServers: ['satchida-work-suite', 'devops-security'],
      }),
      starter({
        title: 'Plan Execution Audit',
        description: 'Ground every plan step in repository files before editing.',
        inputs: ['plan file path or pasted plan', 'scope — audit only / audit and fix'],
        deliver:
          'each plan step mapped to the repository file and line that proves it, the steps that are already done or stale, and bounded atomic edits for the rest.',
        contract:
          'if no plan exists in the repository, ask which plan to audit rather than inventing one, and do not edit anything until I approve the edit list.',
        badge: 'Plan Supervisor',
        badgeKey: 'starters_badge_plan_supervisor',
        mcpServers: ['git-librechat'],
      }),
      starter({
        title: 'UI Component Build',
        description: 'Accessible React component with states and a test.',
        inputs: ['component or feature', 'target — web / mobile', 'design constraints'],
        deliver:
          'a modern, accessible interactive component in React/TypeScript with Tailwind, responsive behaviour, keyboard navigation, WCAG AA contrast verified with the accessibility tool, loading/empty/error states, and a focused component test.',
        contract: 'accessibility and states are part of the deliverable, not a follow-up.',
        badge: 'Vibe UI',
        badgeKey: 'starters_badge_vibe_ui',
        mcpServers: ['satchida-work-suite', 'accessibility-tools'],
      }),
      starter({
        title: 'Query Performance Review',
        description: 'EXPLAIN analysis, index design and a before/after plan.',
        inputs: ['slow query', 'schema and row counts', 'engine — Postgres / MySQL / SQLite'],
        deliver:
          'the execution-plan reading, selectivity math, a composite index design with column order justified, and a before/after plan diff.',
        contract:
          'scope note: analysis covers the plans I paste — the database itself is not queried; ask for EXPLAIN output if it is missing.',
        badge: 'Database',
        badgeKey: 'starters_badge_database',
        mcpServers: ['satchida-work-suite'],
      }),
    ],
  },
  {
    id: 'privacy_vault',
    label: '🔒 Sovereign Vault & Privacy',
    labelKey: 'starters_cat_privacy_vault',
    modes: ['Privacy'],
    starters: [
      starter({
        title: 'Offline Document Build',
        description: 'A deck, report or sheet produced fully on-device.',
        inputs: ['topic or title', 'format — pptx / pdf / xlsx', 'slide or page count'],
        deliver:
          'the finished document with title, sections, tables and figures, saved locally and linked for one-click download.',
        contract:
          'no cloud calls, no telemetry; the file is the deliverable, not an outline of one.',
        badge: 'Document Gen',
        badgeKey: 'starters_badge_document_gen',
        mcpServers: ['satchida-knowledge-vault'],
      }),
      starter({
        title: 'Vault Search',
        description: 'Private knowledge search with verbatim quotes and pages.',
        inputs: ['search query', 'vault or collection if known'],
        deliver:
          'the matching passages with document name, page or chunk reference and a verbatim quote, ranked by how directly they answer the query.',
        contract:
          'if nothing matches, state "no match found" — never paraphrase a passage and present it as a quote.',
        badge: 'Vault RAG',
        badgeKey: 'starters_badge_vault_rag',
        mcpServers: ['satchida-knowledge-vault'],
      }),
      starter({
        title: 'Confidential Strategy',
        description: 'Internal strategy draft, on-device, no telemetry.',
        inputs: ['initiative or launch', 'horizon', 'constraints'],
        deliver:
          'an internal strategic plan covering the bet, the sequence, the resourcing, the risks and the decision points, written for the people who will execute it.',
        contract:
          '100% on-device inference, zero telemetry, and no vendor or customer names beyond what I gave you.',
        badge: 'Zero Telemetry',
        badgeKey: 'starters_badge_zero_telemetry',
        mcpServers: ['satchida-knowledge-vault'],
      }),
      starter({
        title: 'Forensic Document Audit',
        description: 'Discrepancy table with page references and materiality.',
        inputs: ['documents or excerpt', 'materiality threshold', 'your side'],
        deliver:
          'a discrepancy table with page and section references, a stated materiality threshold, and the obligations the documents actually create.',
        contract:
          'list what was NOT reviewed, and close with "not a substitute for a qualified auditor or lawyer".',
        badge: 'Forensic Audit',
        badgeKey: 'starters_badge_forensic_audit',
        mcpServers: ['satchida-knowledge-vault'],
      }),
    ],
  },
  {
    id: 'motion_architecture',
    label: '🏛️ Floor Plans & Arch',
    labelKey: 'starters_cat_motion_architecture',
    group: 'arch_engineering',
    modes: ['Motion'],
    starters: [
      starter({
        title: '2D-to-3D Architectural Floor Plan',
        icon: '🏛️',
        description:
          '2D orthographic CAD walls & door arcs smoothly morphing into an extruded isometric 3D plan with toggleable layers',
        inputs: [
          'Building or Plot: e.g. 1,400 sq ft 3BHK Apartment or Modern Café',
          'Rooms & Zoning: e.g. Open Kitchen, Master Suite, Living Balcony, Study Nook',
          'Orientation & Palette: e.g. North-Facing Warm Minimalist Wood & Concrete',
        ],
        deliver:
          'Build a precision orthographic 2D architectural CAD blueprint (dimension ticks, sq-ft room labels, wall thickness, door swing arcs) that smoothly morphs into an isometric 3D extruded model with toggleable Furniture/Dimension layers and Top/Isometric/Walkthrough camera presets for [Building or Plot: e.g. 1,400 sq ft 3BHK Apartment or Modern Café] featuring [Rooms & Zoning: e.g. Open Kitchen, Master Suite, Living Balcony, Study Nook] styled in [Orientation & Palette: e.g. North-Facing Warm Minimalist Wood & Concrete].',
        contract: MOTION_CONTRACT,
        badge: 'CAD · 3D Floorplan',
        badgeKey: 'starters_badge_motion_arch_cad',
        engineTag: 'CAD · 3D',
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
        featured: true,
        mcpServers: ['satchida-motion', 'satchida-work-suite'],
      }),
      starter({
        title: 'Solar Sun-Path & Ventilation Sim',
        icon: '☀️',
        description:
          'Time-of-day solar shadow polygons, solstice switch, Vastu compass overlay, and natural cross-ventilation streams',
        inputs: [
          'Home or Office Layout & Plot Facing',
          'City / Climate: e.g. Bengaluru Tropical or Delhi Hot-Dry',
        ],
        deliver:
          'Create an architectural floor and cross-section daylight simulator with an interactive Time-of-Day slider (06:00–20:00), Summer/Winter Solstice toggle, real-time shadow polygons, directional compass/Vastu ring, and cross-ventilation airflow streamlines for [Home or Office Layout & Plot Facing] located in [City / Climate: e.g. Bengaluru Tropical or Delhi Hot-Dry].',
        contract: MOTION_CONTRACT,
        badge: 'Sun & Vastu Sim',
        badgeKey: 'starters_badge_motion_sun_path',
        engineTag: 'Daylight · Sim',
        keywords: ['vastu', 'sun', 'daylight', 'shadow', 'ventilation', 'airflow', 'architecture'],
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      }),
      starter({
        title: 'MEP & Structural X-Ray Layers',
        icon: '🏗️',
        description:
          'Interactive structural beam, electrical conduit, plumbing riser, and HVAC duct X-ray layer opacity switcher',
        inputs: [
          'Structure Type: e.g. 2-Storey Duplex Villa or Modular Clinic Wing',
          'System Focus: e.g. Graywater Plumbing, Drain Slopes & Solar Backup Wiring',
        ],
        deliver:
          'Generate an interactive building X-Ray cutaway explorer with opacity toggles for Structural Beams, Electrical Conduits, Plumbing Risers, and HVAC Ducts, plus clickable load and routing pins for [Structure Type: e.g. 2-Storey Duplex Villa or Modular Clinic Wing] prioritizing [System Focus: e.g. Graywater Plumbing, Drain Slopes & Solar Backup Wiring].',
        contract: MOTION_CONTRACT,
        badge: 'MEP X-Ray',
        badgeKey: 'starters_badge_motion_mep_xray',
        engineTag: 'X-Ray · SVG',
        keywords: ['mep', 'plumbing', 'hvac', 'electrical', 'structural', 'beams', 'blueprint'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Interior Elevation & Kelvin Lab',
        icon: '🛋️',
        description:
          'Wall elevation lighting tester (2700K warm to 5000K task) with material swatch swaps and clearance rulers',
        inputs: [
          'Room: e.g. U-Shaped Modular Kitchen or Studio Bedroom',
          'Material Palette & Lighting Mood',
        ],
        deliver:
          'Design an interactive interior wall elevation and lighting laboratory featuring a live Color Temperature slider (2700K Warm to 5000K Task), cabinetry and flooring swatch switchers, and ADA ergonomic clearance rulers for [Room: e.g. U-Shaped Modular Kitchen or Studio Bedroom] styled with [Material Palette & Lighting Mood].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion'],
      }),
    ],
  },
  {
    id: 'motion_drones',
    label: '🚁 Drones & UAV',
    labelKey: 'starters_cat_motion_drones',
    group: 'arch_engineering',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'Multirotor TWR & Propulsion Lab',
        icon: '🚁',
        description:
          'Exploded-to-assembled 3D multirotor frame with CW/CCW prop wash rings, throttle slider, and verified hover math',
        inputs: [
          'Airframe: e.g. 5-inch FPV Freestyle Quad or 10kg Agri-Sprayer Hexacopter',
          'Specs: All-up weight (g), Motor thrust (g), Propeller size & LiPo S/mAh',
        ],
        deliver:
          'Compute thrust-to-weight ratio, hover current, and safe endurance first using drone_aerodynamics_and_propulsion, then build an interactive exploded-to-assembled 3D/SVG multirotor simulation with counter-rotating CW/CCW prop wash rings, Center-of-Gravity marker, and a live Throttle slider (0–100%) for [Airframe: e.g. 5-inch FPV Freestyle Quad or 10kg Agri-Sprayer Hexacopter] configured with [Specs: All-up weight (g), Motor thrust (g), Propeller size & LiPo S/mAh].',
        contract: MOTION_CONTRACT,
        badge: 'UAV Propulsion',
        badgeKey: 'starters_badge_motion_uav_prop',
        engineTag: 'Three.js · UAV',
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
        featured: true,
        mcpServers: ['satchida-motion', 'satchida-maker-engineering'],
      }),
      starter({
        title: 'Drone SLAM & Waypoint Mission',
        icon: '📡',
        description:
          'Terrain corridor with LiDAR cone, no-fly geofence cylinders, wind-drift vector disturbance, and PID stabilization',
        inputs: [
          'Mission Profile: e.g. Warehouse Inventory Scan, Forest Search & Rescue, or Bridge Inspection',
          'Obstacle or Wind Constraints',
        ],
        deliver:
          'Animate an autonomous UAV mission corridor with a rotating 3D LiDAR detection cone, dynamic geofence/no-fly cylinders, wind-drift vector disturbance toggle, PID attitude telemetry plot, and low-battery RTH trigger for [Mission Profile: e.g. Warehouse Inventory Scan, Forest Search & Rescue, or Bridge Inspection] navigating [Obstacle or Wind Constraints].',
        contract: MOTION_CONTRACT,
        badge: 'Flight Pathfinding',
        badgeKey: 'starters_badge_motion_uav_slam',
        engineTag: 'SLAM · 3D',
        keywords: ['drone', 'slam', 'lidar', 'geofence', 'waypoint', 'pid', 'rth', 'autonomous'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Airfoil Lift, Stall & Vortex Lab',
        icon: '🌬️',
        description:
          'Interactive wind-tunnel streamline particle solver with Angle-of-Attack slider (-10° to +25°) and stall vortices',
        inputs: [
          'Airfoil or Aircraft: e.g. NACA 2412 Survey Glider or Quad Tilt-Rotor Transition',
          'Flight Regime: Takeoff / Cruise / High-AoA Stall',
        ],
        deliver:
          'Build an interactive wind-tunnel streamline particle solver around a cambered airfoil or VTOL tilt-rotor with a live Angle-of-Attack slider (-10 to +25 deg) visualizing laminar flow breakdown into stall vortices plus live Lift/Drag vectors for [Airfoil or Aircraft: e.g. NACA 2412 Survey Glider or Quad Tilt-Rotor Transition] across [Flight Regime: Takeoff / Cruise / High-AoA Stall].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      }),
    ],
  },
  {
    id: 'motion_civil_logistics',
    label: '🌉 Civil & Supply Chains',
    labelKey: 'starters_cat_motion_civil_logistics',
    group: 'arch_engineering',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'Bridge Truss Stress & Load Sim',
        icon: '🌉',
        description:
          'Color-coded Tension vs Compression truss members bending dynamically as truck load moves across spans',
        inputs: [
          'Bridge Structure: e.g. 120m Steel Warren Truss or Cable-Stayed River Flyover',
          'Load Scenario: e.g. Heavy Freight Convoy + Lateral Gust',
        ],
        deliver:
          'Verify beam stress formulas with mechanical_gear_and_stress, then create a precision vector structural bridge simulator with Tension (cyan) vs Compression (coral) force color-coding, span deflection curves, and a moving Truck Weight & Speed slider for [Bridge Structure: e.g. 120m Steel Warren Truss or Cable-Stayed River Flyover] under [Load Scenario: e.g. Heavy Freight Convoy + Lateral Gust].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-maker-engineering'],
      }),
      starter({
        title: 'Supply & Cold-Chain Digital Twin',
        icon: '🚢',
        description:
          'End-to-end spatial corridor tracing factory AGV, port cranes, rail/vessel, and bottleneck fault injection',
        inputs: [
          'Supply Network / Cargo: e.g. -20C Vaccine Cold-Chain or EV Battery Pack Supply',
          'Disruption Scenario: e.g. Port Congestion Reroute',
        ],
        deliver:
          'Choreograph a spatial logistics corridor camera flight tracing Raw Material -> Factory AGV -> Smart Port Crane -> Vessel/Rail -> Cold-Chain Truck with live node buffer bars, SLA clock, and a Bottleneck Fault Injection button for [Supply Network / Cargo: e.g. -20C Vaccine Cold-Chain or EV Battery Pack Supply] testing [Disruption Scenario: e.g. Port Congestion Reroute].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-work-suite'],
      }),
      starter({
        title: 'Smart Traffic & EV Microgrid Flow',
        icon: '🚦',
        description:
          'Adaptive traffic light phase timing simulator with emergency green-wave override and EV charger queue meters',
        inputs: ['City Junction / Campus Zone', 'Peak Vehicle Volume & Solar Buffer Target'],
        deliver:
          'Simulate an interactive urban intersection & EV fast-charging microgrid with queue-length gauges, adaptive signal timing sliders, and an emergency ambulance green-corridor toggle for [City Junction / Campus Zone] balancing [Peak Vehicle Volume & Solar Buffer Target].',
        contract: MOTION_CONTRACT,
        badge: 'Smart Mobility',
        badgeKey: 'starters_badge_motion_traffic',
        engineTag: 'Flow · Sim',
        keywords: ['traffic', 'intersection', 'ev', 'smart city', 'urban', 'signals', 'microgrid'],
        mcpServers: ['satchida-motion'],
      }),
    ],
  },
  {
    id: 'motion_robotics',
    label: '🤖 Robotics & Kinematics',
    labelKey: 'starters_cat_motion_robotics',
    group: 'robotics_how',
    modes: ['Motion'],
    starters: [
      starter({
        title: '6-DOF Robotic Arm IK & Torque Lab',
        icon: '🦾',
        description:
          'Articulated robotic arm with draggable target crosshair (live IK solver), J1–J6 sliders, and reach envelope',
        inputs: [
          'Robot Config: e.g. 6-Axis Articulated Welder, 4-Axis SCARA Pick-and-Place, or Surgical Arm',
          'Payload & Task: e.g. 5kg Gearbox Assembly',
        ],
        deliver:
          'Validate joint torque and gear reduction via mechanical_gear_and_stress, then build an interactive articulated robotic arm with a draggable 2D/3D target crosshair (live inverse kinematics solver), individual Joint angle sliders (J1–J6), workspace reach envelope arc, and telemetry HUD for [Robot Config: e.g. 6-Axis Articulated Welder, 4-Axis SCARA Pick-and-Place, or Surgical Arm] handling [Payload & Task: e.g. 5kg Gearbox Assembly].',
        contract: MOTION_CONTRACT,
        badge: 'Arm Kinematics',
        badgeKey: 'starters_badge_motion_arm_ik',
        engineTag: 'Three.js · IK',
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
        featured: true,
        mcpServers: ['satchida-motion', 'satchida-maker-engineering'],
      }),
      starter({
        title: 'Rover SLAM & LiDAR Maze Mapper',
        icon: '🤖',
        description:
          'Split-screen rover emitting 360° raycast LiDAR beams alongside a real-time occupancy grid and A* path planner',
        inputs: [
          'Environment: e.g. Hospital Delivery Corridor, Mars Crater Field, or Autonomous Warehouse',
          'Planner Strategy',
        ],
        deliver:
          'Construct a synchronized split-screen robotics SLAM simulator: Left shows a differential-drive rover sweeping 360-degree raycast LiDAR beams around obstacles; Right builds the real-time occupancy grid and A*/RRT* planned path with Pause and Shuffle Obstacles controls for [Environment: e.g. Hospital Delivery Corridor, Mars Crater Field, or Autonomous Warehouse] comparing [Planner Strategy].',
        contract: MOTION_CONTRACT,
        badge: 'SLAM Navigation',
        badgeKey: 'starters_badge_motion_rover_slam',
        engineTag: 'LiDAR · Split',
        keywords: ['rover', 'slam', 'lidar', 'astar', 'rrt', 'maze', 'occupancy', 'amr'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Factory Cell & PLC State Machine',
        icon: '🏭',
        description:
          'Synchronized conveyor, optical proximity sensors, diverter piston, live state graph, and E-Stop test toggle',
        inputs: [
          'Workcell Line: e.g. EV Cell Sorting & Weld, Beverage Cap Inspector, or Automated Pharmacy',
          'Cycle Rate & Fault Condition',
        ],
        deliver:
          'Design an automated industrial conveyor workcell synchronized with optical proximity sensors, pneumatic diverter pistons, robotic gripper pick cycles, a live highlighted PLC state-transition graph, OEE counter, and Emergency E-Stop toggle for [Workcell Line: e.g. EV Cell Sorting & Weld, Beverage Cap Inspector, or Automated Pharmacy] targeting [Cycle Rate & Fault Condition].',
        contract: MOTION_CONTRACT,
        badge: 'PLC Automation',
        badgeKey: 'starters_badge_motion_plc',
        engineTag: 'State · Sim',
        keywords: ['plc', 'factory', 'conveyor', 'oee', 'automation', 'gripper', 'industrial'],
        mcpServers: ['satchida-motion'],
      }),
    ],
  },
  {
    id: 'motion_how_it_works',
    label: '⚙️ How Things Work',
    labelKey: 'starters_cat_motion_how_it_works',
    group: 'robotics_how',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'Engine & Drivetrain Cutaway Lab',
        icon: '⚙️',
        description:
          'Synchronized cutaway animation with RPM throttle slider (600–7000 RPM), spark/exhaust particles, and phase gauges',
        inputs: [
          'Machine: e.g. 4-Stroke Otto ICE Engine, High-Bypass Turbofan Jet, Brushless EV Traction Motor, or Wankel Rotary',
          'View Style: Isometric Cutaway / Thermal Stress',
        ],
        deliver:
          'Create an intricate synchronized mechanical cutaway animation featuring an interactive RPM Throttle slider (600–7000 RPM), intake/compression/power/exhaust phase indicators, thermal spark/airflow particle bursts, and crank-angle telemetry explaining [Machine: e.g. 4-Stroke Otto ICE Engine, High-Bypass Turbofan Jet, Brushless EV Traction Motor, or Wankel Rotary] in [View Style: Isometric Cutaway / Thermal Stress].',
        contract: MOTION_CONTRACT,
        badge: 'Engine Cutaway',
        badgeKey: 'starters_badge_motion_engine',
        engineTag: 'Cutaway · RPM',
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
        featured: true,
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Gearbox, Hydraulics & Lever Lab',
        icon: '🔧',
        description:
          'Meshing involute gear teeth / hydraulic pistons with RPM & load sliders, torque math, and exploded scrubber',
        inputs: [
          'Mechanism: e.g. Planetary Epicyclic Gearbox, Car Bevel Differential, Hydraulic Disc Brake, or Mechanical Watch Escapement',
          'Ratio / Pressure Target',
        ],
        deliver:
          'Calculate exact gear ratios, torque multiplication, and Pascal pressure using mechanical_gear_and_stress, then animate meshing involute gears or hydraulic cylinders with Input RPM & Load sliders plus an Exploded Assembly scrubber for [Mechanism: e.g. Planetary Epicyclic Gearbox, Car Bevel Differential, Hydraulic Disc Brake, or Mechanical Watch Escapement] at [Ratio / Pressure Target].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-maker-engineering'],
      }),
      starter({
        title: 'Optics, Lens & Laser Ray-Tracing',
        icon: '🔭',
        description:
          'Live light-ray refraction through multi-element glass lenses with f-stop Aperture and Focal Distance sliders',
        inputs: [
          'Optical System: e.g. 50mm Camera Prime Lens, Reflecting Astronomical Telescope, Human Eye Myopia Correction, or Fiber-Optic Total Internal Reflection',
        ],
        deliver:
          'Simulate geometric ray-tracing through curved glass lenses or mirrors with interactive Aperture (f/1.4 to f/16) and Focal Distance sliders visualizing focal plane convergence, bokeh spread, and dispersion for [Optical System: e.g. 50mm Camera Prime Lens, Reflecting Astronomical Telescope, Human Eye Myopia Correction, or Fiber-Optic Total Internal Reflection].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      }),
      starter({
        title: 'Inside Everyday Appliances & Tech',
        icon: '🔋',
        description:
          'Peel-away cutaway revealing lithium-ion migration, refrigerant heat loops, magnetron microwaves, or ANC cancellation',
        inputs: [
          'Device: e.g. Microwave Oven Magnetron, Inverter Refrigerator Compressor, Active Noise-Cancelling Headphones, or Lithium-Ion Battery Cell',
        ],
        deliver:
          'Build a multi-layer peeled cutaway revealing invisible working physics—such as ion intercalation, phase-change cooling loops, acoustic wave cancellation, or RF heating—with toggleable housing layers and annotated callouts for [Device: e.g. Microwave Oven Magnetron, Inverter Refrigerator Compressor, Active Noise-Cancelling Headphones, or Lithium-Ion Battery Cell].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion'],
      }),
    ],
  },
  {
    id: 'motion_electronics',
    label: '🔌 Circuits & AI Silicon',
    labelKey: 'starters_cat_motion_electronics',
    group: 'robotics_how',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'Circuit Simulator & Oscilloscope',
        icon: '🔌',
        description:
          'Animated current pulse dots along schematics synced with R/C/Gain sliders and dual-channel oscilloscope traces',
        inputs: [
          'Circuit: e.g. 555 Timer Astable Blinker, Inverting Op-Amp, Full-Wave Bridge Rectifier, or Buck DC-DC Converter',
          'Voltage / Frequency Spec',
        ],
        deliver:
          'Compute RC/RLC timing and component values using electronics_circuit_designer, then animate glowing current flow along a crisp vector schematic paired with interactive R/C/Gain sliders and a live dual-channel Oscilloscope waveform for [Circuit: e.g. 555 Timer Astable Blinker, Inverting Op-Amp, Full-Wave Bridge Rectifier, or Buck DC-DC Converter] targeting [Voltage / Frequency Spec].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-maker-engineering'],
      }),
      starter({
        title: 'CPU Pipeline & LLM AI Silicon',
        icon: '🧠',
        description:
          'Clock-stepped datapath showing ALU/logic signal pulses OR Transformer Q-K-V attention & KV-cache memory meters',
        inputs: [
          'Architecture: e.g. 4-Bit Ripple-Carry Adder, RISC-V 5-Stage Pipeline, or LLM Self-Attention & KV-Cache',
        ],
        deliver:
          'Construct a synchronized clock-stepped compute visualizer with Single-Step and Auto-Clock controls tracing gate/pipeline execution or Transformer Q-K-V self-attention & KV-cache memory meters (verified with llm_vram_and_compute_estimator where AI applies) for [Architecture: e.g. 4-Bit Ripple-Carry Adder, RISC-V 5-Stage Pipeline, or LLM Self-Attention & KV-Cache].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-ai-engineer'],
      }),
      starter({
        title: 'Solar MPPT & EV Battery BMS Lab',
        icon: '⚡',
        description:
          'PV string DC -> MPPT tracker -> BMS cell balancing -> pure sine inverter trace with Irradiance & Load sliders',
        inputs: [
          'System: e.g. 5kW Hybrid Home Solar + LFP Pack or 800V EV Fast Charger',
          'Cloud / Grid Outage Scenario',
        ],
        deliver:
          'Design an interactive renewable power-electronics schematic with Solar Irradiance & Home Load sliders tracing PV DC -> MPPT duty-cycle tracking -> BMS cell balance bars -> pure sine-wave grid output for [System: e.g. 5kW Hybrid Home Solar + LFP Pack or 800V EV Fast Charger] under [Cloud / Grid Outage Scenario].',
        contract: MOTION_CONTRACT,
        badge: 'Power Electronics',
        badgeKey: 'starters_badge_motion_mppt',
        engineTag: 'MPPT · Sim',
        keywords: ['solar', 'mppt', 'inverter', 'bms', 'ev', 'charger', 'grid', 'battery'],
        mcpServers: ['satchida-motion', 'satchida-maker-engineering'],
      }),
    ],
  },
  {
    id: 'motion_education',
    label: '🎓 STEM, Chem & Coding',
    labelKey: 'starters_cat_motion_education',
    group: 'stem_tech',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'Physics Forces & Wave-Field Lab',
        icon: '⚛️',
        description:
          'Interactive force vectors, particle waves, tunable Mass/Field/Slit sliders, and verified quantitative readouts',
        inputs: [
          'Physics Topic: e.g. Double-Slit Quantum Interference, Orbital Escape Velocity, or Faraday Electromagnetic Induction',
          'Student Level: e.g. CBSE Class 12 / JEE / University',
        ],
        deliver:
          'Verify quantitative physics relations using scientific_physics_solver, then simulate an interactive physics experiment with live vector force arrows, particle wave fields, tunable parameter sliders (Mass / Wavelength / Field), and Play/Reset controls for [Physics Topic: e.g. Double-Slit Quantum Interference, Orbital Escape Velocity, or Faraday Electromagnetic Induction] at [Student Level: e.g. CBSE Class 12 / JEE / University].',
        contract: MOTION_CONTRACT,
        badge: 'Physics Sim',
        badgeKey: 'starters_badge_motion_physics',
        engineTag: 'Physics · Lab',
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
        featured: true,
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      }),
      starter({
        title: 'Dynamic Math & Calculus Proofs',
        icon: '📐',
        description:
          'SVG geometric shear/morph proofs with interactive Fourier harmonic N-sliders and tangent derivative steppers',
        inputs: [
          'Theorem or Concept: e.g. Pythagorean Area Shear Proof, Fourier Square-Wave Harmonics, or Gradient Descent Optimization',
        ],
        deliver:
          'Verify symbolic math derivations using solve_symbolic_math or calculus_derivative_integral, then build a smooth geometric SVG morphing proof with interactive Secant-to-Tangent or Fourier N-Harmonic sliders (N=1..15) and KaTeX equation highlights for [Theorem or Concept: e.g. Pythagorean Area Shear Proof, Fourier Square-Wave Harmonics, or Gradient Descent Optimization].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      }),
      starter({
        title: 'Chemistry Orbitals & Kinetics',
        icon: '🧪',
        description:
          'Balanced molecular orbital covalent bonding, activation-energy catalyst curve slider, or pH titration drop sim',
        inputs: [
          'Reaction or Molecule: e.g. SN2 Nucleophilic Attack, Benzene Pi Orbitals, NaOH + HCl Titration, or Haber Ammonia Synthesis',
          'Orbital / Equilibrium Focus',
        ],
        deliver:
          'Balance stoichiometry and verify molar ratios with balance_chemical_equation, then animate 3D/2D electron orbital hybridization, bond formation arrows, an Activation Energy barrier chart with Catalyst & Temperature sliders, or an interactive burette pH titration curve for [Reaction or Molecule: e.g. SN2 Nucleophilic Attack, Benzene Pi Orbitals, NaOH + HCl Titration, or Haber Ammonia Synthesis] focusing on [Orbital / Equilibrium Focus].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      }),
      starter({
        title: 'Cellular Biology Micro-Journey',
        icon: '🧬',
        description:
          'Microscopic 3D flythrough across cell membranes and DNA forks with Organelle X-Ray labels and Phase Stepper',
        inputs: [
          'Biological Process: e.g. DNA Replication Fork, CRISPR-Cas9 Target Cleavage, Photosynthesis ATP Synthase, or Synapse Neurotransmission',
        ],
        deliver:
          'Animate a microscopic 3D biological spatial flythrough showing membranes, enzymes, and genetic complexes with toggleable Organelle X-Ray callouts and a manual Phase Stepper (Pause / Next Phase) for [Biological Process: e.g. DNA Replication Fork, CRISPR-Cas9 Target Cleavage, Photosynthesis ATP Synthase, or Synapse Neurotransmission].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Algorithm & Recursion Tracer',
        icon: '💻',
        description:
          'Steppable array/graph visualizer with custom input editor, live call-stack frames, and Big-O swap counters',
        inputs: [
          'Algorithm: e.g. QuickSort Partitioning, Dijkstra Priority Queue, DFS/BFS Maze Solver, or Dynamic Programming Knapsack',
        ],
        deliver:
          'Build a deterministic interactive algorithm & code tracer featuring an editable custom input array/graph, Step Forward/Back & Speed buttons, synchronized visual swap/path canvas, and a live Call-Stack / Heap Pointer / Big-O telemetry panel for [Algorithm: e.g. QuickSort Partitioning, Dijkstra Priority Queue, DFS/BFS Maze Solver, or Dynamic Programming Knapsack].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      }),
    ],
  },
  {
    id: 'motion_networks',
    label: '🌐 Networks & Cyber',
    labelKey: 'starters_cat_motion_networks',
    group: 'stem_tech',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'DNS, TCP & TLS 1.3 Packet Journey',
        icon: '🌐',
        description:
          'Flying inspectable network packets across Client/Resolver/CDN/Origin with Latency & Packet-Drop fault sliders',
        inputs: [
          'Protocol Flow: e.g. HTTPS DNS + TCP + TLS 1.3 0-RTT, BGP Anycast Routing, WebSocket Upgrade, or OAuth2 PKCE Exchange',
          'Condition: Healthy vs Packet Drop',
        ],
        deliver:
          'Animate an end-to-end network swimlane & sequence flight where any flying packet can be paused to inspect frame headers, equipped with a Latency & Packet-Loss slider plus Retransmit animation for [Protocol Flow: e.g. HTTPS DNS + TCP + TLS 1.3 0-RTT, BGP Anycast Routing, WebSocket Upgrade, or OAuth2 PKCE Exchange] under [Condition: Healthy vs Packet Drop].',
        contract: MOTION_CONTRACT,
        badge: 'Packet Flow',
        badgeKey: 'starters_badge_motion_packet',
        engineTag: 'Network · Lab',
        keywords: ['network', 'tcp', 'dns', 'tls', 'https', 'bgp', 'quic', 'packet', 'handshake'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'K8s Autoscaling & Failover Sim',
        icon: '☸️',
        description:
          'Isometric node/pod cluster with load pulses and interactive "Spike Load / Kill Node" chaos engineering controls',
        inputs: [
          'Architecture: e.g. Kubernetes HPA Microservices, Kafka Partition Rebalance, or Multi-Region Database Failover',
          'Traffic Target',
        ],
        deliver:
          'Create an isometric distributed cluster showing load-balancer traffic pulses, CPU/memory gauge bars, HPA pod scaling animations, and interactive "Spike Traffic" and "Kill Primary Node" chaos buttons for [Architecture: e.g. Kubernetes HPA Microservices, Kafka Partition Rebalance, or Multi-Region Database Failover] under [Traffic Target].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Kill-Chain vs Zero-Trust Defense',
        icon: '🛡️',
        description:
          'Side-by-side Red-Team intrusion kill-chain neutralized by Blue-Team mTLS, WAF sanitization, and hardware MFA',
        inputs: [
          'Threat Scenario: e.g. Credential Phishing vs Hardware Passkey MFA, Volumetric DDoS Mitigation, or SQL Injection Parameterization',
        ],
        deliver:
          'Contrast an attack kill-chain against hardened defense side-by-side: animate intrusion payloads meeting WAF sanitization, mTLS verification, micro-segmentation, and EDR containment shields with clear stage callouts for [Threat Scenario: e.g. Credential Phishing vs Hardware Passkey MFA, Volumetric DDoS Mitigation, or SQL Injection Parameterization].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion'],
      }),
    ],
  },
  {
    id: 'motion_earth_space',
    label: '🌌 Space, Earth & Sound',
    labelKey: 'starters_cat_motion_earth_space',
    group: 'stem_tech',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'Orbital & Hohmann Transfer Sim',
        icon: '🛰️',
        description:
          '2D/3D planetary gravity well with Δv thruster burns, live apogee/perigee telemetry, and time-warp scrubber',
        inputs: [
          'Mission: e.g. Earth-to-Mars Hohmann Transfer, Chandrayaan Trans-Lunar Injection, or JWST L2 Halo Orbit',
          'Maneuver Controls',
        ],
        deliver:
          'Verify orbital period and velocity parameters with scientific_physics_solver, then create a 3D/2D orbital mechanics simulator featuring delta-v burn ignition pulses, live apogee/perigee & velocity HUD, and a Time-Warp / Launch Window scrubber for [Mission: e.g. Earth-to-Mars Hohmann Transfer, Chandrayaan Trans-Lunar Injection, or JWST L2 Halo Orbit] highlighting [Maneuver Controls].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      }),
      starter({
        title: 'Tectonics, Cyclones & Clean Grid',
        icon: '🌍',
        description:
          'Geological crust subduction cutaway, cyclone Coriolis wind bands, or solar-wind-battery grid dispatch flow',
        inputs: [
          'Earth System: e.g. Himalayan Tectonic Collision, Tropical Cyclone Eye & Storm Surge, or 24-Hour Solar-Wind-Battery Dispatch',
        ],
        deliver:
          'Construct an interactive Earth-science cross-section simulator with Time/Intensity sliders showing fault-line crust subduction stress, atmospheric Coriolis cyclone streamlines, or clean microgrid load balancing for [Earth System: e.g. Himalayan Tectonic Collision, Tropical Cyclone Eye & Storm Surge, or 24-Hour Solar-Wind-Battery Dispatch].',
        contract: MOTION_CONTRACT,
        badge: 'Earth & Climate',
        badgeKey: 'starters_badge_motion_earth',
        engineTag: 'Earth · Sim',
        keywords: ['earth', 'tectonic', 'cyclone', 'climate', 'earthquake', 'weather', 'renewable'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Standing Waves & Music Acoustics',
        icon: '🎵',
        description:
          'Vibrating string/pipe harmonics synced with FFT overtone meters, Circle-of-Fifths ring, and optional mute audio',
        inputs: [
          'Acoustics Topic: e.g. Plucked Guitar Overtones & Timbre, Noise-Cancellation Phase Inversion, or Jazz ii-V-I Chord Voice Leading',
        ],
        deliver:
          'Build an acoustics & music visualizer combining vibrating standing-wave nodes, live FFT overtone bar charts, interactive Harmonic / Chord sliders, and an optional muted-by-default Web Audio playback toggle for [Acoustics Topic: e.g. Plucked Guitar Overtones & Timbre, Noise-Cancellation Phase Inversion, or Jazz ii-V-I Chord Voice Leading].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion'],
      }),
    ],
  },
  {
    id: 'motion_history_kids',
    label: '🏛️ History & Early Learning',
    labelKey: 'starters_cat_motion_history_kids',
    group: 'stem_tech',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'Historical Atlas & Trade Timeline',
        icon: '🗺️',
        description:
          'Interactive century-scrubber map tracing trade routes, empire boundaries, and era artifact discoveries',
        inputs: [
          'Historical Era or Topic: e.g. Indus Valley & Maritime Spice Trade, Golden Age Indian Mathematics, Silk Road Caravans, or Space Race Milestones',
        ],
        deliver:
          'Choreograph a stylized SVG/spatial map flyover paired with an interactive Century Scrubber slider animating maritime & overland trade routes, city beacons, and era artifact cards for [Historical Era or Topic: e.g. Indus Valley & Maritime Spice Trade, Golden Age Indian Mathematics, Silk Road Caravans, or Space Race Milestones].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Kids Fractions & Phonics Play',
        icon: '🧩',
        description:
          'Oversized playful tactile counters, interactive fraction pizza slices, and bouncing frog number-line hops',
        inputs: [
          'Concept & Age Group: e.g. Equivalent Fractions Age 8, Phonetic Blending Rhymes Age 6, or Place-Value Blocks Age 7',
        ],
        deliver:
          'Create an oversized, joyful, child-friendly interactive learning playground with tactile click/step buttons, bouncy visual counters, colorful fraction pizza slices, and hopping number-line animations for [Concept & Age Group: e.g. Equivalent Fractions Age 8, Phonetic Blending Rhymes Age 6, or Place-Value Blocks Age 7].',
        contract: MOTION_CONTRACT,
        badge: 'Kids Playbook',
        badgeKey: 'starters_badge_motion_kids',
        engineTag: 'K-5 · Playful',
        keywords: ['kids', 'children', 'fractions', 'phonics', 'counting', 'school', 'math games'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Vedic Astronomy & Sundial Lab',
        icon: '🔭',
        description:
          'Jantar Mantar shadow-angle sundial and 27-Nakshatra lunar ecliptic wheel with Day-of-Year & Latitude sliders',
        inputs: [
          'Subject: e.g. Equinox & Solstice Shadow Geometry, Lunar Nakshatra Orbit Wheel, or Classical Indian Trigonometry & Sine Chords',
        ],
        deliver:
          'Animate celestial shadow angles across an interactive Samrat Yantra sundial and 27-Nakshatra ecliptic wheel with Day-of-Year and Latitude sliders for [Subject: e.g. Equinox & Solstice Shadow Geometry, Lunar Nakshatra Orbit Wheel, or Classical Indian Trigonometry & Sine Chords].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-stem-study'],
      }),
    ],
  },
  {
    id: 'motion_executive',
    label: '📊 Executive & Metrics',
    labelKey: 'starters_cat_motion_executive',
    group: 'business_creative',
    modes: ['Motion'],
    starters: [
      starter({
        title: '3D Executive QBR & Revenue Deck',
        icon: '📊',
        description:
          'Spatial 3D camera sweep across revenue charts, counting KPI tickers, and Base/Bull scenario toggles',
        inputs: ['Company Name & Quarter', 'Key Metrics: Revenue, NRR & Growth Highlights'],
        deliver:
          'Generate an animated 3D executive report with 60fps camera pan, kinetic SVG charts, interactive hover tooltips, KPI counters, and a Scenario Toggle (Conservative / Base / Bull) for [Company Name & Quarter] highlighting [Key Metrics: Revenue, NRR & Growth Highlights].',
        contract: MOTION_CONTRACT,
        badge: 'Executive',
        badgeKey: 'starters_badge_motion_executive',
        engineTag: '3D · KPI',
        keywords: ['executive', 'qbr', 'revenue', 'boardroom', 'kpi', 'growth', 'metrics'],
        featured: true,
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Investor Pitch & Market Traction',
        icon: '🚀',
        description:
          'High-energy 3D glass deck with concentric TAM/SAM/SOM rings, cohort retention curves, and unit economics',
        inputs: ['Startup Name & Value Proposition', 'Traction Milestones & Capital Ask'],
        deliver:
          'Build a high-energy kinetic investor pitch presentation with 3D perspective depth, glowing glass cards, animated TAM/SAM/SOM rings, and unit economics counters for [Startup Name & Value Proposition] detailing [Traction Milestones & Capital Ask].',
        contract: MOTION_CONTRACT,
        badge: 'Investor Pitch',
        badgeKey: 'starters_badge_motion_pitch',
        engineTag: 'Spatial · Deck',
        keywords: ['investor', 'pitch', 'startup', 'tam', 'sam', 'ltv', 'traction', 'fundraising'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Strategic Milestone Roadmap',
        icon: '🗺️',
        description:
          'Continuous forward 3D timeline track through phased deliverables, dependency connectors, and owner pills',
        inputs: ['Initiative / Product Roadmap', 'Phase Windows: e.g. Q1–Q4 Launch Gates'],
        deliver:
          'Design an immersive 3D timeline camera flight navigating through phased strategic milestones, team ownership pills, and dependency lines for [Initiative / Product Roadmap] spanning [Phase Windows: e.g. Q1–Q4 Launch Gates].',
        contract: MOTION_CONTRACT,
        badge: 'Milestone Roadmap',
        badgeKey: 'starters_badge_motion_roadmap',
        engineTag: 'Timeline · 3D',
        keywords: ['roadmap', 'strategy', 'milestones', 'q1', 'q4', 'deliverables', 'executive'],
        mcpServers: ['satchida-motion'],
      }),
    ],
  },
  {
    id: 'motion_productivity',
    label: '💼 Professional & SOPs',
    labelKey: 'starters_cat_motion_productivity',
    group: 'business_creative',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'Animated Workflow & SOP Replay',
        icon: '📋',
        description:
          'Pulsing swimlane diagram guiding teams through handoffs, decision gates, SLAs, and Pause/Step controls',
        inputs: [
          'Business Process: e.g. Enterprise Client Onboarding, Change Advisory Review, or Procurement Sign-Off',
          'Handoff Teams & SLAs',
        ],
        deliver:
          'Construct an interactive animated corporate SOP diagram with glowing node transitions, decision branches, SLA clocks, and Pause/Next-Gate stepping for [Business Process: e.g. Enterprise Client Onboarding, Change Advisory Review, or Procurement Sign-Off] detailing [Handoff Teams & SLAs].',
        contract: MOTION_CONTRACT,
        badge: 'Workflow SOP',
        badgeKey: 'starters_badge_motion_sop',
        engineTag: 'Flow · Step',
        keywords: ['sop', 'workflow', 'onboarding', 'approval', 'process', 'sla', 'operations'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'SaaS Unit Economics & Runway Lab',
        icon: '💹',
        description:
          'Interactive Price, Churn %, and CAC sliders dynamically re-animating payback period & 36-month ARR runway',
        inputs: ['Business / Product Tier', 'Baseline & Expansion Assumptions'],
        deliver:
          'Build an interactive business unit-economics simulator with live sliders for Monthly ARPA, Churn %, Gross Margin %, and CAC that recalculate and animate LTV:CAC ratio, CAC payback months, and a 36-month ARR sensitivity curve for [Business / Product Tier] modeling [Baseline & Expansion Assumptions].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-work-suite'],
      }),
      starter({
        title: 'Incident Postmortem & SLA Replay',
        icon: '🚨',
        description:
          'Interactive timeline scrubber tracing Alert Trigger -> Blast Radius -> Mitigation -> Follow-up Actions',
        inputs: ['Incident Summary & Impacted Services'],
        deliver:
          'Create an objective, blameless incident postmortem replay combining a synchronized latency graph, cascading service blast-radius map, interactive Phase Scrubber (Detection -> Triage -> Mitigation -> Resolution), and hardened action items for [Incident Summary & Impacted Services].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Sprint Velocity & Gantt Timeline',
        icon: '🏃',
        description:
          'Burndown velocity curve sweeps, critical-path Gantt dependencies, epic highlights, and team shoutouts',
        inputs: ['Sprint or Program Name', 'Dates, Velocity Stats & Key Deliverables'],
        deliver:
          'Produce an upbeat sprint retrospective and critical-path Gantt timeline animation with burndown velocity curves, critical dependency highlights, and delivered feature cards for [Sprint or Program Name] covering [Dates, Velocity Stats & Key Deliverables].',
        contract: MOTION_CONTRACT,
        badge: 'Sprint & Gantt',
        badgeKey: 'starters_badge_motion_retro',
        engineTag: 'Agile · Gantt',
        keywords: ['sprint', 'agile', 'retrospective', 'gantt', 'burndown', 'velocity', 'pmo'],
        mcpServers: ['satchida-motion'],
      }),
    ],
  },
  {
    id: 'motion_kinetic',
    label: '⚡ Kinetic Typography',
    labelKey: 'starters_cat_motion_kinetic',
    group: 'business_creative',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'Kinetic Typography Manifesto',
        icon: '⚡',
        description:
          'High-impact rhythmic word staggers, spatial camera punch-ins, beat markers, and font-style switcher',
        inputs: ['Core Message / Keynote Quote', 'Mood & Color Palette'],
        deliver:
          'Create a dynamic kinetic typography motion graphic with staggered word choreography, bold camera push-throughs, visual beat markers, and a Typography Theme Switcher (Editorial Serif / Brutalist Mono / Broadcast Sans) for [Core Message / Keynote Quote] in [Mood & Color Palette].',
        contract: MOTION_CONTRACT,
        badge: 'Kinetic Speech',
        badgeKey: 'starters_badge_motion_kinetic',
        engineTag: 'Kinetic · 60fps',
        keywords: ['kinetic', 'typography', 'speech', 'manifesto', 'keynote', 'quotes', 'text'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Distributed Systems & API Flow',
        icon: '🧩',
        description:
          'Interactive 3D particle simulation tracing API gateways, async queues, caches, and failover flows',
        inputs: ['System Architecture / Pipeline Topic', 'Key Services'],
        deliver:
          'Build an interactive 3D spatial explainer illustrating request routing, microservice handshakes, queue backpressure, and Healthy vs Latency-Spike toggles for [System Architecture / Pipeline Topic] covering [Key Services].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Book & Mental-Model Summary',
        icon: '📚',
        description:
          'Chapter-by-chapter animated digest morphing mental models smoothly between Venn, matrix, and quote cards',
        inputs: ['Book Title / Paper / Framework', '3 Core Takeaways'],
        deliver:
          'Transform a non-fiction book, whitepaper, or strategy thesis into a chapter-by-chapter kinetic visual summary where SVG frameworks morph cleanly between mental models and pull-quotes for [Book Title / Paper / Framework] emphasizing [3 Core Takeaways].',
        contract: MOTION_CONTRACT,
        badge: 'Book Digest',
        badgeKey: 'starters_badge_motion_book',
        engineTag: 'Story · Morph',
        keywords: ['book', 'summary', 'framework', 'essay', 'mental models', 'venn', 'explainer'],
        mcpServers: ['satchida-motion'],
      }),
    ],
  },
  {
    id: 'motion_product',
    label: '✨ Product & SaaS Launch',
    labelKey: 'starters_cat_motion_product',
    group: 'business_creative',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'Dark-Mode SaaS Hero Launch',
        icon: '💎',
        description:
          'Floating glass UI cards, laser border beams, interactive feature-tab switcher, and capability spotlights',
        inputs: ['Product / Feature Name', 'Top 3 Capabilities'],
        deliver:
          'Produce a 60fps dark-mode SaaS product launch teaser featuring glassmorphism, floating UI mockups, glowing beam highlights, and interactive feature tabs for [Product / Feature Name] showcasing [Top 3 Capabilities].',
        contract: MOTION_CONTRACT,
        badge: 'SaaS Launch',
        badgeKey: 'starters_badge_motion_saas',
        engineTag: 'UI · Teaser',
        keywords: ['saas', 'launch', 'product', 'hero', 'glassmorphism', 'feature', 'landing'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Live Animated Analytics Dashboard',
        icon: '📈',
        description:
          'Counting tickers, cubic-bezier SVG area sweeps, donut breakdowns, and 7D/30D/YTD time-range filters',
        inputs: [
          'Dashboard Domain: e.g. E-commerce Growth, Cloud FinOps, or Payment Gateway Volume',
        ],
        deliver:
          'Construct an animated real-time analytics dashboard with rolling tickers, glowing SVG area graphs, donut chart sweeps, and interactive Time-Range filters (7D / 30D / YTD) for [Dashboard Domain: e.g. E-commerce Growth, Cloud FinOps, or Payment Gateway Volume].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: '3D Mobile App UX Showcase',
        icon: '📱',
        description:
          'Angled 3D phone stage with choreographed gesture swipes, tap ripples, and Light/Dark UI theme preview',
        inputs: ['App Name & Target Users', 'Core 3-Screen Flow'],
        deliver:
          'Create an animated 3D mobile mockup showcase highlighting smooth screen transitions, tap ripple indicators, floating feature badges, and Light/Dark UI preview toggle for [App Name & Target Users] walking through [Core 3-Screen Flow].',
        contract: MOTION_CONTRACT,
        badge: 'Mobile UX',
        badgeKey: 'starters_badge_motion_mobile',
        engineTag: '3D · Mobile',
        keywords: ['mobile', 'app', 'iphone', 'android', 'ux', 'prototype', 'swipe', 'mockup'],
        mcpServers: ['satchida-motion'],
      }),
    ],
  },
  {
    id: 'motion_creative',
    label: '🎨 Art, Cartoon & Sketch',
    labelKey: 'starters_cat_motion_creative',
    group: 'business_creative',
    modes: ['Motion'],
    starters: [
      starter({
        title: '2D Rigged Character Walk-Cycle',
        icon: '🎭',
        description:
          'Articulated SVG character rig with Gait speed slider (Idle/Walk/Run), Emotion switcher, and Onion-Skinning',
        inputs: [
          'Character Concept: e.g. Explorer Astronaut, Friendly Bot Mascot, or Comic Hero',
          'Backdrop Style',
        ],
        deliver:
          'Design an articulated multi-limb SVG character rig featuring squash-and-stretch physics, interactive Gait Speed slider (Idle / Walk / Run), Expression switcher buttons (Joy / Curious / Shock), and toggleable Onion-Skinning motion trails for [Character Concept: e.g. Explorer Astronaut, Friendly Bot Mascot, or Comic Hero] set against [Backdrop Style].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Pencil Sketch to Ink Line Reveal',
        icon: '✏️',
        description:
          'Hand-drafted construction guidelines progressively resolving via stroke-dasharray into inked & tinted illustration',
        inputs: [
          'Art Subject: e.g. Heritage Arch Monument, Botanical Lotus, or Vintage Watch Movement',
        ],
        deliver:
          'Animate a realistic artist drafting progression using staggered SVG stroke-dasharray underdrawing lines resolving into crisp ink cross-hatching and watercolor wash fills with Speed & Step-Replay scrubber for [Art Subject: e.g. Heritage Arch Monument, Botanical Lotus, or Vintage Watch Movement].',
        contract: MOTION_CONTRACT,
        badge: 'Sketch Draw',
        badgeKey: 'starters_badge_motion_sketch',
        engineTag: 'Stroke · SVG',
        keywords: ['sketch', 'drawing', 'pencil', 'ink', 'line art', 'illustration', 'artist'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Cartoon Storyboard & Comic',
        icon: '🎨',
        description:
          'Multi-panel manga/comic transitions with halftone shading, bouncing dialogue bubbles, and panel stepper',
        inputs: [
          'Story Premise: e.g. Cat Astronaut on Mars, Time-Traveling Inventor, or Classroom Mystery',
        ],
        deliver:
          'Build an animated comic-book/cartoon storyboard sequence with camera panel punch-ins, kinetic speech bubbles, halftone shading, action bursts, and Next/Previous Panel buttons for [Story Premise: e.g. Cat Astronaut on Mars, Time-Traveling Inventor, or Classroom Mystery].',
        contract: MOTION_CONTRACT,
        badge: 'Cartoon Story',
        badgeKey: 'starters_badge_motion_cartoon',
        engineTag: 'Comic · Panels',
        keywords: ['comic', 'manga', 'storyboard', 'cartoon', 'speech bubbles', 'storytelling'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Sacred Geometry & Perspective',
        icon: '🌀',
        description:
          'Parametric mandalas or interactive 1-Point/2-Point vanishing perspective guide with symmetry & palette sliders',
        inputs: [
          'Art Mode: e.g. Golden-Ratio Fibonacci Bloom, Sacred Mandala, or 2-Point Street Perspective Tutor',
        ],
        deliver:
          'Craft an interactive generative art or architectural drawing studio featuring kaleidoscopic symmetry OR 1-Point/2-Point Perspective vanishing-point guides with Symmetry Fold & Color Palette sliders for [Art Mode: e.g. Golden-Ratio Fibonacci Bloom, Sacred Mandala, or 2-Point Street Perspective Tutor].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion'],
      }),
    ],
  },
  {
    id: 'motion_media',
    label: '🎬 Teasers & Video Render',
    labelKey: 'starters_cat_motion_media',
    group: 'business_creative',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'Brand Intro & 3D Logo Stinger',
        icon: '✨',
        description:
          'High-octane 5s 3D logo stinger with neon light trails, glass prism text, and deterministic MP4 timing',
        inputs: ['Channel / Brand Name', 'Slogan & Accent Color'],
        deliver:
          'Generate a sleek 5-second branded video intro stinger with neon particle sweep, 3D camera tilt, chromatic logo lockup, and clean MP4-ready window.__TIMELINE__ pacing for [Channel / Brand Name] featuring [Slogan & Accent Color].',
        contract: MOTION_CONTRACT,
        badge: 'Brand Stinger',
        badgeKey: 'starters_badge_motion_stinger',
        engineTag: '5s Stinger',
        keywords: ['intro', 'logo', 'stinger', 'brand', 'youtube', 'opener', 'reveal'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Vertical 9:16 Kinetic Social Reel',
        icon: '📲',
        description:
          'Mobile-first vertical 1080×1920 format with instant 1.5s hook typography, animated stat bar, and CTA',
        inputs: ['Topic / Hero Stat', 'Target Audience'],
        deliver:
          'Design an attention-grabbing 9:16 vertical motion graphic (1080x1920 composition) with instant hook typography, animated chart callout, readable timed captions, and bold CTA for [Topic / Hero Stat] aimed at [Target Audience].',
        contract: MOTION_CONTRACT,
        badge: 'Social Reel',
        badgeKey: 'starters_badge_motion_social',
        engineTag: '9:16 · Reel',
        keywords: ['shorts', 'reels', 'vertical', '9:16', 'instagram', 'youtube shorts', 'social'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Playwright 60fps MP4 Video Exporter',
        icon: '🎥',
        description:
          'Validate deterministic timeline + window.__SEEK_FRAME__ hooks and render H.264 60fps MP4 file',
        inputs: [
          'Paste HTML code or describe scene, resolution 1280x720 or 1080x1920, duration & fps',
        ],
        deliver:
          'Validate timeline determinism using validate_motion_html (fixing any unlinked animation loops via window.__SEEK_FRAME__ if needed) and call render_motion_to_video to export a crisp H.264 MP4 file for [Paste HTML code or describe scene, resolution 1280x720 or 1080x1920, duration & fps].',
        contract: MOTION_CONTRACT,
        badge: 'MP4 Exporter',
        badgeKey: 'starters_badge_motion_mp4',
        engineTag: 'FFmpeg · MP4',
        keywords: ['mp4', 'export', 'video', 'render', 'ffmpeg', '60fps', 'playwright'],
        mcpServers: ['satchida-motion'],
      }),
    ],
  },
  {
    id: 'motion_medical',
    label: '🫀 Medical & Clinical',
    labelKey: 'starters_cat_motion_medical',
    group: 'care_living',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'Disease & Anatomical Progression',
        icon: '🫀',
        description:
          'Anatomical cross-section comparing Healthy vs Progressive stages with interactive Stage Scrubber',
        inputs: [
          'Medical Condition: e.g. Coronary Atherosclerosis, Type-2 Diabetes Insulin Resistance, or Asthmatic Airway Constriction',
        ],
        deliver:
          'Simulate a clinical-grade anatomical cross-section with a Stage Progression scrubber (Healthy -> Early -> Moderate -> Severe) comparing normal vs affected organ perfusion/structure, plus an objective "Educational visualization — not medical advice" footer for [Medical Condition: e.g. Coronary Atherosclerosis, Type-2 Diabetes Insulin Resistance, or Asthmatic Airway Constriction].',
        contract: MOTION_CONTRACT,
        badge: 'Clinical Pathology',
        badgeKey: 'starters_badge_motion_pathology',
        engineTag: 'Bio · 3D',
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
        featured: true,
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'ECG, Lab Panel & Spirometry',
        icon: '🩺',
        description:
          'Side-by-side Normal vs Altered ECG/Spirometry/HbA1c waveform explorer with callout pins & BPM slider',
        inputs: [
          'Diagnostic Visual: e.g. 12-Lead ECG P-QRS-T vs Atrial Fibrillation, Spirometry Healthy vs COPD Flow Loop, or HbA1c 90-Day Glucose Curve',
        ],
        deliver:
          'Build a patient-friendly diagnostic waveform explorer comparing Normal vs Altered traces side-by-side with clear anatomical callout pins, Heart-Rate/Severity slider, and educational disclaimer footer for [Diagnostic Visual: e.g. 12-Lead ECG P-QRS-T vs Atrial Fibrillation, Spirometry Healthy vs COPD Flow Loop, or HbA1c 90-Day Glucose Curve].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Drug Mechanism of Action (MoA)',
        icon: '💊',
        description:
          'Molecular 3D receptor-docking flight illustrating target enzyme binding and downstream therapeutic effect',
        inputs: [
          'Drug Class / Molecule: e.g. GLP-1 Receptor Agonists, ACE Inhibitors, or SGLT2 Renal Transport Blockers',
        ],
        deliver:
          'Build a 3D pharmacological mechanism-of-action animation showing therapeutic molecules docking with target cell receptors, modulating signaling pathways, and step-by-step Pause/Next captions (educational only) for [Drug Class / Molecule: e.g. GLP-1 Receptor Agonists, ACE Inhibitors, or SGLT2 Renal Transport Blockers].',
        contract: MOTION_CONTRACT,
        badge: 'Drug MoA',
        badgeKey: 'starters_badge_motion_moa',
        engineTag: 'Molecular',
        keywords: ['pharma', 'drug', 'moa', 'receptor', 'enzyme', 'glp1', 'clinical', 'doctor'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Surgical, Inhaler & CPR Trainer',
        icon: '🏥',
        description:
          'Step-by-step reassuring clinical procedure guide or timed Inhaler/CPR/Auto-Injector practice trainer',
        inputs: [
          'Procedure or Skill: e.g. Metered-Dose Inhaler with Spacer Technique, Coronary Stent Angioplasty, Auto-Injector Epinephrine, or Hands-Only CPR',
        ],
        deliver:
          'Design a calm, clinical-grade procedural explainer or patient technique trainer (including timed countdown rings or 110 BPM compression metronome visual where applicable) with numbered Phase Tabs and safety footer for [Procedure or Skill: e.g. Metered-Dose Inhaler with Spacer Technique, Coronary Stent Angioplasty, Auto-Injector Epinephrine, or Hands-Only CPR].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion'],
      }),
    ],
  },
  {
    id: 'motion_wellness',
    label: '🥗 Fitness, Yoga & Diet',
    labelKey: 'starters_cat_motion_wellness',
    group: 'care_living',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'Exercise Form & Joint Angle Lab',
        icon: '🏋️',
        description:
          'Skeleton vector overlay showing prime-mover glow, safe joint angles, Ideal vs Common Mistake toggle & tempo slider',
        inputs: [
          'Exercise: e.g. Bodyweight / Barbell Squat, Romanian Deadlift Hinge, Scapular Push-Up, or Kettlebell Swing',
        ],
        deliver:
          'Construct an interactive exercise biomechanics lab with an articulated skeleton overlay highlighting active prime-mover muscles, live knee/hip/spine joint-angle protractors, Common Mistake vs Ideal Form toggle, and Rep Tempo slider for [Exercise: e.g. Bodyweight / Barbell Squat, Romanian Deadlift Hinge, Scapular Push-Up, or Kettlebell Swing].',
        contract: MOTION_CONTRACT,
        badge: 'Exercise Form',
        badgeKey: 'starters_badge_motion_form',
        engineTag: 'Form · Lab',
        keywords: ['fitness', 'exercise', 'squat', 'deadlift', 'workout', 'form', 'posture', 'gym'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Yoga Asana Flow & Breath Pacer',
        icon: '🧘',
        description:
          'Expanding breath-pacer geometry (Inhale/Hold/Exhale) paired with calm spine alignment & safety contraindications',
        inputs: [
          'Sequence / Goal: e.g. Surya Namaskar 12-Step Flow, Evening Spine Decompression, or Nadi Shodhana / 4-7-8 Breathwork',
        ],
        deliver:
          'Verify classical alignment & safety notes with yoga_asana_and_pranayama_guide, then create a soothing yoga & pranayama pacer with an expanding geometric breath ring (Inhale / Hold / Exhale counters), alignment vectors, and gentle contraindication flags for [Sequence / Goal: e.g. Surya Namaskar 12-Step Flow, Evening Spine Decompression, or Nadi Shodhana / 4-7-8 Breathwork].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-health-wellness'],
      }),
      starter({
        title: 'Metabolic Calorie & Macro Plate',
        icon: '🥗',
        description:
          'TDEE-backed interactive meal plate decomposing carbs, protein, fiber, and fats with live macro sliders',
        inputs: [
          'Target Profile: e.g. 1800 kcal Fat-Loss Indian Veg Plate, 2500 kcal Muscle Recomposition, or High-Fiber PCOS Balance',
        ],
        deliver:
          'Compute personalized TDEE and macro splits first using metabolic_nutrition_planner, then animate an interactive rotating meal plate where adjusting protein, complex carbs, fiber, and healthy fat portions updates real-time satiety & calorie bars for [Target Profile: e.g. 1800 kcal Fat-Loss Indian Veg Plate, 2500 kcal Muscle Recomposition, or High-Fiber PCOS Balance].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-health-wellness'],
      }),
      starter({
        title: 'Desk Rehab & Meal Glycemic Curve',
        icon: '🩺',
        description:
          '180-minute blood-glucose meal comparison curve OR cervical/lumbar desk mobility stretch routine timer',
        inputs: [
          'Meal A vs Meal B',
          'Focus: e.g. White Rice vs Millets + Dal Glucose Curve or 5-Minute Neck & Hip Flexor Desk Stretch',
        ],
        deliver:
          'Ground nutritional numbers via glycemic_and_calorie_lookup when diet applies, then build a clean comparison simulator showing EITHER a 180-minute Blood Glucose curve ([Meal A vs Meal B]) OR a Cervical/Lumbar Desk Posture Rehab sequence with muscle-release timers for [Focus: e.g. White Rice vs Millets + Dal Glucose Curve or 5-Minute Neck & Hip Flexor Desk Stretch].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-health-wellness'],
      }),
    ],
  },
  {
    id: 'motion_home',
    label: '🏡 Home, Interior & Living',
    labelKey: 'starters_cat_motion_home',
    group: 'care_living',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'Room Layout & Festive Makeover',
        icon: '✨',
        description:
          'Day-to-Festive Evening room styler with interactive wall/cushion color swatches and furniture clearance layout',
        inputs: [
          'Room & Occasion: e.g. 16x12ft Living Room Diwali Makeover, Cozy Study & Guest Room, or Balcony Tea Corner',
          'Preferred Palette & Furniture List',
        ],
        deliver:
          'Design an interactive home interior layout & festive styling studio where users toggle Day vs Warm Evening lighting, swap wall/curtain color swatches, and preview sofa/table placements with walking-clearance dimensions for [Room & Occasion: e.g. 16x12ft Living Room Diwali Makeover, Cozy Study & Guest Room, or Balcony Tea Corner] in [Preferred Palette & Furniture List].',
        contract: MOTION_CONTRACT,
        badge: 'Décor & Room',
        badgeKey: 'starters_badge_motion_decor',
        engineTag: 'Room · 2D/3D',
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
        featured: true,
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Weekly Family Meal & Pantry Plan',
        icon: '🍱',
        description:
          'Mon–Sun rotating meal matrix with smart leftover reuse, prep-batch timers, and clickable pantry checklist',
        inputs: [
          'Dietary Style & Family Size: e.g. 4-Person Indian Vegetarian Weeknight Plan, Kids Nutritious School Tiffins, or Diabetic-Friendly Household Menu',
        ],
        deliver:
          'Create an animated Monday-to-Sunday family kitchen meal & grocery planner with rotating dish cards, Sunday Prep Batch timelines, and an interactive clickable pantry/veggie checklist for [Dietary Style & Family Size: e.g. 4-Person Indian Vegetarian Weeknight Plan, Kids Nutritious School Tiffins, or Diabetic-Friendly Household Menu].',
        contract: MOTION_CONTRACT,
        badge: 'Meal Rhythm',
        badgeKey: 'starters_badge_motion_meal',
        engineTag: 'Planner · SVG',
        keywords: ['meal plan', 'grocery', 'kitchen', 'tiffin', 'family', 'homemaker', 'recipes'],
        mcpServers: ['satchida-motion', 'satchida-health-wellness'],
      }),
      starter({
        title: 'Wardrobe & Kitchen Decluttering',
        icon: '🏡',
        description:
          'Before/After spatial drawer & shelf transformation slider zoning Daily Reach, Weekly, and Seasonal bins',
        inputs: [
          'Space: e.g. Modular Kitchen Spice & Pantry Drawers, Capsule Master Wardrobe, or Compact Craft Corner',
        ],
        deliver:
          'Animate a satisfying Before-vs-After spatial storage organization blueprint dividing shelves and drawers into Daily Reach, Weekly, and Seasonal zones with modular bin footprints for [Space: e.g. Modular Kitchen Spice & Pantry Drawers, Capsule Master Wardrobe, or Compact Craft Corner].',
        contract: MOTION_CONTRACT,
        badge: 'Home Organize',
        badgeKey: 'starters_badge_motion_organize',
        engineTag: 'Zones · Grid',
        keywords: ['wardrobe', 'declutter', 'pantry', 'kitchen', 'organize', 'storage', 'shelf'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Balcony Garden & Home Budget',
        icon: '🪴',
        description:
          'Sun-exposure companion-planting balcony grid by season OR visual Monthly Household Envelope Budget flow',
        inputs: [
          'Space or Goal: e.g. West-Facing 8x4ft Herb Balcony Garden or Family Monthly Groceries, Gold & School Savings Flow',
        ],
        deliver:
          'Build an animated seasonal planner showing sun-angle exposure, companion-plant pot spacing grids (mint, tomato, basil, marigold), and a Season Switcher (Summer / Monsoon / Winter) OR a Monthly Household Envelope Budget flow for [Space or Goal: e.g. West-Facing 8x4ft Herb Balcony Garden or Family Monthly Groceries, Gold & School Savings Flow].',
        contract: MOTION_CONTRACT,
        badge: 'Home Garden',
        badgeKey: 'starters_badge_motion_garden',
        engineTag: 'Seasonal · Sim',
        keywords: ['garden', 'balcony', 'plants', 'herbs', 'budget', 'household', 'homemaker'],
        mcpServers: ['satchida-motion'],
      }),
    ],
  },
  {
    id: 'motion_elderly',
    label: '👵 Golden Years & Living',
    labelKey: 'starters_cat_motion_elderly',
    group: 'care_living',
    modes: ['Motion'],
    starters: [
      starter({
        title: 'Large-Print Medicine & Water',
        icon: '💊',
        description:
          'Soothing >= 20px WCAG AAA high-contrast Morning-to-Night pillbox guide with calm 0.65x pacing & giant buttons',
        inputs: [
          'Medication & Routine: e.g. Morning BP & Sugar Tablets Before Breakfast, Evening Walk & Calcium',
        ],
        deliver:
          'Build a gentle, ultra-clear Daily Medicine & Wellness Schedule strictly enforcing large >= 20px body typography, high WCAG AAA contrast (dark navy on warm cream or crisp white on deep slate), slow 0.65x speed, Morning/Afternoon/Night pillbox visuals, water check buttons, and giant Play/Pause controls for [Medication & Routine: e.g. Morning BP & Sugar Tablets Before Breakfast, Evening Walk & Calcium].',
        contract: MOTION_CONTRACT,
        badge: 'Senior Routine',
        badgeKey: 'starters_badge_motion_elderly',
        engineTag: 'AAA · Large',
        keywords: ['senior', 'elderly', 'medicine', 'pills', 'hydration', 'routine', 'accessible'],
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Smartphone & UPI Safety Tutor',
        icon: '📱',
        description:
          'Magnified interactive phone mockup with numbered glowing tap circles, >= 20px text & Next/Repeat buttons',
        inputs: [
          'Digital Task: e.g. Scanning a Shopkeeper UPI QR Code, Jeevan Pramaan Life Certificate, or Family Video Call',
        ],
        deliver:
          'Create a reassuring, magnified smartphone practice simulator strictly using >= 20px jargon-free captions, numbered glowing tap rings, slow 0.6x pacing, and giant Next Step / Repeat buttons illustrating safely step by step how to complete [Digital Task: e.g. Scanning a Shopkeeper UPI QR Code, Jeevan Pramaan Life Certificate, or Family Video Call].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion'],
      }),
      starter({
        title: 'Chair Physio & Joint Mobility',
        icon: '🪑',
        description:
          'Calm seated mobility guide with >= 20px instructions, 0.6x slow repetition counter, and Anytime Rest button',
        inputs: [
          'Mobility Focus: e.g. Morning Knee & Ankle Chair Warmup, Gentle Neck & Shoulder Relief, or Deep Calm Breathing',
        ],
        deliver:
          'Build a calm, seated senior physiotherapy & joint-mobility guide strictly enforcing >= 20px captions, soft WCAG AAA contrast, slow 0.6x repetition pacing, ankle/knee/shoulder range highlights, and an anytime Rest/Pause button for [Mobility Focus: e.g. Morning Knee & Ankle Chair Warmup, Gentle Neck & Shoulder Relief, or Deep Calm Breathing].',
        contract: MOTION_CONTRACT,
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
        mcpServers: ['satchida-motion', 'satchida-health-wellness'],
      }),
      starter({
        title: 'Elder Fraud & OTP Scam Shield',
        icon: '🛡️',
        description:
          'High-contrast >= 20px Red-Flag Trap vs Safe Golden Rule cards guarding elders against OTP & impersonation scams',
        inputs: [
          'Scam Scenario: e.g. Fake Bank KYC / Electricity Disconnection SMS, Fake Digital Arrest Video Call, or Parcel OTP Trap',
        ],
        deliver:
          'Create an unmistakable, calm high-contrast Scam Shield guide enforcing >= 20px typography and WCAG AAA >= 7:1 contrast comparing Dangerous Caller Traps side-by-side against Safe Golden Rules ("Never share OTP, PIN, or install screen-sharing apps") with numbered hang-up checklist steps for [Scam Scenario: e.g. Fake Bank KYC / Electricity Disconnection SMS, Fake Digital Arrest Video Call, or Parcel OTP Trap].',
        contract: MOTION_CONTRACT,
        badge: 'Safety Alert',
        badgeKey: 'starters_badge_motion_fraud',
        engineTag: 'AAA · Safety',
        keywords: ['scam', 'fraud', 'otp', 'senior', 'safety', 'cyber', 'digital arrest', 'bank'],
        mcpServers: ['satchida-motion'],
      }),
    ],
  },
];
