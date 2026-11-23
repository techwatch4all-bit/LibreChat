import React, { memo } from 'react';
import { useAtom } from 'jotai';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  TooltipAnchor,
} from '@librechat/client';
import { ChevronDown, Compass, Check } from 'lucide-react';
import type { TranslationKeys } from '~/hooks/useLocalize';
import { satchiStyleAtom, type SatchiStyle } from '~/store/satchiStore';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface SatchiStyleSelectorProps {
  disabled?: boolean;
}

const STYLES: {
  id: SatchiStyle;
  labelKey: TranslationKeys;
  descKey: TranslationKeys;
  defaultLabel: string;
  defaultDesc: string;
}[] = [
  {
    id: 'direct',
    labelKey: 'com_satchi_style_direct',
    descKey: 'com_satchi_style_direct_desc',
    defaultLabel: 'Direct',
    defaultDesc: 'Direct response mode (Straightforward, rapid deliverable)',
  },
  {
    id: 'plan',
    labelKey: 'com_satchi_style_plan',
    descKey: 'com_satchi_style_plan_desc',
    defaultLabel: 'Plan',
    defaultDesc: 'Plan mode (Step-by-step thinking & review before execution)',
  },
  {
    id: 'build',
    labelKey: 'com_satchi_style_build',
    descKey: 'com_satchi_style_build_desc',
    defaultLabel: 'Build',
    defaultDesc: 'Build mode (Full implementation & production code deliverable)',
  },
];

function SatchiStyleSelector({ disabled = false }: SatchiStyleSelectorProps) {
  const [currentStyle, setStyle] = useAtom(satchiStyleAtom);
  const localize = useLocalize();

  const activeDef = STYLES.find((s) => s.id === currentStyle) || STYLES[0];
  const activeLabel = localize(activeDef.labelKey) || activeDef.defaultLabel;

  return (
    <DropdownMenu>
      <TooltipAnchor
        description="Execution Style (Direct, Plan, or Build)"
        side="top"
        render={
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={`Execution Style: ${activeLabel}`}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-light bg-surface-secondary/70 px-2.5 text-xs font-medium text-text-primary shadow-xs transition-all',
                'hover:border-border-medium hover:bg-surface-tertiary focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring',
                disabled && 'pointer-events-none opacity-50',
              )}
            >
              <Compass className="h-3.5 w-3.5 text-text-secondary" />
              <span>{activeLabel}</span>
              <ChevronDown className="h-3 w-3 text-text-tertiary" />
            </button>
          </DropdownMenuTrigger>
        }
      />
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-56 rounded-xl border border-border-light bg-surface-primary p-1.5 shadow-xl"
      >
        <DropdownMenuRadioGroup
          value={currentStyle}
          onValueChange={(val) => setStyle(val as SatchiStyle)}
        >
          {STYLES.map((style) => {
            const label = localize(style.labelKey) || style.defaultLabel;
            const desc = localize(style.descKey) || style.defaultDesc;
            const isSelected = currentStyle === style.id;

            return (
              <DropdownMenuRadioItem
                key={style.id}
                value={style.id}
                className={cn(
                  'group flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs outline-hidden transition-colors',
                  'hover:bg-surface-hover focus:bg-surface-hover',
                  isSelected && 'bg-surface-active-alt font-medium text-text-primary',
                )}
              >
                <div className="flex-1">
                  <div className="font-semibold text-text-primary">{label}</div>
                  <div className="text-[11px] text-text-secondary leading-tight">{desc}</div>
                </div>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default memo(SatchiStyleSelector);
