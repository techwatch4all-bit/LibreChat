/* eslint-disable i18next/no-literal-string */
import React, { memo } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { accountTypeModes, resolveTenantAccountType } from 'librechat-data-provider';
import {
  MessageSquare,
  Briefcase,
  GraduationCap,
  ShieldCheck,
  ChevronDown,
  Code2,
  Lock,
  ArrowUpRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  TooltipAnchor,
} from '@librechat/client';
import type { EModelEndpoint, TConversation } from 'librechat-data-provider';
import type { SetterOrUpdater } from 'recoil';
import type { TranslationKeys } from '~/hooks/useLocalize';
import {
  satchiModeAtom,
  satchiStyleAtom,
  satchiThinkAtom,
  type SatchiMode,
} from '~/store/satchiStore';
import { useGetStartupConfig, useProjectsInfiniteQuery } from '~/data-provider';
import { useLocalize, useAuthContext } from '~/hooks';
import SatchiUpgradeModal from './SatchiUpgradeModal';
import { cn, getModelSpec } from '~/utils';

interface SatchiModeSelectorProps {
  conversation?: TConversation | null;
  setConversation?: SetterOrUpdater<TConversation | null>;
  disabled?: boolean;
}

interface ModeDef {
  id: SatchiMode;
  labelKey: TranslationKeys;
  defaultLabel: string;
  descKey: TranslationKeys;
  defaultDesc: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor?: string;
  proOnly?: boolean;
}

const MODES: ModeDef[] = [
  {
    id: 'Chat',
    labelKey: 'com_satchi_mode_chat',
    defaultLabel: 'Chat',
    descKey: 'com_satchi_mode_chat_desc',
    defaultDesc: 'Everyday conversational assistant (Fast & responsive)',
    icon: MessageSquare,
  },
  {
    id: 'Work',
    labelKey: 'com_satchi_mode_work',
    defaultLabel: 'Work',
    descKey: 'com_satchi_mode_work_desc',
    defaultDesc: 'Deep productivity, business analysis, coding & planning',
    icon: Briefcase,
  },
  {
    id: 'VibeCoder',
    labelKey: 'com_satchi_mode_vibecoder',
    defaultLabel: 'Vibe Coder',
    descKey: 'com_satchi_mode_vibecoder_desc',
    defaultDesc: 'Rapid full-stack web app synthesis & interactive in-browser preview',
    icon: Code2,
    accentColor: 'text-violet-500 dark:text-violet-400',
    proOnly: true,
  },
  {
    id: 'Study',
    labelKey: 'com_satchi_mode_study',
    defaultLabel: 'Study',
    descKey: 'com_satchi_mode_study_desc',
    defaultDesc: 'Educational tutor, textbook study & concept explanations',
    icon: GraduationCap,
  },
  {
    id: 'Privacy',
    labelKey: 'com_satchi_mode_privacy',
    defaultLabel: 'Privacy',
    descKey: 'com_satchi_mode_privacy_desc',
    defaultDesc: '100% On-device sovereign model (Zero external cloud inference)',
    icon: ShieldCheck,
    accentColor: 'text-emerald-500 dark:text-emerald-400',
    proOnly: true,
  },
];

function SatchiModeSelector({
  conversation,
  setConversation,
  disabled = false,
}: SatchiModeSelectorProps) {
  const navigate = useNavigate();
  const [currentMode, setMode] = useAtom(satchiModeAtom);
  const localize = useLocalize();
  const { user } = useAuthContext();
  const accountType = String(user?.accountType ?? 'basic').toLowerCase();
  const isChild = user?.familyRole === 'minor';
  const [upgradeModal, setUpgradeModal] = React.useState<{
    open: boolean;
    feature: 'work' | 'study' | 'vibecoding' | 'privacy';
  }>({ open: false, feature: 'vibecoding' });

  // UI affordances reflect server-provisioned account/profile. API and tool
  // execution endpoints remain the authorization boundary.
  //
  // The account-type table is the shared one, so the modes greyed out here are
  // the modes the server refuses. The rules it encodes are:
  //
  //   basic, standard   chat only
  //   family             chat and study. A family is a household, and work is
  //                     the mode with the developer tools.
  //   pro, pro_family    chat, study and work
  //   enterprise         all of pro, plus the privacy mode
  //   privacy            all of pro, plus the privacy mode
  //
  // A seat that belongs to no account type is treated as basic or standard:
  // the chat mode, with the other modes visible but locked.
  const effectiveType = resolveTenantAccountType(accountType);
  const allowedModes = accountTypeModes(effectiveType);
  // The operator (ADMIN role) manages the fleet and is entitled to every cloud
  // mode and work tool regardless of its seat allocation. The server enforces the
  // same bypass: an operator session carries no `seatToken`, so it is processed
  // outside the tenant-seat policy block in the custom-initialize handler.
  const isAdmin = user?.role === 'ADMIN';
  const isPro = Boolean(
    isAdmin || ['pro', 'pro_family', 'enterprise', 'privacy'].includes(accountType),
  );
  const isFamily = effectiveType === 'family';
  // A dedicated `privacy` seat is a local product. It may also reach the cloud
  // when the operator granted it, but the affordance is driven by the
  // server-provided capability list rather than by the account type, so the
  // client never decides on its own that a Privacy seat cannot use Work.
  const isPrivacySeat = effectiveType === 'privacy';
  // Operator bypasses the account-type mode table and the work-tool capability
  // gate (which is what greys out the pptx/docx/host/write/attach tools). Privacy
  // is intentionally NOT bypassed: it is a fail-closed local product that needs
  // a provisioned per-node assertion, so it stays gated by the seat policy.
  const allowWork = isAdmin || (!isChild && allowedModes.includes('Work'));
  const allowStudy = isAdmin || allowedModes.includes('Study');
  const canUseWorkTools =
    isAdmin ||
    ((isPro || isPrivacySeat) &&
      !isFamily &&
      !isChild &&
      (user?.tenantSeatCapabilities?.length ?? 0) > 0);
  const canUsePrivacy =
    allowedModes.includes('Privacy') && !(isFamily && user?.privacyEntitled !== true);

  // If conversation has a spec, keep currentMode in sync if matching
  const activeMode = (conversation?.spec as SatchiMode) || currentMode;
  const activeDef = MODES.find((m) => m.id === activeMode) || MODES[0];
  const ActiveIcon = activeDef.icon;
  const activeLabel = localize(activeDef.labelKey) || activeDef.defaultLabel;

  const setStyle = useSetAtom(satchiStyleAtom);
  const setThink = useSetAtom(satchiThinkAtom);
  const { data: startupConfig } = useGetStartupConfig();
  const { data: projectsData } = useProjectsInfiniteQuery(
    { sortBy: 'updatedAt', sortDirection: 'desc', limit: 10 },
    { enabled: canUseWorkTools },
  );

  const handleSelectMode = (mode: SatchiMode) => {
    if (disabled) return;

    if (mode === 'Work' && !allowWork) {
      setUpgradeModal({ open: true, feature: 'work' });
      return;
    }
    if (mode === 'Study' && !allowStudy) {
      setUpgradeModal({ open: true, feature: 'study' });
      return;
    }
    if (mode === 'VibeCoder' && !canUseWorkTools) {
      setUpgradeModal({ open: true, feature: 'vibecoding' });
      return;
    }
    if (mode === 'Privacy' && !canUsePrivacy) {
      setUpgradeModal({ open: true, feature: 'privacy' });
      return;
    }

    setMode(mode);

    // Synchronize default Plan / Build style, keep reasoning disabled by default
    if (mode === 'Work' || mode === 'Study') {
      setStyle('plan');
    } else if (mode === 'VibeCoder') {
      setStyle('build');
    } else {
      setStyle('direct');
    }
    // Always keep reasoning disabled by default for maximum speed
    setThink('off');

    if (setConversation) {
      setConversation((prev) => {
        if (!prev) return prev;
        const targetEndpoint = (
          mode === 'Privacy' ? 'Satchida' : 'Satchida-Gateway'
        ) as EModelEndpoint;
        const spec = getModelSpec({ specName: mode, startupConfig });
        const fallbackModelByMode: Record<SatchiMode, string> = {
          Chat: 'deepseek-ai/DeepSeek-V4-Flash-0731',
          Work: 'zai-org/GLM-5.3-Flash',
          VibeCoder: 'zai-org/GLM-5.3-Flash',
          Study: 'zai-org/GLM-5.3-Flash',
          Privacy: 'Privacy',
        };
        const model = spec?.preset?.model ?? fallbackModelByMode[mode] ?? mode;
        return {
          ...prev,
          spec: mode,
          model,
          endpoint: targetEndpoint,
        };
      });
    }

    if (mode === 'VibeCoder') {
      const activeProjId = conversation?.chatProjectId;
      if (activeProjId) {
        navigate(`/projects/${activeProjId}`);
      } else {
        const availableProjects = projectsData?.pages?.[0]?.projects || [];
        if (availableProjects.length > 0) {
          navigate(`/projects/${availableProjects[0]._id}`);
        } else {
          navigate('/projects');
        }
      }
    }
  };

  return (
    <>
      <DropdownMenu>
        <TooltipAnchor
          description="Select AI Mode (Chat, Work, Vibe Coder, Study, or Privacy)"
          side="top"
          render={
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                aria-label={`AI Mode: ${activeLabel}`}
                className={cn(
                  'shadow-xs inline-flex h-8 items-center gap-1.5 rounded-full border border-border-light bg-surface-secondary/70 px-2.5 text-xs font-medium text-text-primary transition-all',
                  'focus-visible:outline-hidden focus-visible:ring-ring hover:border-border-medium hover:bg-surface-tertiary focus-visible:ring-1',
                  disabled && 'pointer-events-none opacity-50',
                )}
              >
                <ActiveIcon
                  className={cn('h-3.5 w-3.5', activeDef.accentColor ?? 'text-text-secondary')}
                />
                <span>{activeLabel}</span>
                <ChevronDown className="h-3 w-3 text-text-tertiary" />
              </button>
            </DropdownMenuTrigger>
          }
        />
        <DropdownMenuContent
          align="end"
          side="top"
          className="w-64 rounded-xl border border-border-light bg-surface-primary p-1.5 shadow-xl"
        >
          <DropdownMenuRadioGroup
            value={activeMode}
            onValueChange={(val) => handleSelectMode(val as SatchiMode)}
          >
            {MODES.map((mode) => {
              const isSelected = activeMode === mode.id;
              const Icon = mode.icon;
              const label = localize(mode.labelKey) || mode.defaultLabel;
              const desc = localize(mode.descKey) || mode.defaultDesc;
              const isLocked =
                (mode.id === 'Work' && !allowWork) ||
                (mode.id === 'Study' && !allowStudy) ||
                (mode.id === 'VibeCoder' && !canUseWorkTools) ||
                // Privacy is a fail-closed local product: the same seat-policy
                // gate applies to every account, including the operator, because a
                // local-runtime assertion must be provisioned per node.
                (mode.id === 'Privacy' && !canUsePrivacy);

              return (
                <DropdownMenuRadioItem
                  key={mode.id}
                  value={mode.id}
                  className={cn(
                    'outline-hidden group flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors',
                    'hover:bg-surface-hover focus:bg-surface-hover',
                    isSelected && 'bg-surface-active-alt font-medium text-text-primary',
                    isLocked && 'opacity-85',
                  )}
                >
                  <Icon
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      mode.accentColor ?? 'text-text-secondary',
                    )}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-text-primary">{label}</span>
                      {mode.id === 'Privacy' && (
                        <span className="py-0.2 rounded-full bg-emerald-500/10 px-1.5 text-[10px] font-medium text-emerald-500">
                          100% Local
                        </span>
                      )}
                      {isLocked && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500 ring-1 ring-amber-500/30">
                          <Lock className="h-2.5 w-2.5" />
                          PRO
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-tight text-text-secondary">
                      {desc}
                    </div>
                  </div>
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>

          {activeMode === 'VibeCoder' && (
            <>
              <DropdownMenuSeparator className="my-1 border-t border-border-light/70" />
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                <div className="flex items-center gap-1.5">
                  <Code2 className="size-3.5 text-text-secondary" />
                  <span>Launch Satchida Code Workspace</span>
                </div>
                <ArrowUpRight className="size-3.5 text-text-tertiary" />
              </button>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <SatchiUpgradeModal
        open={upgradeModal.open}
        onOpenChange={(open) => setUpgradeModal((prev) => ({ ...prev, open }))}
        featureName={upgradeModal.feature}
      />
    </>
  );
}

export default memo(SatchiModeSelector);
