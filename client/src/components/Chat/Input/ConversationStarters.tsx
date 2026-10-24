import { useMemo, useCallback, useState } from 'react';
import { EModelEndpoint } from 'librechat-data-provider';
import {
  useGetAssistantDocsQuery,
  useGetEndpointsQuery,
  useGetStartupConfig,
} from '~/data-provider';
import { useChatContext, useAgentsMapContext, useAssistantsMapContext } from '~/Providers';
import { getIconEndpoint, getEntity, getModelSpec, cn } from '~/utils';
import { useSubmitMessage, useLocalize } from '~/hooks';

interface StarterCategory {
  id: string;
  label: string;
  starters: string[];
}

const CATEGORIES: StarterCategory[] = [
  {
    id: 'school',
    label: '🎓 STEM & School',
    starters: [
      "Explain Newton's laws of motion with interactive daily life examples",
      'Solve this calculus integration step-by-step with KaTeX formulas',
      'Explain DNA replication and transcription with a Mermaid lifecycle chart',
      'Teach me Python binary search trees with clean modular code',
    ],
  },
  {
    id: 'finance',
    label: '📈 Markets & Wealth',
    starters: [
      'Compare 24K physical gold vs sovereign gold bonds vs silver ETFs in India',
      'Analyze Nifty 50 and Bank Nifty support/resistance levels for this week',
      'Explain Bitcoin halving mechanics and Ethereum L2 rollup economics',
      'Calculate compounding growth on ₹15,000 monthly SIP over 15 years',
    ],
  },
  {
    id: 'office',
    label: '💼 Office & Tech',
    starters: [
      'Draft an executive project delivery update email for senior management',
      'Generate a system architecture Mermaid diagram for a microservices gateway',
      'Write a Python script to automate messy Excel sheet reconciliation',
      'Review this code snippet for edge cases, null pointers and race conditions',
    ],
  },
  {
    id: 'home',
    label: '🏡 Family & Daily Life',
    starters: [
      'Plan a balanced, budget-friendly 7-day North/South Indian family meal plan',
      'How to test milk and honey for adulteration using standard home tests',
      'Calculate electricity bill savings for a 3kW residential rooftop solar net meter',
      'Suggest a gentle morning flexibility and core strengthening routine for elders',
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
  const sendConversationStarter = useCallback(
    (text: string) => submitMessage({ text }),
    [submitMessage],
  );

  const displayedStarters = useMemo(() => {
    if (selectedCategory === 'all') {
      if (customStarters.length > 0) {
        return customStarters.slice(0, 6);
      }
      return CATEGORIES.flatMap((c) => c.starters.slice(0, 1));
    }
    const cat = CATEGORIES.find((c) => c.id === selectedCategory);
    return cat ? cat.starters : [];
  }, [selectedCategory, customStarters]);

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
        {CATEGORIES.map((cat) => (
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

      {/* Compact Starter Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {displayedStarters.map((text: string, index: number) => (
          <button
            key={index}
            type="button"
            onClick={() => sendConversationStarter(text)}
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
            className="shadow-2xs group flex max-w-[20rem] cursor-pointer items-center rounded-xl border border-border-light bg-surface-secondary/70 px-3 py-1.5 text-xs text-text-secondary transition-all duration-150 fade-in hover:border-border-medium hover:bg-surface-tertiary hover:text-text-primary"
          >
            <span className="line-clamp-2 text-left">{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ConversationStarters;
