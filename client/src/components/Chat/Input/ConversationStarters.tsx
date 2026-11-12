import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { Search, X } from 'lucide-react';
import { EModelEndpoint, Constants } from 'librechat-data-provider';
import type { MotionStudioGroupId, StarterItem } from '~/common/starters';
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
import { getIconEndpoint, getEntity, getModelSpec, cn } from '~/utils';
import { ALL_CATEGORIES, MOTION_GROUPS } from '~/common/starters';
import { useSubmitMessage, useLocalize } from '~/hooks';
import { mcpValuesAtomFamily } from '~/store/mcp';
import { forceResize } from '~/utils/textarea';
import { mainTextareaId } from '~/common';

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
  const localize = useLocalize();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<'spotlight' | MotionStudioGroupId>(
    'spotlight',
  );
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stagedHint, setStagedHint] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeMode = conversation?.spec ?? 'Chat';

  // Filter categories according to the current model spec / mode
  const modeCategories = useMemo(() => {
    const matched = ALL_CATEGORIES.filter((cat) => !cat.modes || cat.modes.includes(activeMode));
    return matched.length > 0 ? matched : ALL_CATEGORIES;
  }, [activeMode]);

  const hasGroupedNavigation = useMemo(
    () => modeCategories.some((cat) => Boolean(cat.group)),
    [modeCategories],
  );

  const groupCategories = useMemo(() => {
    if (!hasGroupedNavigation || selectedGroup === 'spotlight') {
      return [];
    }
    return modeCategories.filter((cat) => cat.group === selectedGroup);
  }, [hasGroupedNavigation, modeCategories, selectedGroup]);

  // Reset navigation state whenever the user switches mode/spec
  useEffect(() => {
    setSelectedCategory('all');
    setSelectedGroup('spotlight');
    setIsSearchOpen(false);
    setSearchQuery('');
    setStagedHint(false);
  }, [activeMode]);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

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

      // Requires context? Any [...] placeholder, a <...> slot, or a deictic
      // reference to content the user has not pasted yet ("this code", "this
      // plan", ...) stages the prompt instead of submitting an empty turn.
      // In Motion Studio, always stage the prompt for user input & customization.
      const isTemplate =
        activeMode === 'Motion' ||
        /\[|<|this (message|code|query|plan|dataset|documents?|snippet|requirement|pdf|image)\b/i.test(
          text,
        );

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

          // Highlight the first real parameter. A leading label-bracket like
          // [CBSE/ICSE Class 12] is a tag, not an input — skip past it so the
          // user overwrites the slot they actually need to fill.
          let openBracket = text.indexOf('[');
          if (openBracket === 0) {
            const labelClose = text.indexOf(']', 1);
            const next = labelClose === -1 ? -1 : text.indexOf('[', labelClose + 1);
            if (next !== -1) {
              openBracket = next;
            }
          }
          const closeBracket = text.indexOf(']', openBracket);
          if (openBracket !== -1 && closeBracket !== -1) {
            textarea.setSelectionRange(openBracket, closeBracket + 1);
          } else {
            textarea.setSelectionRange(text.length, text.length);
          }

          // Tab / Shift+Tab cycle through the remaining [...] parameters, then
          // release focus once every slot has been visited.
          if (stagedTabHandler) {
            textarea.removeEventListener('keydown', stagedTabHandler);
          }
          stagedTabHandler = (ev: KeyboardEvent) => {
            if (ev.key !== 'Tab') return;
            const dir = ev.shiftKey ? -1 : 1;
            const curOpen = text[textarea.selectionStart] === '[' ? textarea.selectionStart : -1;
            let target =
              dir > 0
                ? text.indexOf('[', textarea.selectionEnd)
                : text.lastIndexOf('[', Math.max(textarea.selectionStart - 1, 0));
            if (target === -1) {
              target = dir > 0 ? text.indexOf('[') : text.lastIndexOf('[');
            }
            if (target === -1 || target === curOpen) return; // all slots visited — let Tab move focus
            const targetClose = text.indexOf(']', target);
            if (targetClose === -1) return;
            ev.preventDefault();
            textarea.setSelectionRange(target, targetClose + 1);
          };
          textarea.addEventListener('keydown', stagedTabHandler);
        }
        if (hasGroupedNavigation) {
          setStagedHint(true);
        }
        return;
      }

      // Standalone queries can execute immediately
      submitMessage({ text });
    },
    [submitMessage, setMCPValues, badgeContext, methods, activeMode, hasGroupedNavigation],
  );

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
        <div className="mb-0.5 flex flex-wrap items-center justify-center gap-1.5">
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
            'grid w-full grid-cols-1 gap-2 sm:grid-cols-2',
            isScrollableGrid && 'max-h-[290px] overflow-y-auto pr-0.5',
          )}
        >
          {displayedStarters.map((item: StarterItem, index: number) => {
            // Parse title, icon, and description if not explicitly set
            let title = item.title;
            let icon = item.icon;
            let description = item.description;

            if (!title || !description) {
              const promptText = item.prompt;
              const colonIndex = promptText.indexOf(':');
              if (colonIndex > 0 && colonIndex < 70) {
                title = title ?? promptText.slice(0, colonIndex).trim();
                description = description ?? promptText.slice(colonIndex + 1).trim();
              } else {
                title = title ?? (item.badge ? `${item.badge} Directive` : promptText.slice(0, 36));
                description = description ?? promptText;
              }
            }

            // Extract leading emoji from title if icon wasn't explicitly provided
            if (title && !icon) {
              const emojiMatch = title.match(
                /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u,
              );
              if (emojiMatch) {
                icon = emojiMatch[1];
                title = title.slice(emojiMatch[0].length).trim();
              }
            }

            if (!icon) {
              // Assign distinct contextual icon based on badge or title keywords
              const lower = `${title} ${item.badge ?? ''}`.toLowerCase();
              if (lower.includes('gold') || lower.includes('bullion') || lower.includes('rates')) {
                icon = '🌟';
              } else if (
                lower.includes('model') ||
                lower.includes('ai') ||
                lower.includes('tech') ||
                lower.includes('code')
              ) {
                icon = '🤖';
              } else if (
                lower.includes('law') ||
                lower.includes('court') ||
                lower.includes('govt') ||
                lower.includes('precedent')
              ) {
                icon = '⚖️';
              } else if (
                lower.includes('alert') ||
                lower.includes('disaster') ||
                lower.includes('sos') ||
                lower.includes('emergency')
              ) {
                icon = '🚨';
              } else if (
                lower.includes('stock') ||
                lower.includes('market') ||
                lower.includes('crypto') ||
                lower.includes('equity')
              ) {
                icon = '📈';
              } else if (
                lower.includes('health') ||
                lower.includes('pharma') ||
                lower.includes('clinic') ||
                lower.includes('medicine')
              ) {
                icon = '🩺';
              } else if (
                lower.includes('rail') ||
                lower.includes('transit') ||
                lower.includes('flight') ||
                lower.includes('traffic')
              ) {
                icon = '🚆';
              } else if (
                lower.includes('research') ||
                lower.includes('policy') ||
                lower.includes('audit') ||
                lower.includes('scholar')
              ) {
                icon = '🔬';
              } else if (
                lower.includes('vault') ||
                lower.includes('rag') ||
                lower.includes('security') ||
                lower.includes('privacy')
              ) {
                icon = '🛡️';
              } else if (lower.includes('panchang') || lower.includes('vedic')) {
                icon = '🕉️';
              } else if (lower.includes('ayurv')) {
                icon = '🌿';
              } else {
                icon = '💡';
              }
            }

            return (
              <button
                key={`${item.badgeKey ?? item.badge ?? index}-${title ?? index}`}
                type="button"
                aria-label={item.prompt}
                onClick={() => handleStarterClick(item)}
                style={{ animationDelay: `${index * 20}ms`, animationFillMode: 'backwards' }}
                className="group flex cursor-pointer flex-col items-start justify-between rounded-xl border border-border-light/70 bg-surface-secondary/70 px-3 py-2 text-left transition-all duration-150 hover:border-border-medium hover:bg-surface-tertiary/90 hover:shadow-sm"
              >
                <div className="flex w-full items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="shrink-0 text-sm leading-none" aria-hidden="true">
                      {icon}
                    </span>
                    <span className="truncate text-xs font-semibold text-text-primary group-hover:text-text-primary">
                      {title}
                    </span>
                  </div>
                  {item.badge && (
                    <span className="shrink-0 rounded bg-surface-tertiary px-1.5 py-0.5 text-[9px] font-medium text-text-secondary transition-colors group-hover:bg-surface-inverted group-hover:text-text-inverted">
                      {item.badgeKey
                        ? localize(item.badgeKey, { defaultValue: item.badge })
                        : item.badge}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-1 text-[11px] leading-normal text-text-secondary group-hover:text-text-primary/90">
                  {description}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Staged Prompt Coach Strip (Motion Studio) */}
      {hasGroupedNavigation && stagedHint && (
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
    </div>
  );
};

export default ConversationStarters;
