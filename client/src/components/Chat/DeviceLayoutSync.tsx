import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useSetAtom } from 'jotai';
import { ThemeContext } from '@librechat/client';
import { useDeviceLayout } from '~/hooks';
import { deviceLayoutAtom } from '~/store/layout';

export default function DeviceLayoutSync({ children }: { children: ReactNode }) {
  const layout = useDeviceLayout();
  const setLayout = useSetAtom(deviceLayoutAtom);
  const { theme, setTheme } = useContext(ThemeContext);
  const prevDesktopThemeRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    setLayout(layout);
  }, [layout, setLayout]);

  useEffect(() => {
    if (layout.isPhone) {
      if (theme !== 'dark-black') {
        if (prevDesktopThemeRef.current == null) {
          prevDesktopThemeRef.current = theme;
        }
        setTheme('dark-black');
      }
    } else if (prevDesktopThemeRef.current != null) {
      const restore = prevDesktopThemeRef.current;
      prevDesktopThemeRef.current = null;
      setTheme(restore);
    }
  }, [layout.isPhone, theme, setTheme]);

  return <>{children}</>;
}
