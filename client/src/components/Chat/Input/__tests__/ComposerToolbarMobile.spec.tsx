import React from 'react';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { deviceLayoutAtom } from '~/store/layout';
import ComposerToolbarMobile from '../ComposerToolbarMobile';

function renderToolbar(isLandscape: boolean) {
  const jotaiStore = createStore();
  jotaiStore.set(deviceLayoutAtom, {
    deviceClass: 'phone',
    orientation: isLandscape ? 'landscape' : 'portrait',
    isPhone: true,
    isTablet: false,
    isDesktop: false,
    isPortrait: !isLandscape,
    isLandscape,
  });

  return render(
    <JotaiProvider store={jotaiStore}>
      <ComposerToolbarMobile
        isRTL={false}
        attachSlot={<button type="button">Attach</button>}
        badgeRowSlot={<div data-testid="badge-row">Badges</div>}
        modeSelectorSlot={<button type="button">Direct</button>}
        sendSlot={<button type="button">Send</button>}
      />
    </JotaiProvider>,
  );
}

describe('ComposerToolbarMobile', () => {
  it('shows BadgeRow, Attach, Mode, and pinned Send in phone portrait', () => {
    renderToolbar(false);
    expect(screen.getByText('Attach')).toBeInTheDocument();
    expect(screen.getByTestId('badge-row')).toBeInTheDocument();
    expect(screen.getByText('Direct')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('hides BadgeRow in phone landscape while keeping Attach, Mode, and Send', () => {
    renderToolbar(true);
    expect(screen.getByText('Attach')).toBeInTheDocument();
    expect(screen.queryByTestId('badge-row')).not.toBeInTheDocument();
    expect(screen.getByText('Direct')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });
});
