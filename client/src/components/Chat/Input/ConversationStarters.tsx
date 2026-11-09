import { useMemo, useCallback, useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { EModelEndpoint, Constants } from 'librechat-data-provider';
import {
  useGetAssistantDocsQuery,
  useGetEndpointsQuery,
  useGetStartupConfig,
} from '~/data-provider';
import { useChatContext, useChatFormContext, useAgentsMapContext, useAssistantsMapContext, useBadgeRowContext } from '~/Providers';
import { getIconEndpoint, getEntity, getModelSpec, cn } from '~/utils';
import { forceResize } from '~/utils/textarea';
import { useSubmitMessage, useLocalize } from '~/hooks';
import { mcpValuesAtomFamily } from '~/store/mcp';
import { mainTextareaId } from '~/common';

export interface StarterItem {
  prompt: string;
  badge?: string;
  mcpServers?: string[];
}

export interface StarterCategory {
  id: string;
  label: string;
  modes?: string[]; // Allowed modes: 'Chat', 'Work', 'Study', 'Study-Local', 'Privacy'
  starters: StarterItem[];
}

const ALL_CATEGORIES: StarterCategory[] = [
  {
    id: 'markets_finance',
    label: '📊 Markets & Bullion',
    modes: ['Chat', 'Work', 'Pro'],
    starters: [
      {
        prompt:
          'Comprehensive Multi-Asset Market Overview: Live Gold & Silver spot rates, crypto fear & greed index, key stock indices (Nifty 50, Sensex, S&P 500, Nasdaq), and top market movers today with trends & catalysts',
        badge: 'Markets',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'Deep Bullion Analysis: Global USD spot prices per oz, domestic 24K/22K/18K gold and 999 silver retail rates across major cities, jeweller making charge spreads, and import duty dynamics',
        badge: 'Bullion',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'Equity Valuation & Earnings Dossier: Conduct an institutional fundamental & technical equity analysis on asset: [Asset / Ticker / Stock Name] with DCF valuation, multiples comparison, and key earnings drivers',
        badge: 'Equity',
        mcpServers: ['satchida-work-suite', 'satchida-web-search'],
      },
      {
        prompt:
          'Crypto Forensics & Smart Contract Security: Analyze on-chain transaction flows, liquidity pool safety, tokenomics distribution, and contract vulnerabilities for: [Contract Address / Token Symbol]',
        badge: 'DeFi Security',
        mcpServers: ['satchida-web-search'],
      },
    ],
  },
  {
    id: 'family_health',
    label: '🩺 Health & Emergency',
    modes: ['Chat', 'Privacy'],
    starters: [
      {
        prompt:
          'Jan Aushadhi & Essential Medicine Prices: What are the NPPA ceiling prices and PMBJP generic drug equivalents (with cost savings) for: [Specify disease or prescribed brand medicine]?',
        badge: 'Pharma',
        mcpServers: ['satchida-health-wellness', 'satchida-web-search'],
      },
      {
        prompt:
          'Clinical Differential Diagnosis (DDx) & Workup: Present a structured symptom timeline, differential diagnosis considerations, and relevant lab biomarker panels for this clinical case:\n\n[Describe patient symptoms, age, duration, and vitals here]',
        badge: 'Clinical DDx',
        mcpServers: ['satchida-health-wellness'],
      },
      {
        prompt:
          'Drug Interactions & Contraindications: Review this medication schedule for potential adverse drug-drug interactions, dietary contraindications, and boxed warnings:\n\n[List active medications, dosages, and supplements here]',
        badge: 'Drug Safety',
        mcpServers: ['satchida-health-wellness', 'openfda-drugs'],
      },
      {
        prompt:
          'Emergency Helplines & Air Quality Triage: List verified 24/7 emergency response protocols, trauma helplines, and CPCB real-time AQI health precautions for respiratory safety in: [City / State / Location]',
        badge: 'Emergency SOS',
        mcpServers: ['satchida-web-search'],
      },
    ],
  },
  {
    id: 'vedic_wellness',
    label: '🕉️ Vedic & Holistic Wellness',
    modes: ['Chat', 'Privacy'],
    starters: [
      {
        prompt:
          "Calculate today's Vedic Panchang, Tithi, Nakshatra, Yoga, Karana, and auspicious Abhijit Muhurta timings for location: [City / State / Coordinates] on date: [Date (Default: Today)]",
        badge: 'Panchang',
        mcpServers: ['satchida-panchang-vedic'],
      },
      {
        prompt:
          'Suggest an authentic personalized Ayurvedic daily regimen (Dinacharya) based on Vata, Pitta, and Kapha dosha balancing for: [Your age, health goals, or current symptoms]',
        badge: 'Ayurveda',
        mcpServers: ['satchida-health-wellness'],
      },
      {
        prompt:
          'Look up major upcoming Hindu festival calendar dates, lunar tithis, and fasting (Vrat) guidelines for year: [Year / Month]',
        badge: 'Festivals',
        mcpServers: ['satchida-panchang-vedic'],
      },
      {
        prompt:
          'Classical Yoga Asanas & Pranayama breathing techniques for: [Specify goal: stress resilience, respiratory capacity, sleep, or back pain]',
        badge: 'Yoga/Pranayama',
        mcpServers: ['satchida-health-wellness'],
      },
      {
        prompt:
          'Audit digital accessibility: Check WCAG 2.2 color contrast ratios between foreground and background palette tokens for: [Hex Colors or Component]',
        badge: 'WCAG 2.2',
        mcpServers: ['accessibility-tools'],
      },
    ],
  },
  {
    id: 'citizen_essentials',
    label: '🛡️ Citizen Essentials',
    modes: ['Chat'],
    starters: [
      {
        prompt:
          'Fuel (E20/XP95), LPG & Energy Grid: City-wise price comparison of petrol, diesel, domestic 14.2kg LPG cylinder rates, and inverter battery sizing with solar net-metering math for: [City / State]',
        badge: 'Energy & Fuel',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'Potable Water & FSSAI Food Adulteration: Drinking water TDS standards (BIS 10500), purification methods, and rapid home tests for food adulteration (milk, spices, oils)',
        badge: 'Food & Water',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'School Holidays & Exam Directives: Active District Magistrate (DM) weather/pollution closure orders and latest NTA/CBSE competitive exam schedules for: [District / State]',
        badge: 'Exam/School',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'Citizen Banking & EPFO Grievance: Bank strike alerts, ATM liquidity advisories, emergency online PF withdrawal under Form 31, and Consumer Court helpline filing',
        badge: 'Banking & PF',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'Transit & Travel Safety: Indian Railways major delays, special train bulletins, airport fog advisories, and NHAI national highway landslide/closure alerts for route: [Origin to Destination]',
        badge: 'Transit',
        mcpServers: ['satchida-web-search'],
      },
    ],
  },
  {
    id: 'governance_law',
    label: '⚖️ Legal & Governance',
    modes: ['Work', 'Pro', 'Privacy'],
    starters: [
      {
        prompt:
          'RBI Master Directions & Banking Compliance: Latest MPC Repo rate impacts, EMI benchmarks, digital lending guidelines, and UPI transaction limit frameworks',
        badge: 'RBI Regulatory',
        mcpServers: ['legal-research', 'satchida-web-search'],
      },
      {
        prompt:
          'Supreme Court & Gazette Legal Counsel: Landmark constitutional precedents, Gazette of India statutory notifications, and DPDP / Bharatiya Nyaya Sanhita compliance for: [Legal Subject / Case Query]',
        badge: 'Supreme Court',
        mcpServers: ['legal-research', 'satchida-web-search'],
      },
      {
        prompt:
          'Enterprise Governance, Risk & Audit (GRC): Formulate an ISO 27001 / SOC2 Type II internal control checklist, gap remediation matrix, and third-party risk assessment for: [System / Infrastructure]',
        badge: 'GRC Audit',
        mcpServers: ['legal-research', 'devops-security'],
      },
      {
        prompt:
          'Contract Analysis & Clause Extraction: Review this agreement for indemnification caps, IP assignment, non-solicitation, and governing law clauses:\n\n[Paste contract or clauses here]',
        badge: 'Contracts',
        mcpServers: ['legal-research', 'satchida-work-suite'],
      },
    ],
  },
  {
    id: 'geopolitics_intel',
    label: '🛰️ Geopolitics & Defence',
    modes: ['Chat', 'Work', 'Pro'],
    starters: [
      {
        prompt:
          'Strategic Border & Defense Briefing: Current military situation, troop deployments, and intelligence posture along LOC, LAC, and Indian Ocean sea lanes',
        badge: 'Border Intel',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'Critical Mineral & Supply Chain Cartels: Geopolitical control of lithium, rare earths, cobalt, and semiconductor wafer fabs across global trade corridors',
        badge: 'Supply Chains',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'Foreign Policy & Sovereign Alliances: Multilateral geopolitical dynamics across BRICS, Quad, SCO, and bilateral trade corridors under shifting sanction regimes',
        badge: 'Foreign Policy',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt:
          'Cyber Sovereignty & Critical Infrastructure: State-sponsored APT groups, underwater cable security, satellite communications, and grid resilience against cyber warfare',
        badge: 'Cyber Warfare',
        mcpServers: ['devops-security', 'satchida-web-search'],
      },
    ],
  },
  {
    id: 'security_hardware',
    label: '🔒 Cyber & AI Hardware',
    modes: ['Work', 'Pro', 'Vibecoding'],
    starters: [
      {
        prompt:
          'Automated CVE & Exploit Threat Intelligence: Vulnerability assessment of active zero-days, CVSS 3.1 scores, affected package versions, and vendor patches for: [Software / CVE Identifier]',
        badge: 'CVE Intel',
        mcpServers: ['devops-security', 'satchida-web-search'],
      },
      {
        prompt:
          'Frontier AI Compute Architecture: Benchmark H100 vs B200 SXM clusters, NVLink interconnect bandwidth, FP8 matrix throughput, and datacenter thermal envelopes',
        badge: 'GPU Compute',
        mcpServers: ['satchida-ai-engineer', 'satchida-web-search'],
      },
      {
        prompt:
          'Surveillance Architecture & Edge Computer Vision: Design a multi-camera RTSP streaming pipeline with on-device YOLO detection, privacy redaction, and local NVR storage',
        badge: 'Edge Vision',
        mcpServers: ['devops-security', 'satchida-work-suite'],
      },
      {
        prompt:
          'Static Code Vulnerability & Secret Leak Scan: Inspect codebase for hardcoded credentials, exposed API keys, unsafe deserialization, and SQL/command injection vectors:\n\n[Paste code snippet here]',
        badge: 'Code Security',
        mcpServers: ['devops-security', 'git-librechat'],
      },
    ],
  },
  {
    id: 'study_core',
    label: '🎓 STEM & Math',
    modes: ['Study', 'Study-Local'],
    starters: [
      {
        prompt:
          'Solve the equation x^3 - 4x = 0 step-by-step with KaTeX formulas, factoring, and roots verification',
        badge: 'Symbolic Math',
        mcpServers: ['satchida-stem-study'],
      },
      {
        prompt:
          'Interactive DeepTutor Concept Book: Create a comprehensive learning module with Socratic milestone exercises and practice quizzes on topic: [Specify concept, e.g. Quantum Gates]',
        badge: 'DeepTutor',
        mcpServers: ['deeptutor-integration'],
      },
      {
        prompt:
          'Electromagnetic Induction & Modern Physics: Derive Faraday-Lenz laws and Maxwell equations with step-by-step mathematical rigor',
        badge: 'Physics',
        mcpServers: ['satchida-stem-study'],
      },
      {
        prompt:
          'Algorithm Complexity & Data Structures: Compare Dijkstra vs A* shortest-path algorithms with time/space complexity analysis and verified code',
        badge: 'CS Algorithms',
        mcpServers: ['satchida-stem-study'],
      },
    ],
  },
  {
    id: 'ai_research_books',
    label: '🔬 Deep Research & E-Books',
    modes: ['Study', 'Study-Local', 'Work', 'Pro'],
    starters: [
      {
        prompt:
          'Multi-Turn Deep Research Dossier: Conduct an exhaustive, citation-backed technical investigation on: [Emerging Technology / Scientific Topic]',
        badge: 'Deep Research',
        mcpServers: ['satchida-web-search', 'academic-search'],
      },
      {
        prompt:
          'Scaffold Authoritative E-Book / Whitepaper: Design a complete multi-chapter manuscript blueprint with executive summary, diagrams, and case studies on: [Book Title / Subject]',
        badge: 'E-Book / PRD',
        mcpServers: ['satchida-knowledge-vault'],
      },
      {
        prompt:
          'Frontier AI Architecture Sizing: Verify transformer layer dimensions, tensor parallelism, and kv-cache memory requirements for a 7B/14B model',
        badge: 'AI Architecture',
        mcpServers: ['satchida-ai-engineer'],
      },
      {
        prompt:
          'Academic Citation & Peer-Reviewed Survey: Query scholarly literature on arXiv and PubMed for: [Research Field / Scaling Laws]',
        badge: 'Scholar/arXiv',
        mcpServers: ['arxiv-search', 'academic-search'],
      },
    ],
  },
  {
    id: 'vibecoding_dev',
    label: '💻 Vibe Coding & Architecture',
    modes: ['Vibecoding', 'Work', 'Pro'],
    starters: [
      {
        prompt:
          'Staff Architect Blueprint: Architect a scalable REST / WebSocket API with rate limiting, JWT authentication, and idempotent worker queue for: [Application Requirement]',
        badge: 'Architecture',
        mcpServers: ['satchida-work-suite', 'devops-security'],
      },
      {
        prompt:
          'Plan Execution Supervisor: Audit the active implementation plan, ground every step in repository files, and propose bounded atomic edits',
        badge: 'Plan Supervisor',
        mcpServers: ['git-librechat'],
      },
      {
        prompt:
          'Full-Stack Rapid UI Prototype: Build a modern, accessible interactive component in React/TypeScript with Tailwind CSS and responsive design for: [Component Name / Feature]',
        badge: 'Vibe UI',
        mcpServers: ['satchida-work-suite'],
      },
      {
        prompt:
          'Database Performance & Query Optimization: Analyze slow query execution plans, design optimal composite indexes, and prevent table locks for: [SQL Query or Schema]',
        badge: 'Database',
        mcpServers: ['satchida-work-suite'],
      },
    ],
  },
  {
    id: 'privacy_vault',
    label: '🔒 Sovereign Vault & Privacy',
    modes: ['Privacy', 'Work'],
    starters: [
      {
        prompt:
          'Offline Executive Document Synthesis: Generate a presentation (.pptx), report (.pdf), or spreadsheet (.xlsx) completely on-device without cloud leakage on: [Topic / Presentation Title]',
        badge: 'Document Gen',
        mcpServers: ['satchida-knowledge-vault'],
      },
      {
        prompt:
          'Sovereign Knowledge Vault RAG: Search private enterprise vaults and query indexed textbooks/policies with exact verified citations for: [Search Query]',
        badge: 'Vault RAG',
        mcpServers: ['satchida-knowledge-vault'],
      },
      {
        prompt:
          'Confidential Strategy Formulation: Draft an internal strategic business plan with 100% on-device inference and zero telemetry for: [Initiative / Product Launch]',
        badge: 'Zero Telemetry',
        mcpServers: ['satchida-knowledge-vault'],
      },
      {
        prompt:
          'Deep Forensic Document Audit: Cross-examine uploaded financial and legal documents for discrepancies, audit gaps, and hidden obligations:\n\n[Describe documents or paste excerpt]',
        badge: 'Forensic Audit',
        mcpServers: ['satchida-knowledge-vault'],
      },
    ],
  },
];

const ConversationStarters = () => {
  const { conversation } = useChatContext();
  const methods = useChatFormContext();
  const badgeContext = useBadgeRowContext();
  const agentsMap = useAgentsMapContext();
  const assistantMap = useAssistantsMapContext();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { data: startupConfig } = useGetStartupConfig();
  const localize = useLocalize();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const activeMode = conversation?.spec ?? 'Chat';

  // Filter categories according to the current model spec / mode
  const modeCategories = useMemo(() => {
    const matched = ALL_CATEGORIES.filter(
      (cat) => !cat.modes || cat.modes.includes(activeMode),
    );
    return matched.length > 0 ? matched : ALL_CATEGORIES;
  }, [activeMode]);

  // Reset selected category to 'all' whenever the user switches mode/spec
  useEffect(() => {
    setSelectedCategory('all');
  }, [activeMode]);

  const convoKey = conversation?.conversationId ?? Constants.NEW_CONVO;
  const [, setMCPValues] = useAtom(mcpValuesAtomFamily(convoKey));

  const endpointType = useMemo(() => {
    let ep = conversation?.endpoint ?? '';
    if (ep === EModelEndpoint.azureOpenAI) {
      ep = EModelEndpoint.openAI;
    }
    return getIconEndpoint({
      endpointsConfig,
      iconURL: conversation?.iconURL,
      endpoint: ep,
    });
  }, [conversation?.endpoint, conversation?.iconURL, endpointsConfig]);

  const { data: documentsMap = new Map() } = useGetAssistantDocsQuery(endpointType, {
    select: (data) => new Map(data.map((dbA) => [dbA.assistant_id, dbA])),
  });

  const { entity, isAgent } = getEntity({
    endpoint: endpointType,
    agentsMap,
    assistantMap,
    agent_id: conversation?.agent_id,
    assistant_id: conversation?.assistant_id,
  });

  const modelSpec = useMemo(
    () => getModelSpec({ specName: conversation?.spec, startupConfig }),
    [conversation?.spec, startupConfig],
  );

  const customStarters = useMemo(() => {
    if (entity?.conversation_starters?.length) {
      return entity.conversation_starters;
    }
    if (modelSpec?.conversation_starters?.length) {
      return modelSpec.conversation_starters;
    }
    if (isAgent) {
      return [];
    }
    return documentsMap.get(entity?.id ?? '')?.conversation_starters ?? [];
  }, [documentsMap, isAgent, entity, modelSpec]);

  const { submitMessage } = useSubmitMessage();

  const handleStarterClick = useCallback(
    (starter: StarterItem | string) => {
      const text = typeof starter === 'string' ? starter : starter.prompt;
      const servers = typeof starter === 'string' ? [] : (starter.mcpServers ?? []);

      // Pre-select required MCP servers in state and in badgeRowContext
      if (servers.length > 0) {
        setMCPValues((prev = []) => Array.from(new Set([...prev, ...servers])));
        if (badgeContext?.mcpServerManager?.setMCPValues) {
          const curr = badgeContext.mcpServerManager.mcpValues ?? [];
          badgeContext.mcpServerManager.setMCPValues(Array.from(new Set([...curr, ...servers])));
        }
      }

      // Check if prompt requires user context (contains placeholders like [...] or <...>)
      const isTemplate = /\[|\<|this message/i.test(text);

      if (isTemplate) {
        const textarea = document.getElementById(mainTextareaId) as HTMLTextAreaElement | null;
        if (textarea) {
          textarea.value = text;
          if (methods?.setValue) {
            methods.setValue('text', text, { shouldDirty: true, shouldValidate: true });
          }
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          forceResize(textarea);
          textarea.focus();

          // Highlight the first placeholder [ ... ] so the user can easily type or paste over it
          const openBracket = text.indexOf('[');
          const closeBracket = text.indexOf(']', openBracket);
          if (openBracket !== -1 && closeBracket !== -1) {
            textarea.setSelectionRange(openBracket, closeBracket + 1);
          } else {
            textarea.setSelectionRange(text.length, text.length);
          }
        }
        return;
      }

      // Standalone queries can execute immediately
      submitMessage({ text });
    },
    [submitMessage, setMCPValues, badgeContext, methods],
  );

  const displayedStarters = useMemo(() => {
    if (selectedCategory === 'all') {
      if (customStarters.length > 0) {
        return customStarters.slice(0, 6).map((s: string) => ({ prompt: s }));
      }
      return modeCategories.flatMap((c) => c.starters.slice(0, 2));
    }
    const cat = modeCategories.find((c) => c.id === selectedCategory);
    return cat ? cat.starters : [];
  }, [selectedCategory, customStarters, modeCategories]);

  return (
    <div className="mx-auto mb-6 mt-1 flex w-full max-w-4xl flex-col items-center gap-2.5 px-4">
      {/* Category Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={cn(
            'cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-all',
            selectedCategory === 'all'
              ? 'shadow-xs bg-surface-inverted text-text-inverted'
              : 'border border-border-light bg-surface-secondary/80 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
          )}
        >
          {`✨ ${localize('com_ui_suggested')}`}
        </button>
        {modeCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              'cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-all',
              selectedCategory === cat.id
                ? 'shadow-xs bg-surface-inverted text-text-inverted'
                : 'border border-border-light bg-surface-secondary/80 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Starter Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {displayedStarters.map((item: StarterItem, index: number) => (
          <button
            key={index}
            type="button"
            onClick={() => handleStarterClick(item)}
            style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'backwards' }}
            className="shadow-2xs group flex max-w-[22rem] cursor-pointer items-center gap-2 rounded-xl border border-border-light bg-surface-secondary/70 px-3 py-1.5 text-xs text-text-secondary transition-all duration-150 fade-in hover:border-border-medium hover:bg-surface-tertiary hover:text-text-primary"
          >
            {item.badge && (
              <span className="shrink-0 rounded-md bg-surface-tertiary px-1.5 py-0.5 text-[10px] font-semibold text-text-primary group-hover:bg-surface-inverted group-hover:text-text-inverted transition-colors">
                {item.badge}
              </span>
            )}
            <span className="line-clamp-2 text-left">{item.prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ConversationStarters;
