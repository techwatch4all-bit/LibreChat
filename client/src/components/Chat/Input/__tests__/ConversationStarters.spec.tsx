import React from 'react';
import { ALL_CATEGORIES, MOTION_GROUPS, findStarterSlots } from '~/common/starters';
import { fireEvent, render, screen } from 'test/layout-test-utils';
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

type Card = (typeof marketCat.starters)[number];

/** Mirrors the accessor the component exposes to assistive tech. */
const cardName = (item: Card): string =>
  item.title && item.description ? `${item.title}. ${item.description}` : item.prompt;

const setMode = (spec: string) => {
  mockConversation = { spec, conversationId: 'convo-starters-test', endpoint: 'custom' };
};

describe('starter catalog contract', () => {
  it('gives every card a title, a description and at least one real input slot', () => {
    for (const category of ALL_CATEGORIES) {
      for (const card of category.starters) {
        expect(typeof card.title).toBe('string');
        expect(card.title!.length).toBeGreaterThan(2);
        expect(card.description!.length).toBeGreaterThan(10);
        expect(findStarterSlots(card.prompt).length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps card copy short enough to read on a pill', () => {
    const failures: string[] = [];
    for (const category of ALL_CATEGORIES) {
      for (const card of category.starters) {
        const bare = card.title!.replace(/^[^\p{L}\p{N}]+/u, '');
        if (bare.length > 44) {
          failures.push(`title ${bare.length}: ${bare}`);
        }
        if (card.description!.length > 140) {
          failures.push(`description ${card.description!.length}: ${card.description}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('gates every card behind an approval step and leaves room for the user', () => {
    for (const category of ALL_CATEGORIES) {
      for (const card of category.starters) {
        expect(card.prompt).toContain('My additions:');
        expect(card.prompt).toContain('On GO, deliver:');
        const gateIndex = card.prompt.search(/Before you start:|a filled brief is the approval/);
        expect(gateIndex).toBeGreaterThan(0);
        expect(gateIndex).toBeLessThan(card.prompt.indexOf('On GO, deliver:'));
      }
    }
  });

  it('ignores markdown links when scanning for input slots', () => {
    const text = 'Output contract: cite every figure with [Source](URL). Inputs: [city] · [date]';
    const slots = findStarterSlots(text);
    expect(slots).toHaveLength(2);
    expect(text.slice(slots[0].start, slots[0].end)).toBe('[city]');
    expect(text.slice(slots[1].start, slots[1].end)).toBe('[date]');
    expect(findStarterSlots('no slots here at all')).toEqual([]);
  });

  it('never repeats a title inside one category', () => {
    for (const category of ALL_CATEGORIES) {
      const titles = category.starters.map((card) => card.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });
});

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
      expect(screen.getByLabelText(cardName(item))).toBeInTheDocument();
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
      expect(screen.getByLabelText(cardName(starter))).toBeInTheDocument();
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
    expect(screen.getByLabelText(cardName(chemStarter))).toBeInTheDocument();
    expect(screen.queryByLabelText(cardName(motionExecCat.starters[0]))).not.toBeInTheDocument();

    fireEvent.change(searchBox, { target: { value: 'zzzznonexistent999' } });
    expect(screen.getByText('com_ui_motion_no_matches')).toBeInTheDocument();
  });

  it('always stages motion starters into the textarea without submitting, and binds MCPs', () => {
    setMode('Motion');
    render(<ConversationStarters />);

    const archGroup = MOTION_GROUPS.find((g) => g.id === 'arch_engineering')!;
    fireEvent.click(screen.getByText(archGroup.label));
    fireEvent.click(screen.getByText(motionDronesCat.label));

    const droneStarter = motionDronesCat.starters[0];
    fireEvent.click(screen.getByLabelText(cardName(droneStarter)));

    expect(mockSubmitMessage).not.toHaveBeenCalled();
    expect(textarea.value).toBe(droneStarter.prompt);
    expect(textarea.selectionStart).toBe(droneStarter.prompt.indexOf('['));
    expect(textarea.selectionEnd).toBe(droneStarter.prompt.indexOf(']') + 1);
    expect(mockSetBadgeMCP).toHaveBeenCalledWith(droneStarter.mcpServers);
  });

  it('shows the staging hint in every mode, and dismisses it', () => {
    render(<ConversationStarters />);
    fireEvent.click(screen.getByLabelText(cardName(marketCat.starters[0])));
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('com_ui_motion_dismiss_hint'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('ensures every Motion persona leads with a real input slot, not a markdown link', () => {
    expect(motionCategories).toHaveLength(20);
    const allMotionStarters = motionCategories.flatMap((c) => c.starters);
    expect(allMotionStarters.length).toBeGreaterThanOrEqual(65);

    for (const starter of allMotionStarters) {
      const slots = findStarterSlots(starter.prompt);
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0].start).toBeGreaterThan(0);
      expect(starter.prompt[slots[0].end]).not.toBe('(');
    }

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
    const starter = marketCat.starters[0];
    render(<ConversationStarters />);
    fireEvent.click(screen.getByLabelText(cardName(starter)));
    expect(mockSubmitMessage).not.toHaveBeenCalled();
    expect(textarea.value).toBe(starter.prompt);
    // the first real input slot is highlighted, not the [Source](URL) link
    const [firstSlot] = findStarterSlots(starter.prompt);
    expect(textarea.selectionStart).toBe(firstSlot.start);
    expect(textarea.selectionEnd).toBe(firstSlot.end);
    // and the react-hook-form mirror is kept in sync
    expect(mockSetValue).toHaveBeenCalledWith('text', starter.prompt, {
      shouldDirty: true,
      shouldValidate: true,
    });
  });

  it('pre-selects the bound MCP servers on click', () => {
    const bound = marketCat.starters.find((s) => (s.mcpServers ?? []).length > 0)!;
    render(<ConversationStarters />);
    fireEvent.click(screen.getByLabelText(cardName(bound)));
    expect(mockSetBadgeMCP).toHaveBeenCalledWith(bound.mcpServers);
  });

  it('moves Tab through the slots and releases focus at the end', () => {
    const twoParam = marketCat.starters.find((s) => findStarterSlots(s.prompt).length >= 2)!;
    render(<ConversationStarters />);
    fireEvent.click(screen.getByText(marketCat.label));
    fireEvent.click(screen.getByLabelText(cardName(twoParam)));
    expect(textarea.value).toBe(twoParam.prompt);

    const [first, second] = findStarterSlots(twoParam.prompt);
    expect(textarea.selectionStart).toBe(first.start);

    // first Tab moves the highlight to the second slot (default prevented)
    expect(fireEvent.keyDown(textarea, { key: 'Tab' })).toBe(false);
    expect(textarea.selectionStart).toBe(second.start);
    expect(textarea.selectionEnd).toBe(second.end);
  });

  it('releases Tab (no preventDefault) once the last slot is reached', () => {
    render(<ConversationStarters />);
    fireEvent.click(screen.getByLabelText(cardName(citizenCat.starters[0])));

    const slots = findStarterSlots(citizenCat.starters[0].prompt);
    const last = slots[slots.length - 1];
    textarea.setSelectionRange(last.start, last.end);

    expect(fireEvent.keyDown(textarea, { key: 'Tab' })).toBe(true);
  });
});
