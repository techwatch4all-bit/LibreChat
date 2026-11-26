import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { Search, X, Send, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
} from '@librechat/client';
import type { StarterItem } from '~/common/starters';
import { resolvePersonaVisual } from '~/common/personaVisuals';
import { MOTION_GROUPS } from '~/common/starters';
import { deviceLayoutAtom } from '~/store/layout';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import {
  useConversationStartersData,
  parseStarterMeta,
} from './useConversationStartersData';

const PHONE_MAX_PILLS = 4;

export default function ConversationStartersMobile() {
  const { isPhone, isLandscape } = useAtomValue(deviceLayoutAtom);
  const localize = useLocalize();
  const [showAllPhone, setShowAllPhone] = useState(false);

  const {
    isAgentEndpoint,
    modeCategories,
    hasGroupedNavigation,
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
  } = useConversationStartersData();

  const visibleStarters =
    isPhone && !showAllPhone ? displayedStarters.slice(0, PHONE_MAX_PILLS) : displayedStarters;
  const hasMorePhone = isPhone && displayedStarters.length > PHONE_MAX_PILLS;

  return (
    <div className="mb-1.5 mt-0 flex w-full flex-col items-center gap-1.5 px-0">
      {/* Category / Group Navigation */}
      {hasGroupedNavigation ? (
        <>
          <div className="no-scrollbar flex w-full flex-nowrap items-center justify-start gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:justify-center sm:overflow-visible">
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
                'shrink-0 cursor-pointer whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-all',
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
                  'shrink-0 cursor-pointer whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-all',
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
                'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full p-1.5 transition-all',
                isSearchOpen
                  ? 'shadow-xs bg-surface-inverted text-text-inverted'
                  : 'border border-border-light bg-surface-secondary/80 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
              )}
            >
              <Search className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          {isSearchOpen && (
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
          )}
        </>
      ) : (
        <div
          className={cn(
            'no-scrollbar flex w-full items-center gap-1.5 pb-0.5',
            isPhone
              ? 'flex-nowrap justify-start overflow-x-auto pr-4 [mask-image:linear-gradient(to_right,black_88%,transparent)]'
              : 'flex-wrap justify-center',
          )}
        >
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

      {/* Starters Strip / Grid */}
      {visibleStarters.length === 0 ? (
        <div className="w-full rounded-xl border border-border-light/70 bg-surface-secondary/60 px-4 py-3 text-center text-xs text-text-secondary">
          {localize('com_ui_motion_no_matches')}
        </div>
      ) : isPhone ? (
        <div className="flex w-full flex-col items-center gap-2 px-1">
          <div
            className={cn(
              isLandscape
                ? 'no-scrollbar flex w-full flex-nowrap items-center justify-start gap-1.5 overflow-x-auto pb-0.5'
                : 'grid w-full grid-cols-2 gap-2',
            )}
          >
            {visibleStarters.map((item: StarterItem, index: number) => {
              const { cleanTitle, description } = parseStarterMeta(item);
              const visual = resolvePersonaVisual(cleanTitle, item.badge);
              const PersonaIcon = visual.Icon;

              return (
                <button
                  key={`${item.badgeKey ?? item.badge ?? index}-${cleanTitle ?? index}`}
                  type="button"
                  aria-label={cleanTitle && description ? `${cleanTitle}. ${description}` : item.prompt}
                  onClick={() => handleStarterClick(item, isAgentEndpoint)}
                  className={cn(
                    'group flex cursor-pointer border border-border-light/60 bg-white/[0.04] text-left transition-all duration-150 hover:border-border-medium hover:bg-white/[0.08]',
                    isLandscape
                      ? 'shrink-0 flex-row items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1'
                      : 'min-w-0 flex-col items-start justify-between rounded-xl p-2.5',
                  )}
                >
                  <div className="flex w-full items-center gap-2 overflow-hidden">
                    <span
                      className={cn(
                        'flex shrink-0 items-center justify-center border',
                        isLandscape ? 'size-5 rounded-full' : 'size-6 rounded-lg',
                        visual.bg,
                        visual.color,
                      )}
                      aria-hidden="true"
                    >
                      <PersonaIcon className={isLandscape ? 'size-3' : 'size-3.5'} />
                    </span>
                    <span className="truncate text-xs font-semibold text-text-primary">
                      {cleanTitle}
                    </span>
                  </div>
                  {description && !isLandscape && (
                    <p className="mt-1.5 line-clamp-1 w-full text-[11px] leading-snug text-text-tertiary">
                      {description}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
          {hasMorePhone && !isLandscape && (
            <button
              type="button"
              onClick={() => setShowAllPhone((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-full border border-border-light/50 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              {showAllPhone ? (
                <>
                  <span>Show less</span>
                  <ChevronUp className="size-3" aria-hidden="true" />
                </>
              ) : (
                <>
                  <span>Show more</span>
                  <ChevronDown className="size-3" aria-hidden="true" />
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <div
          className={cn(
            'grid w-full gap-2',
            isLandscape ? 'grid-cols-3' : 'grid-cols-2',
          )}
        >
          {visibleStarters.map((item: StarterItem, index: number) => {
            const { cleanTitle, description } = parseStarterMeta(item);
            const visual = resolvePersonaVisual(cleanTitle, item.badge);
            const PersonaIcon = visual.Icon;

            return (
              <button
                key={`${item.badgeKey ?? item.badge ?? index}-${cleanTitle ?? index}`}
                type="button"
                aria-label={cleanTitle && description ? `${cleanTitle}. ${description}` : item.prompt}
                onClick={() => handleStarterClick(item, isAgentEndpoint)}
                className="group flex cursor-pointer flex-col items-start justify-between rounded-xl border border-border-light/70 bg-surface-secondary/70 px-3 py-2.5 text-left transition-all duration-150 hover:border-border-medium hover:bg-surface-tertiary/90 hover:shadow-sm"
              >
                <div className="flex w-full items-center gap-2 overflow-hidden">
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-lg border',
                      visual.bg,
                      visual.color,
                    )}
                    aria-hidden="true"
                  >
                    <PersonaIcon className="size-3.5" />
                  </span>
                  <span className="truncate text-[13px] font-semibold text-text-primary">
                    {cleanTitle}
                  </span>
                </div>
                {description && (
                  <p className="mt-1 line-clamp-1 text-xs text-text-secondary">{description}</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Staged prompt hint */}
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

      {/* Interactive Parameter Modal */}
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
              <p className="mt-1 text-xs text-text-secondary">{parameterModalState.description}</p>
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
}
