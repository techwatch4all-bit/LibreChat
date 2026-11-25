import { useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { useSetAtom } from 'jotai';
import { useDeviceLayout } from '~/hooks';
import { deviceLayoutAtom } from '~/store/layout';

export default function DeviceLayoutSync({ children }: { children: ReactNode }) {
  const layout = useDeviceLayout();
  const setLayout = useSetAtom(deviceLayoutAtom);

  useLayoutEffect(() => {
    setLayout(layout);
  }, [layout, setLayout]);

  return <>{children}</>;
}
