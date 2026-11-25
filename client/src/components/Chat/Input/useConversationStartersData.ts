import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { EModelEndpoint, Constants } from 'librechat-data-provider';
import type { MotionStudioGroupId, StarterItem, StarterSlot } from '~/common/starters';
import {
  useChatContext,
  useChatFormContext,
  useAgentsMapContext,
  useAssistantsMapContext,
  useBadgeRowContext,
} from '~/Providers';
import {
  useGetAssistantDocsQuery,
  useGetEndpointsQuery,
  useGetStartupConfig,
} from '~/data-provider';
import { ALL_CATEGORIES, findStarterSlots } from '~/common/starters';
import { getIconEndpoint, getEntity, getModelSpec } from '~/utils';
import { mcpValuesAtomFamily } from '~/store/mcp';
import { forceResize } from '~/utils/textarea';
import { mainTextareaId } from '~/common';
import { useSubmitMessage } from '~/hooks';

let stagedTabHandler: ((ev: KeyboardEvent) => void) | null = null;

export interface ParameterModalState {
  isOpen: boolean;
  title: string;
  description?: string;
  icon?: string;
  rawTemplate: string;
  slots: StarterSlot[];
  values: Record<string, string>;
  servers: string[];
}

export function parseStarterMeta(item: StarterItem) {
  let title = item.title;
  let description = item.description;

  if (!title || !description) {
    const promptText = item.prompt;
    const firstLine = promptText.split('\n')[0].trim();
    const dashIndex = firstLine.indexOf(' — ');
    const colonIndex = firstLine.indexOf(':');
    if (dashIndex > 0) {
      title = title ?? firstLine.slice(0, dashIndex).trim();
      description = description ?? firstLine.slice(dashIndex + 3).trim();
    } else if (colonIndex > 0 && colonIndex < 70) {
      title = title ?? firstLine.slice(0, colonIndex).trim();
      description = description ?? firstLine.slice(colonIndex + 1).trim();
    } else {
      title = title ?? item.badge ?? firstLine.slice(0, 36);
      description = description ?? firstLine;
    }
  }

  const cleanTitle = (title ?? '')
    .replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\uFE0F\uFE0E\s]+/u, '')
    .trim();

  return {
    title,
    cleanTitle,
    description,
  };
}

export function useConversationStartersData() {
  const { conversation } = useChatContext();
  const methods = useChatFormContext();
  const badgeContext = useBadgeRowContext();
  const agentsMap = useAgentsMapContext();
  const assistantMap = useAssistantsMapContext();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { data: startupConfig } = useGetStartupConfig();
  const { submitMessage } = useSubmitMessage();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<'spotlight' | MotionStudioGroupId>(
    'spotlight',
  );
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stagedHint, setStagedHint] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [parameterModalState, setParameterModalState] = useState<ParameterModalState>({
    isOpen: false,
    title: '',
    rawTemplate: '',
    slots: [],
    values: {},
    servers: [],
  });

  const activeMode = conversation?.spec ?? 'Chat';
  const isAgentEndpoint = conversation?.endpoint === EModelEndpoint.agents;

  const modeCategories = useMemo(() => {
    if (isAgentEndpoint) {
      return [];
    }
    const matched = ALL_CATEGORIES.filter((cat) => !cat.modes || cat.modes.includes(activeMode));
    return matched.length > 0 ? matched : ALL_CATEGORIES;
  }, [activeMode, isAgentEndpoint]);

  const hasGroupedNavigation = useMemo(
    () => !isAgentEndpoint && modeCategories.some((cat) => Boolean(cat.group)),
    [isAgentEndpoint, modeCategories],
  );

  const groupCategories = useMemo(() => {
    if (!hasGroupedNavigation || selectedGroup === 'spotlight') {
      return [];
    }
    return modeCategories.filter((cat) => cat.group === selectedGroup);
  }, [hasGroupedNavigation, modeCategories, selectedGroup]);

  const convoKey = conversation?.conversationId ?? Constants.NEW_CONVO;
  const [, setMCPValues] = useAtom(mcpValuesAtomFamily(convoKey));

  const modelSpec = useMemo(
    () => getModelSpec({ specName: conversation?.spec, startupConfig }),
    [conversation?.spec, startupConfig],
  );

  useEffect(() => {
    setSelectedCategory('all');
    setSelectedGroup('spotlight');
    setIsSearchOpen(false);
    setSearchQuery('');
    setStagedHint(false);

    const specServers = modelSpec?.mcpServers;
    if (Array.isArray(specServers) && specServers.length > 0) {
      setMCPValues((prev = []) => Array.from(new Set([...prev, ...specServers])));
      if (badgeContext?.mcpServerManager?.setMCPValues) {
        const curr = badgeContext.mcpServerManager.mcpValues ?? [];
        badgeContext.mcpServerManager.setMCPValues(
          Array.from(new Set([...curr, ...specServers])),
        );
      }
    }
  }, [activeMode, modelSpec, setMCPValues, badgeContext]);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

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

  const handleStarterClick = useCallback(
    (starter: StarterItem | string, autoExecute = false) => {
      const text = typeof starter === 'string' ? starter : starter.prompt;
      const servers = typeof starter === 'string' ? [] : (starter.mcpServers ?? []);

      if (servers.length > 0) {
        setMCPValues((prev = []) => Array.from(new Set([...prev, ...servers])));
        if (badgeContext?.mcpServerManager?.setMCPValues) {
          const curr = badgeContext.mcpServerManager.mcpValues ?? [];
          badgeContext.mcpServerManager.setMCPValues(Array.from(new Set([...curr, ...servers])));
        }
      }

      const slots = findStarterSlots(text);

      if (isAgentEndpoint && slots.length > 0) {
        const initialValues: Record<string, string> = {};
        slots.forEach((s) => {
          initialValues[s.label] = '';
        });
        const title =
          typeof starter === 'string' ? 'Configure Agent Task' : starter.title || 'Configure Agent Task';
        const description = typeof starter === 'string' ? undefined : starter.description;
        const icon = typeof starter === 'string' ? '⚡' : starter.icon || '⚡';
        setParameterModalState({
          isOpen: true,
          title,
          description,
          icon,
          rawTemplate: text,
          slots,
          values: initialValues,
          servers,
        });
        return;
      }

      const textarea = document.getElementById(mainTextareaId) as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.value = text;
        if (methods?.setValue) {
          methods.setValue('text', text, { shouldDirty: true, shouldValidate: true });
        }
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        forceResize(textarea);
        textarea.focus();

        const firstSlot = slots[0];
        if (firstSlot) {
          textarea.setSelectionRange(firstSlot.start, firstSlot.end);
        } else {
          textarea.setSelectionRange(text.length, text.length);
        }

        if (stagedTabHandler) {
          textarea.removeEventListener('keydown', stagedTabHandler);
        }
        stagedTabHandler = (ev: KeyboardEvent) => {
          if (ev.key !== 'Tab' || slots.length === 0) return;
          const current = slots.findIndex(
            (slot) => textarea.selectionStart >= slot.start && textarea.selectionStart < slot.end,
          );
          if (current === -1) return;
          const next = current + (ev.shiftKey ? -1 : 1);
          if (next < 0 || next >= slots.length) return;
          ev.preventDefault();
          textarea.setSelectionRange(slots[next].start, slots[next].end);
        };
        textarea.addEventListener('keydown', stagedTabHandler);
      }

      if (autoExecute && slots.length === 0) {
        submitMessage({ text });
      } else {
        setStagedHint(true);
      }
    },
    [isAgentEndpoint, setMCPValues, badgeContext, methods, submitMessage],
  );

  const handleExecuteParameterizedTask = useCallback(() => {
    const { rawTemplate, values, servers } = parameterModalState;
    if (!rawTemplate) return;

    if (servers.length > 0) {
      setMCPValues((prev = []) => Array.from(new Set([...prev, ...servers])));
      if (badgeContext?.mcpServerManager?.setMCPValues) {
        const curr = badgeContext.mcpServerManager.mcpValues ?? [];
        badgeContext.mcpServerManager.setMCPValues(Array.from(new Set([...curr, ...servers])));
      }
    }

    let compiled = rawTemplate;
    Object.entries(values).forEach(([label, val]) => {
      const cleanVal = val.trim();
      const target = `[${label}]`;
      compiled = compiled.split(target).join(cleanVal || target);
    });

    const textarea = document.getElementById(mainTextareaId) as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.value = compiled;
      if (methods?.setValue) {
        methods.setValue('text', compiled, { shouldDirty: true, shouldValidate: true });
      }
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      forceResize(textarea);
    }

    setParameterModalState((prev) => ({ ...prev, isOpen: false }));
    submitMessage({ text: compiled });
  }, [parameterModalState, setMCPValues, badgeContext, methods, submitMessage]);

  const displayedStarters = useMemo(() => {
    if (hasGroupedNavigation) {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      if (isSearchOpen && normalizedQuery.length > 0) {
        const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
        return modeCategories
          .flatMap((cat) => cat.starters)
          .filter((item) => {
            const haystack = [
              item.title,
              item.description,
              item.badge,
              item.engineTag,
              ...(item.keywords ?? []),
              item.prompt,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return tokens.every((token) => haystack.includes(token));
          });
      }

      if (selectedGroup === 'spotlight') {
        const spotlight = modeCategories.flatMap((cat) =>
          cat.starters.filter((item) => item.featured),
        );
        return spotlight.length > 0
          ? spotlight
          : modeCategories.flatMap((c) => c.starters.slice(0, 1));
      }

      if (selectedCategory === 'all') {
        return groupCategories.flatMap((cat) => cat.starters);
      }

      const activeCat = groupCategories.find((cat) => cat.id === selectedCategory);
      return activeCat ? activeCat.starters : [];
    }

    if (selectedCategory === 'all') {
      if (customStarters.length > 0) {
        return customStarters.slice(0, 10).map((s: string) => ({ prompt: s }));
      }
      return modeCategories.flatMap((c) => c.starters.slice(0, 2));
    }
    const cat = modeCategories.find((c) => c.id === selectedCategory);
    return cat ? cat.starters.slice(0, 10) : [];
  }, [
    hasGroupedNavigation,
    searchQuery,
    isSearchOpen,
    modeCategories,
    selectedGroup,
    selectedCategory,
    groupCategories,
    customStarters,
  ]);

  const isScrollableGrid = hasGroupedNavigation && displayedStarters.length > 8;

  return {
    isAgentEndpoint,
    modeCategories,
    hasGroupedNavigation,
    groupCategories,
    selectedCategory,
    setSelectedCategory,
    selectedGroup,
    setSelectedGroup,
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    stagedHint,
    setStagedHint,
    searchInputRef,
    parameterModalState,
    setParameterModalState,
    handleStarterClick,
    handleExecuteParameterizedTask,
    displayedStarters,
    isScrollableGrid,
  };
}
