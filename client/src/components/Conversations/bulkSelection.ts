import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';

/**
 * Feature-owned selection state for bulk chat management in the sidebar
 * (per the client state-ownership rule: the Conversations feature both writes
 * and reads this, so it lives here as Jotai rather than in the global store).
 *
 * The id set is an `atomWithReset` so leaving selection mode clears every
 * picked chat in one statement — a mode toggle that forgot to clear would let
 * a delete silently hit chats the user checked minutes ago.
 */
export const bulkSelectModeAtom = atom(false);

export const selectedConvoIdsAtom = atomWithReset<Set<string>>(new Set());

/** Toggles one conversation in the selection set; write-only derived atom. */
export const toggleSelectedConvoAtom = atom(null, (get, set, conversationId: string) => {
  const next = new Set(get(selectedConvoIdsAtom));
  if (next.has(conversationId)) {
    next.delete(conversationId);
  } else {
    next.add(conversationId);
  }
  set(selectedConvoIdsAtom, next);
});

/** Sets the whole selection at once (select-all / clear). */
export const setSelectedConvosAtom = atom(null, (_get, set, ids: Set<string>) => {
  set(selectedConvoIdsAtom, new Set(ids));
});

/** Leaves selection mode and clears the picked set together. */
export const exitBulkSelectModeAtom = atom(null, (get, set) => {
  set(bulkSelectModeAtom, false);
  set(selectedConvoIdsAtom, new Set());
});
