import React from 'react';
import { Pin, PinOff } from 'lucide';
import { CheckCircle2 } from 'lucide-react';
import { MorphIcon } from '@librechat/client';
import { VisuallyHidden } from '@ariakit/react';
import type { TModelSpec } from 'librechat-data-provider';
import { useFavorites, useLocalize, useIsActiveItem } from '~/hooks';
import { useModelSelectorContext } from '../ModelSelectorContext';
import { CustomMenuItem as MenuItem } from '../CustomMenu';
import { cn, getSpecAgentAvatarURL } from '~/utils';
import SpecDescription from './SpecDescription';
import SpecIcon from './SpecIcon';

interface ModelSpecItemProps {
  spec: TModelSpec;
  isSelected: boolean;
  /** Set when the sibling model list is virtualized; see `VirtualizedModelList`. */
  posInSet?: number;
  setSize?: number;
}

interface SpecMetadata {
  badge: string;
  badgeClass: string;
  cardGlow: string;
}

const SPEC_META: Record<string, SpecMetadata> = {
  chat: {
    badge: 'Fast & Live',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    cardGlow: 'hover:border-sky-500/40',
  },
  work: {
    badge: 'Executive & PRD',
    badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    cardGlow: 'hover:border-indigo-500/40',
  },
  vibecoding: {
    badge: 'Code Architecture',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    cardGlow: 'hover:border-emerald-500/40',
  },
  vibecoder: {
    badge: 'Code Architecture',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    cardGlow: 'hover:border-emerald-500/40',
  },
  study: {
    badge: 'STEM Tutor',
    badgeClass: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    cardGlow: 'hover:border-teal-500/40',
  },
  'study-local': {
    badge: 'Local STEM Tutor',
    badgeClass: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    cardGlow: 'hover:border-teal-500/40',
  },
  privacy: {
    badge: '100% Local · Sovereign',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    cardGlow: 'hover:border-amber-500/40',
  },
  motion: {
    badge: 'Cinema 60fps · GSAP',
    badgeClass: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30',
    cardGlow: 'hover:border-fuchsia-500/40',
  },
};

export function ModelSpecItem({ spec, isSelected, posInSet, setSize }: ModelSpecItemProps) {
  const localize = useLocalize();
  const { handleSelectSpec, endpointsConfig, agentsMap } = useModelSelectorContext();
  const { isFavoriteSpec, toggleFavoriteSpec } = useFavorites();
  const { showIconInMenu = true } = spec;
  const agentAvatarURL = getSpecAgentAvatarURL(spec, agentsMap);

  const { ref: itemRef, isActive } = useIsActiveItem<HTMLDivElement>();

  const isFavorite = isFavoriteSpec(spec.name);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavoriteSpec(spec.name);
  };

  const specKey = spec.name?.toLowerCase?.() ?? '';
  const meta = SPEC_META[specKey];

  return (
    <MenuItem
      ref={itemRef}
      onClick={() => handleSelectSpec(spec)}
      aria-selected={isSelected || undefined}
      aria-posinset={posInSet}
      aria-setsize={setSize}
      className={cn(
        'group relative my-1 flex w-full cursor-pointer items-start justify-between rounded-xl border p-2.5 text-sm transition-all duration-150',
        isSelected
          ? 'border-border-medium bg-surface-active/80 shadow-md ring-1 ring-border-light/40'
          : cn(
              'border-transparent hover:bg-surface-hover/70',
              meta?.cardGlow ?? 'hover:border-border-light',
            ),
      )}
    >
      <div className="flex w-full min-w-0 items-start gap-3">
        {showIconInMenu && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-light/60 bg-surface-tertiary shadow-sm transition-all duration-200 group-hover:scale-105 group-hover:bg-surface-hover">
            <SpecIcon
              currentSpec={spec}
              endpointsConfig={endpointsConfig}
              agentAvatarURL={agentAvatarURL}
              size={19}
            />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold tracking-tight text-text-primary">
              {spec.label}
            </span>
            {meta?.badge && (
              <span
                className={cn(
                  'rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
                  meta.badgeClass,
                )}
              >
                {meta.badge}
              </span>
            )}
          </div>
          {spec.description && (
            <div className="line-clamp-2 text-xs leading-relaxed text-text-secondary">
              <SpecDescription description={spec.description} />
            </div>
          )}
        </div>
      </div>
      <div className="ml-2 flex shrink-0 items-center gap-1.5 self-center">
        <button
          type="button"
          tabIndex={isActive ? 0 : -1}
          onClick={handleFavoriteClick}
          aria-label={isFavorite ? localize('com_ui_unpin') : localize('com_ui_pin')}
          className={cn(
            'rounded-lg p-1 text-text-tertiary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-primary',
            isFavorite
              ? 'visible text-amber-400'
              : 'group-focus-within:visible group-hover:visible group-data-[active-item]:visible [@media(hover:hover)]:invisible',
          )}
        >
          <MorphIcon icon={isFavorite ? PinOff : Pin} className="h-4 w-4" />
        </button>
        {isSelected && (
          <>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-text-primary" aria-hidden="true" />
            <VisuallyHidden>{localize('com_a11y_selected')}</VisuallyHidden>
          </>
        )}
      </div>
    </MenuItem>
  );
}

export function renderModelSpecs(specs: TModelSpec[], selectedSpec: string) {
  if (!specs || specs.length === 0) {
    return null;
  }

  return specs.map((spec) => (
    <ModelSpecItem key={spec.name} spec={spec} isSelected={selectedSpec === spec.name} />
  ));
}
