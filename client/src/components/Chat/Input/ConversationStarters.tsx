import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import { useAtom } from 'jotai';
import { Search, X, Send } from 'lucide-react';
import { resolvePersonaVisual } from '~/common/personaVisuals';
import { EModelEndpoint, Constants } from 'librechat-data-provider';
import {
  Button,
  Input,
  Label,
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
} from '@librechat/client';
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
import { ALL_CATEGORIES, MOTION_GROUPS, findStarterSlots } from '~/common/starters';
import { getIconEndpoint, getEntity, getModelSpec, cn } from '~/utils';
import { mcpValuesAtomFamily } from '~/store/mcp';
import { forceResize } from '~/utils/textarea';
import { mainTextareaId } from '~/common';
import { useSubmitMessage, useLocalize } from '~/hooks';

/**
 * Active Tab-cycling handler for the staged textarea. Exactly one at a time:
 * staging a new starter detaches the previous one.
 */
let stagedTabHandler: ((ev: KeyboardEvent) => void) | null = null;

const ConversationStarters = () => {
  const { conversation } = useChatContext();
  const methods = useChatFormContext();
  const badgeContext = useBadgeRowContext();
  const agentsMap = useAgentsMapContext();
  const assistantMap = useAssistantsMapContext();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { data: startupConfig } = useGetStartupConfig();
  const { submitMessage } = useSubmitMessage();
  const localize = useLocalize();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<'spotlight' | MotionStudioGroupId>(
    'spotlight',
  );
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stagedHint, setStagedHint] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Phase 2: Interactive Parameter Modal State
  const [parameterModalState, setParameterModalState] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    icon?: string;
    rawTemplate: string;
    slots: StarterSlot[];
    values: Record<string, string>;
    servers: string[];
  }>({
    isOpen: false,
    title: '',
    rawTemplate: '',
    slots: [],
    values: {},
    servers: [],
  });

  const activeMode = conversation?.spec ?? 'Chat';
  const isAgentEndpoint = conversation?.endpoint === EModelEndpoint.agents;

  // Filter categories according to the current model spec / mode
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

  // Reset navigation state and sync MCP servers whenever the user switches mode/spec
  useEffect(() => {
    setSelectedCategory('all');
    setSelectedGroup('spotlight');
    setIsSearchOpen(false);
    setSearchQuery('');
    setStagedHint(false);

    // Auto-select MCP servers defined on the model spec upon switching
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

      // Pre-select required MCP servers in state and in badgeRowContext
      if (servers.length > 0) {
        setMCPValues((prev = []) => Array.from(new Set([...prev, ...servers])));
        if (badgeContext?.mcpServerManager?.setMCPValues) {
          const curr = badgeContext.mcpServerManager.mcpValues ?? [];
          badgeContext.mcpServerManager.setMCPValues(Array.from(new Set([...curr, ...servers])));
        }
      }

      const slots = findStarterSlots(text);

      // Phase 2: For Agent endpoints with parameter slots, pop the interactive task modal for structured form inputs
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

        // Tab / Shift+Tab move between slots; at either end focus is released so
        // the composer never becomes a keyboard trap.
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

    // Replace all [Slot Label] with user provided values or fallback (split/join avoids regex escaping issues)
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

  return (
    <div className="mb-2 mt-0 flex w-full flex-col items-center gap-1.5 px-0">
      {hasGroupedNavigation ? (
        <>
          {/* Row 1: Studio Discipline Groups + Search Toggle */}
          <div className="mb-0.5 flex w-full flex-wrap items-center justify-center gap-1">
            <button
              type="button"
              aria-pressed={!isSearchOpen && selectedGroup === 'spotlight'}
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
                setSelectedGroup('spotlight');
                setSelectedCategory('all');
              }}
              className={cn(
                'cursor-pointer whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium transition-all sm:px-2.5 sm:text-[11.5px]',
                !isSearchOpen && selectedGroup === 'spotlight'
                  ? 'shadow-xs bg-surface-inverted text-text-inverted'
                  : 'border border-border-light bg-surface-secondary/80 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
              )}
            >
              {`✨ ${localize('com_ui_motion_spotlight')}`}
            </button>
            {MOTION_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                aria-pressed={!isSearchOpen && selectedGroup === group.id}
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                  setSelectedGroup(group.id);
                  setSelectedCategory('all');
                }}
                className={cn(
                  'cursor-pointer whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium transition-all sm:px-2.5 sm:text-[11.5px]',
                  !isSearchOpen && selectedGroup === group.id
                    ? 'shadow-xs bg-surface-inverted text-text-inverted'
                    : 'border border-border-light bg-surface-secondary/80 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
                )}
              >
                {localize(group.labelKey, { defaultValue: group.label })}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={isSearchOpen}
              aria-expanded={isSearchOpen}
              aria-label={localize('com_ui_motion_search_button')}
              onClick={() => {
                setIsSearchOpen((prev) => {
                  if (prev) {
                    setSearchQuery('');
                  }
                  return !prev;
                });
              }}
              className={cn(
                'inline-flex cursor-pointer items-center justify-center rounded-full p-1.5 transition-all',
                isSearchOpen
                  ? 'shadow-xs bg-surface-inverted text-text-inverted'
                  : 'border border-border-light bg-surface-secondary/80 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
              )}
            >
              <Search className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Row 2: Live Inline Filter Input OR Contextual Group Sub-Pills */}
          {isSearchOpen ? (
            <div className="relative flex w-full max-w-md items-center">
              <Search
                className="pointer-events-none absolute left-3 size-3.5 text-text-tertiary"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                role="searchbox"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }
                }}
                aria-label={localize('com_ui_motion_search_label')}
                placeholder={localize('com_ui_motion_search_placeholder')}
                className="w-full rounded-full border border-border-medium bg-surface-secondary py-1.5 pl-8 pr-8 text-xs text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
              />
              <button
                type="button"
                aria-label={localize('com_ui_motion_search_clear')}
                onClick={() => {
                  if (searchQuery) {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  } else {
                    setIsSearchOpen(false);
                  }
                }}
                className="absolute right-2 rounded-full p-1 text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            selectedGroup !== 'spotlight' &&
            groupCategories.length > 0 && (
              <div className="flex w-full flex-wrap items-center justify-center gap-1.5">
                <button
                  type="button"
                  aria-pressed={selectedCategory === 'all'}
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    'cursor-pointer whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all',
                    selectedCategory === 'all'
                      ? 'border border-border-heavy bg-surface-tertiary text-text-primary'
                      : 'border border-border-light/80 bg-surface-secondary/60 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
                  )}
                >
                  {localize('com_ui_motion_group_all')}
                </button>
                {groupCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={selectedCategory === cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      'cursor-pointer whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all',
                      selectedCategory === cat.id
                        ? 'border border-border-heavy bg-surface-tertiary text-text-primary'
                        : 'border border-border-light/80 bg-surface-secondary/60 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
                    )}
                  >
                    {localize(cat.labelKey, { defaultValue: cat.label })}
                  </button>
                ))}
              </div>
            )
          )}
        </>
      ) : (
        /* Category Tabs (Non-grouped standard modes) */
        <div className="mb-0.5 flex w-full flex-nowrap items-center justify-start gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={cn(
              'shrink-0 cursor-pointer whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-all',
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
                'shrink-0 cursor-pointer whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-all',
                selectedCategory === cat.id
                  ? 'shadow-xs bg-surface-inverted text-text-inverted'
                  : 'border border-border-light bg-surface-secondary/80 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
              )}
            >
              {localize(cat.labelKey, { defaultValue: cat.label })}
            </button>
          ))}
        </div>
      )}

      {/* Professional Persona Cards Grid */}
      {displayedStarters.length === 0 ? (
        <div className="w-full rounded-xl border border-border-light/70 bg-surface-secondary/60 px-4 py-4 text-center text-xs text-text-secondary">
          {localize('com_ui_motion_no_matches')}
        </div>
      ) : (
        <div
          className={cn(
            'flex w-full flex-wrap items-center justify-center gap-1.5 sm:grid sm:grid-cols-2 sm:gap-2 lg:grid-cols-3',
            isScrollableGrid
              ? 'max-h-[160px] overflow-y-auto pr-0.5 sm:max-h-[320px]'
              : 'max-h-[160px] overflow-y-auto pr-0.5 sm:max-h-none sm:overflow-visible',
          )}
        >
          {displayedStarters.map((item: StarterItem, index: number) => {
            // Parse title, icon, and description if not explicitly set
            let title = item.title;
            let icon = item.icon;
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

            // Strip leading emoji from title if any exists, preserving digits (2D, 3D, etc.)
            let cleanTitle = (title ?? '')
              .replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\uFE0F\uFE0E\s]+/u, '')
              .trim();

            // Resolve modern gold-standard domain visual for this persona
            const visual = resolvePersonaVisual(cleanTitle, item.badge);
            const PersonaIcon = visual.Icon;

            return (
              <button
                key={`${item.badgeKey ?? item.badge ?? index}-${cleanTitle ?? index}`}
                type="button"
                aria-label={cleanTitle && description ? `${cleanTitle}. ${description}` : item.prompt}
                onClick={() => handleStarterClick(item, isAgentEndpoint)}
                style={{ animationDelay: `${index * 20}ms`, animationFillMode: 'backwards' }}
                className="group flex cursor-pointer flex-col items-start justify-between rounded-full border border-border-light/70 bg-surface-secondary/70 px-2.5 py-1.5 text-left transition-all duration-150 hover:border-border-medium hover:bg-surface-tertiary/90 hover:shadow-sm sm:rounded-xl sm:px-3.5 sm:py-3"
              >
                <div className="flex w-full items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 overflow-hidden sm:gap-2.5">
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full border transition-transform duration-150 group-hover:scale-105 sm:size-6 sm:rounded-lg',
                        visual.bg,
                        visual.color,
                      )}
                      aria-hidden="true"
                    >
                      <PersonaIcon className="size-3 sm:size-3.5" />
                    </span>
                    <span className="truncate text-xs font-semibold text-text-primary group-hover:text-text-primary sm:text-[13px]">
                      {cleanTitle}
                    </span>
                  </div>
                  {item.badge && (
                    <span className="hidden shrink-0 rounded bg-surface-tertiary px-1.5 py-0.5 text-[10px] font-medium text-text-secondary transition-colors group-hover:bg-surface-inverted group-hover:text-text-inverted sm:inline-block">
                      {item.badgeKey
                        ? localize(item.badgeKey, { defaultValue: item.badge })
                        : item.badge}
                    </span>
                  )}
                </div>
                <p className="mt-1 hidden line-clamp-2 text-xs leading-relaxed text-text-secondary group-hover:text-text-primary/90 sm:block">
                  {description}
                </p>
                {item.engineTag && (
                  <div className="mt-2.5 hidden w-full items-center justify-between border-t border-border-light/50 pt-1.5 text-[10px] text-text-tertiary sm:flex">
                    <span className="flex items-center gap-1 font-mono font-medium tracking-tight text-text-secondary group-hover:text-text-primary">
                      <span className="inline-block size-1.5 rounded-full bg-emerald-500/80"></span>
                      {item.engineTag}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-text-tertiary group-hover:text-text-secondary">
                      Click to stage
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Staged prompt coach strip — every mode, so the review step is visible */}
      {stagedHint && (
        <div
          role="status"
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border-medium/70 bg-surface-secondary/90 px-3 py-1.5 text-[11px] text-text-secondary"
        >
          <span>{localize('com_ui_motion_staged_hint')}</span>
          <button
            type="button"
            onClick={() => setStagedHint(false)}
            aria-label={localize('com_ui_motion_dismiss_hint')}
            className="shrink-0 rounded p-0.5 text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Phase 2: Interactive Parameter Inputs (Form-to-Agent Modal) */}
      <OGDialog
        open={parameterModalState.isOpen}
        onOpenChange={(open) => setParameterModalState((prev) => ({ ...prev, isOpen: open }))}
      >
        <OGDialogContent className="max-w-md rounded-2xl border border-border-medium bg-surface-primary p-6 shadow-2xl">
          <OGDialogHeader className="mb-4 text-left">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-surface-tertiary text-sm">
                {parameterModalState.icon || '⚡'}
              </span>
              <OGDialogTitle className="text-base font-semibold text-text-primary">
                {parameterModalState.title}
              </OGDialogTitle>
            </div>
            {parameterModalState.description && (
              <p className="mt-1 text-xs text-text-secondary">
                {parameterModalState.description}
              </p>
            )}
          </OGDialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecuteParameterizedTask();
            }}
            className="flex flex-col gap-3.5"
          >
            {parameterModalState.slots.map((slot, index) => (
              <div key={`${slot.label}-${index}`} className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-text-primary">{slot.label}</Label>
                <Input
                  autoFocus={index === 0}
                  value={parameterModalState.values[slot.label] ?? ''}
                  placeholder={`Enter ${slot.label}...`}
                  onChange={(e) => {
                    const val = e.target.value;
                    setParameterModalState((prev) => ({
                      ...prev,
                      values: {
                        ...prev.values,
                        [slot.label]: val,
                      },
                    }));
                  }}
                  className="h-9 w-full rounded-lg border border-border-light bg-surface-secondary px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
                />
              </div>
            ))}

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setParameterModalState((prev) => ({ ...prev, isOpen: false }))}
                className="h-8 rounded-lg px-3 text-xs text-text-secondary hover:bg-surface-tertiary"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm hover:opacity-90"
              >
                <Send className="size-3.5" />
                <span>Run Agent Task</span>
              </Button>
            </div>
          </form>
        </OGDialogContent>
      </OGDialog>
    </div>
  );
};

export default ConversationStarters;
