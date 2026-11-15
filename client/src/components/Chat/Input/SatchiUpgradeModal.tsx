import React, { memo } from 'react';
import { OGDialog, OGDialogTemplate, Button } from '@librechat/client';
import { Sparkles, Crown } from 'lucide-react';
import { useLocalize } from '~/hooks';

interface SatchiUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: 'work' | 'study' | 'vibecoding' | 'research' | 'privacy' | 'studio';
}

function SatchiUpgradeModal({ open, onOpenChange, featureName }: SatchiUpgradeModalProps) {
  const localize = useLocalize();

  const title = localize('com_satchi_upgrade_pro_title') || 'Pro Tier Required';
  const description =
    featureName === 'work'
      ? localize('com_satchi_upgrade_pro_work') ||
        'Work mode is reserved for Pro, Enterprise, and Privacy accounts. Upgrade to \'Pro\' by contacting your site administrator.'
      : featureName === 'study'
        ? localize('com_satchi_upgrade_pro_study') ||
          'Study mode is reserved for Family, Pro, Enterprise, and Privacy accounts. Upgrade to \'Pro\' by contacting your site administrator.'
        : featureName === 'vibecoding'
          ? localize('com_satchi_upgrade_pro_vibecoding') ||
            'Vibe Coder is reserved for Pro, Enterprise, and Privacy accounts. Upgrade to \'Pro\' by contacting your site administrator.'
          : featureName === 'privacy'
            ? localize('com_satchi_upgrade_pro_privacy') ||
              'On-device sovereign privacy mode is reserved for Enterprise and Privacy accounts plus a healthy local model. Upgrade to \'Pro\' or Privacy tier by contacting your site administrator.'
            : featureName === 'studio'
              ? localize('com_satchi_upgrade_pro_studio') ||
                'Satchida Studios (DeepTutor, Motion Studio, SceneMosaic, Architect BIM, Office & Maker Suites) are reserved for Pro, Pro_Family, and Privacy tiers. Upgrade to \'Pro\' by contacting your site administrator (RWA committee, school/college office, or organization administrator).'
              : localize('com_satchi_upgrade_pro_research') ||
                'Deep Research is reserved for Pro, Enterprise, and Privacy accounts. Upgrade to \'Pro\' by contacting your site administrator.';

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
              ✨ Includes unlimited reasoning, Vibe-Coding architecture blueprints, Mermaid diagram exports, Satchida Studios & Deep Research.
            </div>
          </div>
        }
        selection={{
          selectHandler: () => onOpenChange(false),
          selectClasses:
            'w-full bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium py-2 rounded-xl shadow-md transition-all',
          selectText: localize('com_satchi_upgrade_button') || "Upgrade to 'Pro' via Site Admin",
        }}
        showCancelButton={false}
      />
    </OGDialog>
  );
}

export default memo(SatchiUpgradeModal);
