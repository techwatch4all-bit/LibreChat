import React from 'react';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { deviceLayoutAtom } from '~/store/layout';
import ConversationStartersMobile from '../ConversationStartersMobile';

const mockHandleStarterClick = jest.fn();
const mockSetSelectedCategory = jest.fn();
const mockSetSelectedGroup = jest.fn();
const mockSetIsSearchOpen = jest.fn();
const mockSetSearchQuery = jest.fn();
const mockSetStagedHint = jest.fn();
const mockSetParameterModalState = jest.fn();

const mockSampleStarters = Array.from({ length: 8 }, (_, idx) => ({
  title: `Starter ${idx + 1}`,
  description: `Description ${idx + 1}`,
  prompt: `Prompt ${idx + 1}`,
  badge: 'Cat',
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
}));

jest.mock('~/common/personaVisuals', () => ({
  resolvePersonaVisual: () => ({
    Icon: () => <span data-testid="persona-icon" />,
    bg: 'bg-surface-tertiary',
    color: 'text-text-primary',
  }),
}));

jest.mock('~/common/starters', () => ({
  MOTION_GROUPS: [{ id: 'g1', labelKey: 'g1_key', label: 'Group 1' }],
}));

jest.mock('../useConversationStartersData', () => ({
  parseStarterMeta: (item: any) => ({
    title: item.title,
    cleanTitle: item.title,
    description: item.description,
  }),
  useConversationStartersData: () => ({
    isAgentEndpoint: false,
    modeCategories: [
      { id: 'cat1', labelKey: 'cat1_key', label: 'Markets', starters: mockSampleStarters },
    ],
    hasGroupedNavigation: false,
    selectedCategory: 'all',
    setSelectedCategory: mockSetSelectedCategory,
    selectedGroup: 'spotlight',
    setSelectedGroup: mockSetSelectedGroup,
    isSearchOpen: false,
    setIsSearchOpen: mockSetIsSearchOpen,
    searchQuery: '',
    setSearchQuery: mockSetSearchQuery,
    stagedHint: false,
    setStagedHint: mockSetStagedHint,
    searchInputRef: { current: null },
    parameterModalState: {
      isOpen: false,
      title: '',
      rawTemplate: '',
      slots: [],
      values: {},
      servers: [],
    },
    setParameterModalState: mockSetParameterModalState,
    handleStarterClick: mockHandleStarterClick,
    handleExecuteParameterizedTask: jest.fn(),
    displayedStarters: mockSampleStarters,
  }),
}));

function renderStarters(deviceClass: 'phone' | 'tablet', isLandscape = false) {
  const jotaiStore = createStore();
  jotaiStore.set(deviceLayoutAtom, {
    deviceClass,
    orientation: isLandscape ? 'landscape' : 'portrait',
    isPhone: deviceClass === 'phone',
    isTablet: deviceClass === 'tablet',
    isDesktop: false,
    isPortrait: !isLandscape,
    isLandscape,
  });

  return render(
    <JotaiProvider store={jotaiStore}>
      <ConversationStartersMobile />
    </JotaiProvider>,
  );
}

describe('ConversationStartersMobile', () => {
  it('caps phone starters to 6 initially and expands via Show more toggle', () => {
    renderStarters('phone', false);
    expect(screen.getByText('Starter 1')).toBeInTheDocument();
    expect(screen.getByText('Starter 6')).toBeInTheDocument();
    expect(screen.queryByText('Starter 7')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Show more/i }));
    expect(screen.getByText('Starter 7')).toBeInTheDocument();
    expect(screen.getByText('Starter 8')).toBeInTheDocument();
  });

  it('renders 2-col grid on tablet portrait and 3-col grid on tablet landscape', () => {
    const { rerender, container } = renderStarters('tablet', false);
    expect(container.querySelector('.grid-cols-2')).toBeInTheDocument();
    expect(screen.getByText('Description 1')).toBeInTheDocument();

    const jotaiStore = createStore();
    jotaiStore.set(deviceLayoutAtom, {
      deviceClass: 'tablet',
      orientation: 'landscape',
      isPhone: false,
      isTablet: true,
      isDesktop: false,
      isPortrait: false,
      isLandscape: true,
    });

    rerender(
      <JotaiProvider store={jotaiStore}>
        <ConversationStartersMobile />
      </JotaiProvider>,
    );
    expect(container.querySelector('.grid-cols-3')).toBeInTheDocument();
  });
});
