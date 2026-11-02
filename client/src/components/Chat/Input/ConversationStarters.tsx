import { useMemo, useCallback, useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { EModelEndpoint, Constants } from 'librechat-data-provider';
import {
  useGetAssistantDocsQuery,
  useGetEndpointsQuery,
  useGetStartupConfig,
} from '~/data-provider';
import { useChatContext, useAgentsMapContext, useAssistantsMapContext } from '~/Providers';
import { getIconEndpoint, getEntity, getModelSpec, cn } from '~/utils';
import { useSubmitMessage, useLocalize } from '~/hooks';
import { mcpValuesAtomFamily } from '~/store/mcp';

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
  // --- STUDY MODE CATEGORIES ---
  {
    id: 'study_core',
    label: '🎓 STEM & Math',
    modes: ['Study', 'Study-Local'],
    starters: [
      {
        prompt: 'Solve the equation x^3 - 4x = 0 step-by-step with KaTeX formulas and roots',
        badge: 'Math',
        mcpServers: ['satchida-stem-study'],
      },
      {
        prompt: 'Create an interactive learning book on Quantum Gates with quizzes and exercises',
        badge: 'DeepTutor',
        mcpServers: ['deeptutor-integration'],
      },
      {
        prompt: 'Search recent arXiv papers on sparse mixture-of-experts and state-space models',
        badge: 'arXiv',
        mcpServers: ['arxiv-search'],
      },
      {
        prompt: 'Find high-impact academic citations for Transformer attention scaling laws',
        badge: 'Scholar',
        mcpServers: ['academic-search'],
      },
    ],
  },
  {
    id: 'study_ai_research',
    label: '🔬 AI & Deep Research',
    modes: ['Study'],
    starters: [
      {
        prompt: 'Verify transformer layer dimensions and head sizing for a 7B parameter architecture',
        badge: 'AI Eng',
        mcpServers: ['satchida-ai-engineer'],
      },
      {
        prompt: 'Query and synthesize scholarly papers on diffusion model sampling techniques',
        badge: 'Academic',
        mcpServers: ['academic-search'],
      },
      {
        prompt: 'Search my private knowledge vaults for study notes and lecture slides',
        badge: 'Vault',
        mcpServers: ['satchida-knowledge-vault'],
      },
      {
        prompt: 'Search live academic articles and publications using keyless search',
        badge: 'Web Search',
        mcpServers: ['satchida-web-search'],
      },
    ],
  },

  // --- WORK MODE CATEGORIES ---
  {
    id: 'work_core',
    label: '💼 Office & Strategy',
    modes: ['Work'],
    starters: [
      {
        prompt: 'Analyze tabular sales metrics, calculate quarterly variance, and summarize KPIs',
        badge: 'Analytics',
        mcpServers: ['satchida-work-suite'],
      },
      {
        prompt: 'Search my private knowledge vaults for uploaded enterprise policy documents',
        badge: 'Vault',
        mcpServers: ['satchida-knowledge-vault'],
      },
      {
        prompt: 'Generate an executive project progress report with milestones and action items',
        badge: 'Work Suite',
        mcpServers: ['satchida-work-suite'],
      },
      {
        prompt: 'Summarize today\'s top tech & financial news from live keyless feeds',
        badge: 'Web Search',
        mcpServers: ['satchida-web-search'],
      },
    ],
  },
  {
    id: 'work_dev',
    label: '💻 Dev & Compliance',
    modes: ['Work'],
    starters: [
      {
        prompt: 'Inspect local Git repository status and recent uncommitted changes',
        badge: 'Git',
        mcpServers: ['git-librechat'],
      },
      {
        prompt: 'Search Title 17 Code of Federal Regulations for digital fair use and copyright laws',
        badge: 'Legal',
        mcpServers: ['legal-research'],
      },
      {
        prompt: 'Calculate SHA-256 integrity hash of this deployment package',
        badge: 'DevOps',
        mcpServers: ['devops-security'],
      },
      {
        prompt: 'List allowed directories and read documents from the shared folder workspace',
        badge: 'Files',
        mcpServers: ['filesystem-shared'],
      },
    ],
  },

  // --- CHAT (GENERAL) MODE CATEGORIES ---
  {
    id: 'chat_realtime',
    label: '🌐 Search & Real-Time',
    modes: ['Chat'],
    starters: [
      {
        prompt: 'Summarize today\'s top tech & financial developments using live keyless search',
        badge: 'Web Search',
        mcpServers: ['satchida-web-search'],
      },
      {
        prompt: 'Fetch and summarize the documentation from https://httpbin.org/get',
        badge: 'Fetch',
        mcpServers: ['web-fetch'],
      },
      {
        prompt: 'What is the exact current date, time, and timezone in Asia/Kolkata?',
        badge: 'Clock',
        mcpServers: ['time-server'],
      },
      {
        prompt: 'Search my private knowledge vaults for personal notes and guides',
        badge: 'Vault',
        mcpServers: ['satchida-knowledge-vault'],
      },
    ],
  },
  {
    id: 'chat_wellness',
    label: '🌿 Wellness & Life',
    modes: ['Chat'],
    starters: [
      {
        prompt: 'Suggest a holistic Ayurvedic morning regimen (Dinacharya) for balanced energy',
        badge: 'Ayurveda',
        mcpServers: ['satchida-health-wellness'],
      },
      {
        prompt: 'Calculate today\'s Vedic Panchang, Tithi, Nakshatra, and auspicious muhurta timings',
        badge: 'Panchang',
        mcpServers: ['satchida-panchang-vedic'],
      },
      {
        prompt: 'Search FDA drug safety disclosures and adverse event reports for Aspirin',
        badge: 'OpenFDA',
        mcpServers: ['openfda-drugs'],
      },
      {
        prompt: 'Check WCAG 2.2 color contrast ratios between foreground #4A90E2 and background #FFFFFF',
        badge: 'WCAG',
        mcpServers: ['accessibility-tools'],
      },
    ],
  },
];

const ConversationStarters = () => {
  const { conversation } = useChatContext();
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

      if (servers.length > 0) {
        setMCPValues((prev = []) => Array.from(new Set([...prev, ...servers])));
      }

      submitMessage({ text });
    },
    [submitMessage, setMCPValues],
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
