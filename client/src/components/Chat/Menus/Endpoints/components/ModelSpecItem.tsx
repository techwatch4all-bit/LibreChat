import React, { useState } from 'react';
import { Pin, PinOff } from 'lucide';
import { CheckCircle2, Lock } from 'lucide-react';
import { MorphIcon } from '@librechat/client';
import { VisuallyHidden } from '@ariakit/react';
import type { TModelSpec } from 'librechat-data-provider';
import { useFavorites, useLocalize, useIsActiveItem, useAuthContext } from '~/hooks';
import { useModelSelectorContext } from '../ModelSelectorContext';
import { CustomMenuItem as MenuItem } from '../CustomMenu';
import { cn, getSpecAgentAvatarURL } from '~/utils';
import SpecDescription from './SpecDescription';
import SpecIcon from './SpecIcon';
import SatchiUpgradeModal from '~/components/Chat/Input/SatchiUpgradeModal';

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
  openfilm: {
    badge: 'OpenFilm 4-Editor Suite',
    badgeClass: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    cardGlow: 'hover:border-violet-500/40',
  },
  'satchida-3d-studio': {
    badge: '3D Video Studio',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    cardGlow: 'hover:border-rose-500/40',
  },
  scenemosaic: {
    badge: '3D Spatial Room',
    badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    cardGlow: 'hover:border-orange-500/40',
  },
  deeptutor: {
    badge: 'AI Academic Studio',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    cardGlow: 'hover:border-teal-500/40',
  },
  'health-wellness': {
    badge: 'Holistic Wellness',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    cardGlow: 'hover:border-rose-500/40',
  },
  'panchang-vedic': {
    badge: 'Vedic Almanac',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    cardGlow: 'hover:border-amber-500/40',
  },
  'architect-studio': {
    badge: 'Spatial Planning',
    badgeClass: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    cardGlow: 'hover:border-cyan-500/40',
  },
  'maker-hardware': {
    badge: 'Electronics & DIY',
    badgeClass: 'bg-lime-500/15 text-lime-400 border-lime-500/30',
    cardGlow: 'hover:border-lime-500/40',
  },
  'document-vault': {
    badge: 'Docs & Stories',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    cardGlow: 'hover:border-blue-500/40',
  },
  pro: {
    badge: 'Pro Seat Tier',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    cardGlow: 'hover:border-purple-500/40',
  },
};

export function ModelSpecItem({ spec, isSelected, posInSet, setSize }: ModelSpecItemProps) {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const { handleSelectSpec, endpointsConfig, agentsMap } = useModelSelectorContext();
  const { isFavoriteSpec, toggleFavoriteSpec } = useFavorites();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
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

  // Studio and advanced tools paywall definition
  const STUDIO_SPECS = new Set([
    'motion',
    'satchida-studio',
    'satchida studio',
    'scenemosaic',
    'deeptutor',
    'health-wellness',
    'panchang-vedic',
    'architect-studio',
    'maker-hardware',
    'document-vault',
    'office-suite',
    'vibecoding',
    'vibecoder',
    'pro',
  ]);

  const userAccountType = (user?.accountType || '').toLowerCase();
  // Tenant Admin does NOT automatically grant Pro studio access; requires Pro, Pro_Family, Enterprise, or Privacy tier
  const isProTier = ['pro', 'pro_family', 'enterprise', 'privacy'].includes(userAccountType);
  const isLocked = STUDIO_SPECS.has(specKey) && !isProTier;

  const handleClick = (e: React.MouseEvent) => {
    if (isLocked) {
      e.preventDefault();
      e.stopPropagation();
      setShowUpgradeModal(true);
      return;
    }
    handleSelectSpec(spec);
  };

  return (
    <>
      <MenuItem
        ref={itemRef}
        onClick={handleClick}
        aria-selected={isSelected || undefined}
        aria-posinset={posInSet}
        aria-setsize={setSize}
        className={cn(
          'group relative my-1 flex w-full cursor-pointer items-start justify-between rounded-xl border p-2.5 text-sm transition-all duration-150',
          isLocked
            ? 'border-transparent opacity-85 hover:border-amber-500/30 hover:bg-surface-hover/50'
            : isSelected
              ? 'border-border-medium bg-surface-active/80 shadow-md ring-1 ring-border-light/40'
              : cn(
                  'border-transparent hover:bg-surface-hover/70',
                  meta?.cardGlow ?? 'hover:border-border-light',
                ),
        )}
      >
        <div className="flex w-full min-w-0 items-start gap-3">
          {showIconInMenu && (
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-light/60 bg-surface-tertiary shadow-sm transition-all duration-200 group-hover:scale-105 group-hover:bg-surface-hover">
              <SpecIcon
                currentSpec={spec}
                endpointsConfig={endpointsConfig}
                agentAvatarURL={agentAvatarURL}
                size={19}
              />
              {isLocked && (
                <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/90 text-surface-primary shadow">
                  <Lock className="h-2.5 w-2.5" />
                </div>
              )}
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold tracking-tight text-text-primary">
                {spec.label}
              </span>
              {isLocked ? (
                <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
                  <Lock className="h-2.5 w-2.5" />
                  PRO
                </span>
              ) : (
                meta?.badge && (
                  <span
                    className={cn(
                      'rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
                      meta.badgeClass,
                    )}
                  >
                    {meta.badge}
                  </span>
                )
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
          {isLocked ? (
            <div className="flex h-7 items-center rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 text-[10px] font-semibold text-amber-400">
              Site Admin
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </MenuItem>
      {showUpgradeModal && (
        <SatchiUpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          featureName="studio"
        />
      )}
    </>
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
