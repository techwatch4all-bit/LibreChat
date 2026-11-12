import React, { useCallback, useMemo, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Square, Trash, X } from 'lucide-react';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  Spinner,
  useToastContext,
} from '@librechat/client';
import { QueryKeys } from 'librechat-data-provider';
import { useDeleteConversationMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { NotificationSeverity } from '~/common';
import {
  bulkSelectModeAtom,
  exitBulkSelectModeAtom,
  selectedConvoIdsAtom,
  setSelectedConvosAtom,
} from './bulkSelection';

type BulkSelectBarProps = {
  /** The conversation ids currently rendered by the list (visible + loaded),
   *  the pool "select all" can act on. */
  visibleIds: string[];
};

/** How many single-conversation deletes may be in flight at once. Each request
 *  runs the full server-side per-conversation cleanup (checkpoints, live agent
 *  generations, shared links), so a modest ceiling avoids hammering the
 *  deletion fences while still finishing dozens of chats quickly. */
const DELETE_CONCURRENCY = 4;

/**
 * The selection toolbar shown under the Chats header while bulk selection is
 * active: count, select-all, delete and cancel. Deletion reuses the existing
 * per-conversation delete mutation once per picked chat — the same code path
 * the row menu's Delete uses — so every server-side cleanup (checkpointer,
 * running-agent fence, shared links) runs exactly as it does for one.
 */
export function BulkSelectBar({ visibleIds }: BulkSelectBarProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const bulkSelectMode = useAtomValue(bulkSelectModeAtom);
  const selectedIds = useAtomValue(selectedConvoIdsAtom);
  const setSelected = useSetAtom(setSelectedConvosAtom);
  const exitMode = useSetAtom(exitBulkSelectModeAtom);

  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const selectedCount = selectedIds.size;
  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id)),
    [visibleIds, selectedIds],
  );

  const deleteMutation = useDeleteConversationMutation();

  const runDeletes = useCallback(
    async (ids: string[]) => {
      const routeId = window.location.pathname.split('/').pop();
      const openedSelected = routeId != null && ids.includes(routeId);
      let failures = 0;
      setRemaining(ids.length);
      setDeleting(true);
      const queue = [...ids];
      const workers = Array.from(
        { length: Math.min(DELETE_CONCURRENCY, queue.length) },
        async () => {
          while (queue.length > 0) {
            const id = queue.shift();
            if (id == null) {
              return;
            }
            try {
              await deleteMutation.mutateAsync({ conversationId: id, source: 'button' });
            } catch {
              failures += 1;
            }
            setRemaining(queue.length);
          }
        },
      );
      await Promise.all(workers);
      setDeleting(false);
      setShowConfirm(false);
      exitMode();
      if (openedSelected) {
        navigate('/c/new', { replace: true });
      }
      if (failures === 0) {
        showToast({
          message: localize('com_ui_bulk_delete_success', { count: ids.length }),
          severity: NotificationSeverity.SUCCESS,
          showIcon: true,
        });
      } else {
        showToast({
          message: localize('com_ui_bulk_delete_error', {
            deleted: String(ids.length - failures),
            total: String(ids.length),
          }),
          severity: NotificationSeverity.ERROR,
          showIcon: true,
        });
      }
      void queryClient.invalidateQueries([QueryKeys.allConversations]);
    },
    [deleteMutation, exitMode, localize, navigate, queryClient, showToast],
  );

  if (!bulkSelectMode) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 pb-2 pt-1"
      data-testid="bulk-select-bar"
      role="toolbar"
      aria-label={localize('com_ui_bulk_select_chats')}
    >
      <span className="text-xs text-text-secondary" aria-live="polite">
        {deleting
          ? localize('com_ui_bulk_deleting', { count: remaining })
          : localize('com_ui_chats_selected', { count: selectedCount })}
      </span>
      <div className="flex flex-1 items-center justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          className="h-7 rounded-lg px-2 text-xs"
          onClick={() => setSelected(allVisibleSelected ? new Set() : new Set(visibleIds))}
          disabled={deleting}
          aria-pressed={allVisibleSelected}
        >
          {allVisibleSelected ? (
            <>
              <Square className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {localize('com_ui_clear_selection')}
            </>
          ) : (
            <>
              <CheckSquare className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {localize('com_ui_select_all')}
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="h-7 rounded-lg px-2 text-xs"
          onClick={() => setShowConfirm(true)}
          disabled={deleting || selectedCount === 0}
          aria-haspopup="dialog"
        >
          {deleting ? (
            <Spinner className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Trash className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          )}
          {localize('com_ui_delete_selected')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-7 rounded-lg px-2 text-xs"
          onClick={() => exitMode()}
          disabled={deleting}
          aria-label={localize('com_ui_cancel')}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      <OGDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <OGDialogContent
          role="alertdialog"
          className="w-11/12 max-w-lg rounded-2xl bg-surface-secondary"
        >
          <OGDialogHeader>
            <OGDialogTitle>{localize('com_ui_delete_conversation')}</OGDialogTitle>
          </OGDialogHeader>
          <div className="flex flex-col gap-4 px-2 pb-2">
            <p className="text-sm text-text-secondary">
              {localize('com_ui_bulk_delete_confirm', { count: selectedCount })}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
              >
                {localize('com_ui_cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void runDeletes([...selectedIds])}
                disabled={deleting || selectedCount === 0}
              >
                {deleting ? (
                  <Spinner className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Trash className="mr-1 h-4 w-4" aria-hidden="true" />
                )}
                {localize('com_ui_delete')}
              </Button>
            </div>
          </div>
        </OGDialogContent>
      </OGDialog>
    </div>
  );
}

export default BulkSelectBar;
