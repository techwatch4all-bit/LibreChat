import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecoilRoot } from 'recoil';
import { createStore, getDefaultStore } from 'jotai';
import { MemoryRouter } from 'react-router-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TConversation } from 'librechat-data-provider';
import Conversations from '../Conversations';
import {
  bulkSelectModeAtom,
  exitBulkSelectModeAtom,
  selectedConvoIdsAtom,
  toggleSelectedConvoAtom,
} from '../bulkSelection';

/* Bulk selection is Jotai feature state; the sidebar list renders with the
 * app's default Jotai store, so the tests drive the same store. */

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, opts?: Record<string, unknown>) => {
    if (opts?.count != null) {
      return `${key}:${String(opts.count)}`;
    }
    return key;
  },
  useElementSize: () => ({ ref: jest.fn(), width: 300, height: 600 }),
  useOuterScrollWindow: () => ({
    ref: jest.fn(),
    height: 600,
    scrollTop: 0,
    isOnScreen: () => true,
  }),
  TranslationKeys: {},
}));

const mockDeleteMutate = jest.fn();
const mockDeleteMutateAsync = jest.fn().mockResolvedValue({});

jest.mock('~/data-provider', () => ({
  useActiveJobs: () => ({ data: { activeJobIds: [] } }),
  useDeleteConversationMutation: () => ({
    mutate: mockDeleteMutate,
    mutateAsync: mockDeleteMutateAsync,
  }),
  useAssignConversationToProjectMutation: () => ({ mutateAsync: jest.fn() }),
  usePinConversationMutation: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('@librechat/client', () => ({
  buttonVariants: () => '',
  Spinner: () => <div data-testid="spinner" />,
  useMediaQuery: () => false,
  useToastContext: () => ({ showToast: jest.fn() }),
  OGDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="og-dialog">{children}</div> : null,
  OGDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OGDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OGDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel,
    ...rest
  }: React.ComponentProps<'button'>) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} {...rest}>
      {children}
    </button>
  ),
}));

jest.mock('~/utils', () => ({
  groupConversations: jest.fn(jest.requireActual('~/utils/convos').groupConversations),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

jest.mock('../Convo', () => ({
  __esModule: true,
  default: ({ conversation }: { conversation: TConversation }) => (
    <div data-testid="convo">{conversation.title}</div>
  ),
}));

jest.mock('~/store', () => {
  const { atom } = jest.requireActual('recoil');
  return {
    __esModule: true,
    default: {
      search: atom({ key: 'test-bulk-search', default: { query: '' } }),
    },
  };
});

jest.mock('react-virtualized', () => {
  const actual = jest.requireActual('react-virtualized');
  return {
    ...actual,
    CellMeasurer: ({
      children,
    }: {
      children: (opts: { registerChild: () => void }) => React.ReactNode;
    }) => children({ registerChild: () => {} }),
    List: ({
      rowRenderer,
      rowCount,
    }: {
      rowRenderer: (opts: {
        index: number;
        key: string;
        style: object;
        parent: object;
      }) => React.ReactNode;
      rowCount: number;
    }) => (
      <div data-testid="virtual-list" data-row-count={rowCount}>
        {Array.from({ length: Math.min(rowCount, 10) }, (_, i) =>
          rowRenderer({ index: i, key: `row-${i}`, style: {}, parent: {} }),
        )}
      </div>
    ),
  };
});

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const makeConvo = (id: string): TConversation =>
  ({
    conversationId: id,
    title: `Chat ${id}`,
    endpoint: 'openAI',
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
  }) as TConversation;

const renderList = (convos: TConversation[]) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <DndProvider backend={HTML5Backend}>
        <RecoilRoot>
          <QueryClientProvider client={queryClient}>
            <Conversations
              conversations={convos}
              moveToTop={jest.fn()}
              toggleNav={jest.fn()}
              containerRef={{ current: null } as never}
              loadMoreConversations={jest.fn()}
              isLoading={false}
              isSearchLoading={false}
              isChatsExpanded
              setIsChatsExpanded={jest.fn()}
              scrollViewport={null}
              scrollContent={null}
            />
          </QueryClientProvider>
        </RecoilRoot>
      </DndProvider>
    </MemoryRouter>,
  );

describe('bulkSelection atoms', () => {
  it('toggles an id in and out of the set', () => {
    const store = createStore();
    store.set(toggleSelectedConvoAtom, 'a');
    expect(store.get(selectedConvoIdsAtom).has('a')).toBe(true);
    store.set(toggleSelectedConvoAtom, 'a');
    expect(store.get(selectedConvoIdsAtom).has('a')).toBe(false);
  });

  it('exitBulkSelectMode clears both mode and selection', () => {
    const store = createStore();
    store.set(bulkSelectModeAtom, true);
    store.set(toggleSelectedConvoAtom, 'a');
    store.set(exitBulkSelectModeAtom);
    expect(store.get(bulkSelectModeAtom)).toBe(false);
    expect(store.get(selectedConvoIdsAtom).size).toBe(0);
  });
});

describe('bulk select toolbar', () => {
  beforeEach(() => {
    mockDeleteMutateAsync.mockClear();
    const store = getDefaultStore();
    store.set(exitBulkSelectModeAtom);
  });

  it('shows the bar only in selection mode, with select-all and delete actions', () => {
    const view = renderList([makeConvo('a'), makeConvo('b')]);
    expect(screen.queryByTestId('bulk-select-bar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('bulk-select-toggle'));
    expect(screen.getByTestId('bulk-select-bar')).toBeInTheDocument();
    expect(screen.getByText('com_ui_chats_selected:0')).toBeInTheDocument();
    fireEvent.click(screen.getByText('com_ui_select_all'));
    expect(screen.getByText('com_ui_chats_selected:2')).toBeInTheDocument();
    view.unmount();
  });

  it('deletes every selected conversation on confirm and exits selection mode', async () => {
    const store = getDefaultStore();
    store.set(bulkSelectModeAtom, true);
    store.set(selectedConvoIdsAtom, new Set(['a', 'b']));
    renderList([makeConvo('a'), makeConvo('b')]);
    expect(screen.getByTestId('bulk-select-bar')).toBeInTheDocument();
    fireEvent.click(screen.getByText('com_ui_delete_selected'));
    expect(screen.getByTestId('og-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_delete' }));
    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledTimes(2);
    });
    expect(mockDeleteMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'a' }),
    );
    expect(mockDeleteMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'b' }),
    );
    await waitFor(() => {
      expect(store.get(bulkSelectModeAtom)).toBe(false);
      expect(store.get(selectedConvoIdsAtom).size).toBe(0);
    });
  });
});
