import { useMemo } from 'react';
import { useMediaQuery } from '@librechat/client';

export type DeviceClass = 'phone' | 'tablet' | 'desktop';
export type Orientation = 'portrait' | 'landscape';

export interface DeviceLayout {
  deviceClass: DeviceClass;
  orientation: Orientation;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
}

export const DEFAULT_DESKTOP_LAYOUT: DeviceLayout = {
  deviceClass: 'desktop',
  orientation: 'landscape',
  isPhone: false,
  isTablet: false,
  isDesktop: true,
  isPortrait: false,
  isLandscape: true,
};

export default function useDeviceLayout(): DeviceLayout {
  const isNarrowWidth = useMediaQuery('(max-width: 639px)');
  const isShortLandscape = useMediaQuery('(orientation: landscape) and (max-height: 500px)');
  const isTabletWidth = useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
  const isPortrait = useMediaQuery('(orientation: portrait)');

  return useMemo(() => {
    const isPhone = isNarrowWidth || isShortLandscape;
    const isTablet = !isPhone && isTabletWidth;
    const deviceClass: DeviceClass = isPhone ? 'phone' : isTablet ? 'tablet' : 'desktop';
    const orientation: Orientation = isPortrait ? 'portrait' : 'landscape';

    return {
      deviceClass,
      orientation,
      isPhone,
      isTablet,
      isDesktop: deviceClass === 'desktop',
      isPortrait,
      isLandscape: !isPortrait,
    };
  }, [isNarrowWidth, isShortLandscape, isTabletWidth, isPortrait]);
}
