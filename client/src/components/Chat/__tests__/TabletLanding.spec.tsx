import React from 'react';
import { RecoilRoot } from 'recoil';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { deviceLayoutAtom } from '~/store/layout';
import TabletLanding from '../TabletLanding';

jest.mock('librechat-data-provider', () => ({
  EModelEndpoint: {
    azureOpenAI: 'azureOpenAI',
    openAI: 'openAI',
  },
}));

jest.mock('@librechat/client', () => ({
  BirthdayIcon: () => <span data-testid="birthday-icon" />,
  TooltipAnchor: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock('~/Providers', () => ({
  useChatContext: () => ({ conversation: null }),
  useAgentsMapContext: () => undefined,
  useAssistantsMapContext: () => undefined,
}));

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => ({ data: { interface: {} } }),
  useGetEndpointsQuery: () => ({ data: {} }),
}));

jest.mock('~/hooks', () => ({
  useAuthContext: () => ({ user: { name: 'Golu' } }),
  useGreeting: () => "What's left on the list, Golu?",
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/utils', () => ({
  CONFIG_HTML_MEDIA_ATTR: {},
  CONFIG_HTML_MEDIA_TAGS: [],
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
  createConfigHtmlSanitizer: () => (html: string) => html,
  getIconEndpoint: ({ endpoint }: { endpoint: string }) => endpoint,
  getModelSpec: () => undefined,
  getEntity: () => ({ entity: undefined, isAgent: false, isAssistant: false }),
}));

jest.mock('~/components/Endpoints/ConvoIcon', () => () => <div data-testid="convo-icon" />);
jest.mock('~/components/Agents/AgentContact', () => () => <div data-testid="agent-contact" />);

function renderTabletLanding(isLandscape: boolean) {
  const jotaiStore = createStore();
  jotaiStore.set(deviceLayoutAtom, {
    deviceClass: 'tablet',
    orientation: isLandscape ? 'landscape' : 'portrait',
    isPhone: false,
    isTablet: true,
    isDesktop: false,
    isPortrait: !isLandscape,
    isLandscape,
  });

  return render(
    <RecoilRoot>
      <JotaiProvider store={jotaiStore}>
        <TabletLanding />
      </JotaiProvider>
    </RecoilRoot>,
  );
}

describe('TabletLanding', () => {
  it('renders vertical layout in tablet portrait mode', () => {
    const { container } = renderTabletLanding(false);
    expect(container.firstChild).toHaveClass('flex-col');
    expect(screen.getByAltText('Satchida AI Mandala')).toHaveClass('h-[100px]');
    expect(screen.getByTestId('convo-icon')).toBeInTheDocument();
  });

  it('renders split horizontal layout in tablet landscape mode', () => {
    const { container } = renderTabletLanding(true);
    expect(container.firstChild).toHaveClass('flex-row');
    expect(screen.getByAltText('Satchida AI Mandala')).toHaveClass('h-20');
  });
});
