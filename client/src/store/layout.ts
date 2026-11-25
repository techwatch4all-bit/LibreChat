import { atom } from 'jotai';
import { DEFAULT_DESKTOP_LAYOUT } from '~/hooks/useDeviceLayout';
import type { DeviceLayout } from '~/hooks/useDeviceLayout';

export const deviceLayoutAtom = atom<DeviceLayout>(DEFAULT_DESKTOP_LAYOUT);
