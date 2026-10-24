import React, { memo } from 'react';
import { OGDialog, OGDialogTemplate, Button } from '@librechat/client';
import { Sparkles, Crown } from 'lucide-react';
import { useLocalize } from '~/hooks';

interface SatchiUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: 'vibecoding' | 'research' | 'privacy';
}

function SatchiUpgradeModal({ open, onOpenChange, featureName }: SatchiUpgradeModalProps) {
  const localize = useLocalize();

  const title = localize('com_satchi_upgrade_pro_title') || 'Pro Subscription Required';
  const description =
    featureName === 'vibecoding'
      ? localize('com_satchi_upgrade_pro_vibecoding') ||
        'Vibe-Coding is reserved for Pro and Enterprise accounts. Upgrade your plan to unlock automated full-stack code synthesis and live browser artifacts.'
      : featureName === 'privacy'
        ? localize('com_satchi_upgrade_pro_privacy') ||
          'On-device sovereign privacy mode is reserved for Pro and Enterprise accounts. Upgrade your plan to enable 100% on-device local execution.'
        : localize('com_satchi_upgrade_pro_research') ||
          'Deep Research is reserved for Pro and Enterprise accounts. Upgrade your plan to unlock exhaustive multi-turn web search and deep synthesis.';

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogTemplate
        title=""
        showCloseButton={true}
        className="max-w-[440px] rounded-2xl border-border-medium bg-surface-primary p-6 text-text-primary shadow-2xl"
        main={
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30">
              <Crown className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{description}</p>
            <div className="mt-5 w-full rounded-xl border border-border-light bg-surface-secondary/50 p-3 text-xs text-text-tertiary">
              ✨ Includes unlimited reasoning, Vibe-Coding architecture blueprints, Mermaid diagram exports & Deep Research.
            </div>
          </div>
        }
        selection={{
          selectHandler: () => onOpenChange(false),
          selectClasses:
            'w-full bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium py-2 rounded-xl shadow-md transition-all',
          selectText: localize('com_satchi_upgrade_button') || 'Upgrade to Pro',
        }}
        showCancelButton={false}
      />
    </OGDialog>
  );
}

export default memo(SatchiUpgradeModal);
