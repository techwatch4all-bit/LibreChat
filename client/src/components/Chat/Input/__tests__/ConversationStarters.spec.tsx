import React from 'react';
import { fireEvent, render, screen } from 'test/layout-test-utils';
import { ALL_CATEGORIES, MOTION_GROUPS } from '~/common/starters';
import ConversationStarters from '../ConversationStarters';

const mockSubmitMessage = jest.fn();
const mockSetBadgeMCP = jest.fn();
const mockSetValue = jest.fn();

let mockConversation: Record<string, unknown> = {};

jest.mock('~/Providers', () => ({
  ...jest.requireActual('~/Providers'),
  useChatContext: () => ({ conversation: mockConversation }),
  useChatFormContext: () => ({ setValue: mockSetValue }),
  useBadgeRowContext: () => ({
    mcpServerManager: { mcpValues: [], setMCPValues: mockSetBadgeMCP },
  }),
  useAgentsMapContext: () => undefined,
  useAssistantsMapContext: () => undefined,
}));

jest.mock('~/data-provider', () => ({
  ...jest.requireActual('~/data-provider'),
  useGetEndpointsQuery: () => ({ data: undefined }),
  useGetStartupConfig: () => ({ data: undefined }),
  useGetAssistantDocsQuery: () => ({ data: undefined }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, options?: { defaultValue?: string }) =>
    options?.defaultValue ?? key,
  useSubmitMessage: () => ({ submitMessage: mockSubmitMessage }),
}));

jest.mock('~/utils', () => ({
  ...jest.requireActual('~/utils'),
  cn: (...args: Array<unknown>) => args.filter(Boolean).join(' '),
  getIconEndpoint: () => 'custom',
  getEntity: () => ({ entity: undefined, isAgent: false }),
  getModelSpec: () => undefined,
}));

jest.mock('~/utils/textarea', () => ({ forceResize: jest.fn() }));

const marketCat = ALL_CATEGORIES.find((c) => c.id === 'markets_finance')!;
const citizenCat = ALL_CATEGORIES.find((c) => c.id === 'citizen_essentials')!;
const vedicCat = ALL_CATEGORIES.find((c) => c.id === 'vedic_wellness')!;
const governanceCat = ALL_CATEGORIES.find((c) => c.id === 'governance_law')!;
const privacyCat = ALL_CATEGORIES.find((c) => c.id === 'privacy_vault')!;
const familyCat = ALL_CATEGORIES.find((c) => c.id === 'family_health')!;

const motionArchCat = ALL_CATEGORIES.find((c) => c.id === 'motion_architecture')!;
const motionDronesCat = ALL_CATEGORIES.find((c) => c.id === 'motion_drones')!;
const motionRoboticsCat = ALL_CATEGORIES.find((c) => c.id === 'motion_robotics')!;
const motionHowCat = ALL_CATEGORIES.find((c) => c.id === 'motion_how_it_works')!;
const motionEducationCat = ALL_CATEGORIES.find((c) => c.id === 'motion_education')!;
const motionExecCat = ALL_CATEGORIES.find((c) => c.id === 'motion_executive')!;
const motionMedicalCat = ALL_CATEGORIES.find((c) => c.id === 'motion_medical')!;
const motionHomeCat = ALL_CATEGORIES.find((c) => c.id === 'motion_home')!;
const motionElderlyCat = ALL_CATEGORIES.find((c) => c.id === 'motion_elderly')!;

const motionCategories = ALL_CATEGORIES.filter((c) => c.modes?.includes('Motion'));

const setMode = (spec: string) => {
  mockConversation = { spec, conversationId: 'convo-starters-test', endpoint: 'custom' };
};

describe('ConversationStarters', () => {
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    jest.clearAllMocks();
    setMode('Chat');
    document.body.replaceChildren();
    textarea = document.createElement('textarea');
    textarea.id = 'prompt-textarea';
    document.body.appendChild(textarea);
  });

  it('filters category tabs to the active mode', () => {
    setMode('Privacy');
    render(<ConversationStarters />);
    // Privacy-mode categories are shown...
    expect(screen.getByText(vedicCat.label)).toBeInTheDocument();
    expect(screen.getByText(governanceCat.label)).toBeInTheDocument();
    expect(screen.getByText(privacyCat.label)).toBeInTheDocument();
    // ...and web-bound / non-Privacy categories are not.
    expect(screen.queryByText(marketCat.label)).not.toBeInTheDocument();
    expect(screen.queryByText(familyCat.label)).not.toBeInTheDocument();
  });

  it('shows Markets on Chat but not the Privacy-only vault', () => {
    render(<ConversationStarters />);
    expect(screen.getByText(marketCat.label)).toBeInTheDocument();
    expect(screen.queryByText(privacyCat.label)).not.toBeInTheDocument();
  });

  it('renders 5 Motion Discipline Groups and exact 8 Spotlight cards on default landing', () => {
    setMode('Motion');
    render(<ConversationStarters />);

    for (const group of MOTION_GROUPS) {
      expect(screen.getByText(group.label)).toBeInTheDocument();
    }
    expect(screen.queryByText(marketCat.label)).not.toBeInTheDocument();
    expect(screen.queryByText(privacyCat.label)).not.toBeInTheDocument();

    const featured = motionCategories.flatMap((c) => c.starters.filter((s) => s.featured));
    expect(featured).toHaveLength(8);
    for (const item of featured) {
      expect(screen.getByLabelText(item.prompt)).toBeInTheDocument();
    }
  });

  it('switches Motion Discipline Groups and filters contextual sub-categories', () => {
    setMode('Motion');
    render(<ConversationStarters />);

    const roboticsGroup = MOTION_GROUPS.find((g) => g.id === 'robotics_how')!;
    fireEvent.click(screen.getByText(roboticsGroup.label));

    expect(screen.getByText(motionRoboticsCat.label)).toBeInTheDocument();
    expect(screen.getByText(motionHowCat.label)).toBeInTheDocument();
    expect(screen.queryByText(motionArchCat.label)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(motionHowCat.label));
    for (const starter of motionHowCat.starters) {
      expect(screen.getByLabelText(starter.prompt)).toBeInTheDocument();
    }
  });

  it('filters Motion personas cleanly via inline search', () => {
    setMode('Motion');
    render(<ConversationStarters />);

    fireEvent.click(screen.getByLabelText('com_ui_motion_search_button'));
    const searchBox = screen.getByRole('searchbox');
    expect(searchBox).toBeInTheDocument();
    fireEvent.change(searchBox, { target: { value: 'chemistry orbital' } });

    const chemStarter = motionEducationCat.starters.find((s) => s.title?.includes('Chemistry'))!;
    expect(screen.getByLabelText(chemStarter.prompt)).toBeInTheDocument();
    expect(screen.queryByLabelText(motionExecCat.starters[0].prompt)).not.toBeInTheDocument();

    fireEvent.change(searchBox, { target: { value: 'zzzznonexistent999' } });
    expect(screen.getByText('com_ui_motion_no_matches')).toBeInTheDocument();
  });

  it('always stages motion starters into textarea without submitting, shows hint, and binds MCPs', () => {
    setMode('Motion');
    render(<ConversationStarters />);

    const archGroup = MOTION_GROUPS.find((g) => g.id === 'arch_engineering')!;
    fireEvent.click(screen.getByText(archGroup.label));
    fireEvent.click(screen.getByText(motionDronesCat.label));

    const droneStarter = motionDronesCat.starters[0];
    fireEvent.click(screen.getByLabelText(droneStarter.prompt));

    expect(mockSubmitMessage).not.toHaveBeenCalled();
    expect(textarea.value).toBe(droneStarter.prompt);
    expect(textarea.selectionStart).toBe(droneStarter.prompt.indexOf('['));
    expect(textarea.selectionEnd).toBe(droneStarter.prompt.indexOf(']') + 1);
    expect(mockSetBadgeMCP).toHaveBeenCalledWith(droneStarter.mcpServers);

    const statusBanner = screen.getByRole('status');
    expect(statusBanner).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('com_ui_motion_dismiss_hint'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('ensures every Motion persona contains staging slots and none lead with [ at index 0', () => {
    expect(motionCategories).toHaveLength(20);
    const allMotionStarters = motionCategories.flatMap((c) => c.starters);
    expect(allMotionStarters.length).toBeGreaterThanOrEqual(65);

    for (const starter of allMotionStarters) {
      const firstOpen = starter.prompt.indexOf('[');
      const firstClose = starter.prompt.indexOf(']', firstOpen);
      expect(firstOpen).toBeGreaterThan(0);
      expect(firstClose).toBeGreaterThan(firstOpen);
    }

    // Also verify Spotlight domains span Arch, Drones, Robotics, How, STEM, Medical, Executive, Home
    expect(motionArchCat.starters[0].featured).toBe(true);
    expect(motionDronesCat.starters[0].featured).toBe(true);
    expect(motionRoboticsCat.starters[0].featured).toBe(true);
    expect(motionHowCat.starters[0].featured).toBe(true);
    expect(motionEducationCat.starters[0].featured).toBe(true);
    expect(motionMedicalCat.starters[0].featured).toBe(true);
    expect(motionExecCat.starters[0].featured).toBe(true);
    expect(motionHomeCat.starters[0].featured).toBe(true);
    expect(motionElderlyCat.starters.length).toBeGreaterThanOrEqual(4);
  });

  it('stages template starters into the textarea without submitting', () => {
    const starter = marketCat.starters.find((s) => s.prompt.includes('[Source](URL)'))!;
    render(<ConversationStarters />);
    fireEvent.click(screen.getByLabelText(starter.prompt));
    expect(mockSubmitMessage).not.toHaveBeenCalled();
    expect(textarea.value).toBe(starter.prompt);
    // the first parameter bracket is highlighted
    expect(textarea.selectionStart).toBe(starter.prompt.indexOf('['));
    expect(textarea.selectionEnd).toBe(starter.prompt.indexOf(']') + 1);
    // and the react-hook-form mirror is kept in sync
    expect(mockSetValue).toHaveBeenCalledWith('text', starter.prompt, {
      shouldDirty: true,
      shouldValidate: true,
    });
  });

  it('submits instant starters immediately without touching the textarea', () => {
    // same gate the component uses: any [...], <...>, or unpasted deictic stages
    const isTemplate =
      /\[|<|this (message|code|query|plan|dataset|documents?|snippet|requirement|pdf|image)\b/i;
    const instant = citizenCat.starters.find((s) => !isTemplate.test(s.prompt))!;
    render(<ConversationStarters />);
    fireEvent.click(screen.getByLabelText(instant.prompt));
    expect(mockSubmitMessage).toHaveBeenCalledWith({ text: instant.prompt });
    expect(textarea.value).toBe('');
  });

  it('pre-selects the bound MCP servers on click', () => {
    const bound = marketCat.starters.find((s) => (s.mcpServers ?? []).length > 0)!;
    render(<ConversationStarters />);
    fireEvent.click(screen.getByLabelText(bound.prompt));
    expect(mockSetBadgeMCP).toHaveBeenCalledWith(bound.mcpServers);
  });

  it('Tab cycles between multiple [...] parameters of a staged starter', () => {
    const twoParam = marketCat.starters.find((s) => {
      const first = s.prompt.indexOf('[');
      const firstClose = s.prompt.indexOf(']', first);
      return first > 0 && firstClose > first && s.prompt.indexOf('[', firstClose + 1) > firstClose;
    })!;
    render(<ConversationStarters />);
    // switch to the full category so all its pills render
    fireEvent.click(screen.getByText(marketCat.label));
    fireEvent.click(screen.getByLabelText(twoParam.prompt));
    expect(textarea.value).toBe(twoParam.prompt);

    const first = twoParam.prompt.indexOf('[');
    const firstClose = twoParam.prompt.indexOf(']', first);
    const second = twoParam.prompt.indexOf('[', firstClose + 1);
    const secondClose = twoParam.prompt.indexOf(']', second);
    expect(textarea.selectionStart).toBe(first);

    // first Tab moves the highlight to the second parameter (default prevented)
    expect(fireEvent.keyDown(textarea, { key: 'Tab' })).toBe(false);
    expect(textarea.selectionStart).toBe(second);
    expect(textarea.selectionEnd).toBe(secondClose + 1);

    // a second Tab wraps back to the first parameter (still cycling)
    expect(fireEvent.keyDown(textarea, { key: 'Tab' })).toBe(false);
    expect(textarea.selectionStart).toBe(first);
  });

  it('releases Tab (no preventDefault) when a starter has a single parameter', () => {
    const oneParam = marketCat.starters.find(
      (s) =>
        s.prompt.includes('[Source](URL)') &&
        s.prompt.indexOf(']', s.prompt.indexOf('[')) === s.prompt.lastIndexOf(']'),
    )!;
    render(<ConversationStarters />);
    fireEvent.click(screen.getByLabelText(oneParam.prompt));
    // Tab is not swallowed: the handler lets focus move on
    expect(fireEvent.keyDown(textarea, { key: 'Tab' })).toBe(true);
  });
});
