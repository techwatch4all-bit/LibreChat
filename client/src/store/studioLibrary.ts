import { atom } from 'recoil';

export const showStudioLibraryPanel = atom<boolean>({
  key: 'showStudioLibraryPanel',
  default: false,
});
