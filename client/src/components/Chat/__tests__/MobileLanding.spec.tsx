import React from 'react';
import { RecoilRoot } from 'recoil';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { deviceLayoutAtom } from '~/store/layout';
import MobileLanding from '../MobileLanding';

let mockConversation: Record<string, unknown> | null = null;
let mockAgentsMap: Record<string, any> | undefined;

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
  useChatContext: () => ({ conversation: mockConversation }),
  useAgentsMapContext: () => mockAgentsMap,
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
  getEntity: ({ endpoint, agentsMap, agent_id }: any) => {
    if (endpoint === 'agents' && agent_id) {
      return { entity: agentsMap?.[agent_id], isAgent: true, isAssistant: false };
    }
    return { entity: undefined, isAgent: false, isAssistant: false };
  },
}));

jest.mock('~/components/Endpoints/ConvoIcon', () => () => <div data-testid="convo-icon" />);
jest.mock('~/components/Agents/AgentContact', () => () => <div data-testid="agent-contact" />);

function renderMobileLanding(isLandscape: boolean) {
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
    <RecoilRoot>
      <JotaiProvider store={jotaiStore}>
        <MobileLanding />
      </JotaiProvider>
    </RecoilRoot>,
  );
}

describe('MobileLanding', () => {
  beforeEach(() => {
    mockConversation = null;
    mockAgentsMap = undefined;
  });

  it('hides ConvoIcon on default chat in portrait and renders greeting + mandala', () => {
    renderMobileLanding(false);
    expect(screen.getByAltText('Satchida AI Mandala')).toBeInTheDocument();
    expect(screen.getByText("What's left on the list, Golu?")).toBeInTheDocument();
    expect(screen.queryByTestId('convo-icon')).not.toBeInTheDocument();
  });

  it('shows ConvoIcon for agent conversations', () => {
    mockConversation = { endpoint: 'agents', agent_id: 'agent-1' };
    mockAgentsMap = { 'agent-1': { id: 'agent-1', name: 'Researcher' } };
    renderMobileLanding(false);
    expect(screen.getByText('Researcher')).toBeInTheDocument();
    expect(screen.getByTestId('convo-icon')).toBeInTheDocument();
  });

  it('renders inline compact row in phone landscape mode', () => {
    const { container } = renderMobileLanding(true);
    expect(container.firstChild).toHaveClass('flex-row');
    expect(screen.getByAltText('Satchida AI Mandala')).toHaveClass('h-9');
    expect(screen.getByText("What's left on the list, Golu?")).toBeInTheDocument();
  });
});
