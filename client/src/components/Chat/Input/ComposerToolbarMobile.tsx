import type { ReactNode } from 'react';
import { useAtomValue } from 'jotai';
import { deviceLayoutAtom } from '~/store/layout';
import { cn } from '~/utils';

interface ComposerToolbarMobileProps {
  isRTL: boolean;
  attachSlot: ReactNode;
  badgeRowSlot: ReactNode;
  modeSelectorSlot: ReactNode;
  steerSlot?: ReactNode;
  sendSlot: ReactNode;
}

export default function ComposerToolbarMobile({
  isRTL,
  attachSlot,
  badgeRowSlot,
  modeSelectorSlot,
  steerSlot,
  sendSlot,
}: ComposerToolbarMobileProps) {
  const { isLandscape } = useAtomValue(deviceLayoutAtom);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-1 px-2 pb-2',
        isRTL ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'no-scrollbar flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto',
          isRTL ? 'flex-row-reverse' : 'flex-row',
        )}
      >
        {attachSlot}
        {!isLandscape && badgeRowSlot}
      </div>
      <div
        className={cn(
          'flex shrink-0 items-center gap-1',
          isRTL ? 'flex-row-reverse' : 'flex-row',
        )}
      >
        {modeSelectorSlot}
        {steerSlot}
        <div className="shrink-0">{sendSlot}</div>
      </div>
    </div>
  );
}
