import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { Button, Spinner } from '@librechat/client';
import { GitBranch, History, RotateCcw, RotateCw, Undo2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import { activeOpenCodeSessionIdAtom } from './atoms';
import OpenCodeDiffPanel from './OpenCodeDiffPanel';
import { useLocalize } from '~/hooks';

interface OpenCodeChangesPanelProps {
  projectId: string;
}

export default function OpenCodeChangesPanel({ projectId }: OpenCodeChangesPanelProps) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const activeSessionId = useAtomValue(activeOpenCodeSessionIdAtom);
  const [revertedMessageId, setRevertedMessageId] = useState<string | null>(null);

  const vcsQuery = useQuery(
    [QueryKeys.opencodeVcs, projectId],
    () => dataService.getOpenCodeVcs(projectId),
    { enabled: Boolean(projectId), refetchOnWindowFocus: false },
  );

  const messagesQuery = useQuery(
    [QueryKeys.opencodeMessages, projectId, activeSessionId],
    () => dataService.getOpenCodeSessionMessages(projectId, activeSessionId ?? ''),
    { enabled: Boolean(projectId) && Boolean(activeSessionId), refetchOnWindowFocus: false },
  );

  const revertMutation = useMutation(
    (messageID: string) =>
      dataService.revertOpenCodeSession(projectId, activeSessionId ?? '', { messageID }),
    {
      onSuccess: (_, messageID) => {
        setRevertedMessageId(messageID);
        queryClient.invalidateQueries([QueryKeys.opencodeVcs, projectId]);
        queryClient.invalidateQueries([QueryKeys.opencodeTree, projectId]);
        queryClient.invalidateQueries([QueryKeys.opencodeMessages, projectId, activeSessionId]);
      },
    },
  );

  const unrevertMutation = useMutation(
    () => dataService.unrevertOpenCodeSession(projectId, activeSessionId ?? ''),
    {
      onSuccess: () => {
        setRevertedMessageId(null);
        queryClient.invalidateQueries([QueryKeys.opencodeVcs, projectId]);
        queryClient.invalidateQueries([QueryKeys.opencodeTree, projectId]);
        queryClient.invalidateQueries([QueryKeys.opencodeMessages, projectId, activeSessionId]);
      },
    },
  );

  const checkpoints = (messagesQuery.data ?? [])
    .filter((env) => env.info?.id && /^msg/.test(env.info.id))
    .slice(-8)
    .reverse();

  const branch = vcsQuery.data?.info?.branch;
  const statusList = vcsQuery.data?.status ?? [];
  const diffs = vcsQuery.data?.diff ?? [];

  const renderContent = () => {
    if (vcsQuery.isLoading) {
      return (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-text-secondary">
          <Spinner className="size-4" />
          <span>{localize('com_opencode_vcs_loading')}</span>
        </div>
      );
    }

    if (vcsQuery.isError) {
      return (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-text-destructive">
          {localize('com_opencode_error_generic')}
        </div>
      );
    }

    if (statusList.length === 0 && diffs.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-text-secondary">
          {localize('com_opencode_vcs_empty')}
        </div>
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {statusList.length > 0 ? (
          <div className="max-h-36 overflow-y-auto border-b border-border-light bg-surface-secondary/50 px-3 py-2 text-xs">
            <ul className="space-y-1">
              {statusList.map((entry) => (
                <li key={entry.file} className="flex items-center justify-between gap-2 font-mono">
                  <span className="truncate text-text-primary">{entry.file}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded bg-surface-tertiary px-1.5 py-0.5 text-[10px] uppercase text-text-secondary">
                      {entry.status}
                    </span>
                    <span className="text-text-primary">+{entry.additions}</span>
                    <span className="text-text-destructive">-{entry.deletions}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden">
          <OpenCodeDiffPanel diffs={diffs} isLoading={false} />
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-primary text-text-primary">
      <div className="flex items-center justify-between border-b border-border-light bg-surface-secondary px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <GitBranch className="size-3.5 text-text-secondary" aria-hidden="true" />
          <span className="font-medium text-text-secondary">
            {localize('com_opencode_vcs_branch')}:
          </span>
          <span className="rounded bg-surface-tertiary px-1.5 py-0.5 font-mono text-text-primary">
            {branch || localize('com_opencode_vcs_no_branch')}
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => vcsQuery.refetch()}
          disabled={vcsQuery.isFetching}
          className="h-6 gap-1 px-2 text-xs"
        >
          <RotateCw className="size-3" aria-hidden="true" />
          {localize('com_opencode_refresh')}
        </Button>
      </div>

      {activeSessionId && checkpoints.length > 0 ? (
        <div className="max-h-40 overflow-y-auto border-b border-border-light bg-surface-secondary/40 px-3 py-2 text-xs">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-medium text-text-secondary">
              <History className="size-3.5" aria-hidden="true" />
              <span>{`${localize('com_opencode_view_changes')} (${checkpoints.length})`}</span>
            </div>
            {revertedMessageId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => unrevertMutation.mutate()}
                disabled={unrevertMutation.isLoading}
                className="h-6 gap-1 px-2 text-[11px]"
              >
                <Undo2 className="size-3" aria-hidden="true" />
                {'Undo'}
              </Button>
            ) : null}
          </div>
          <ul className="space-y-1">
            {checkpoints.map((env) => {
              const msgId = env.info.id;
              const toolParts = (env.parts ?? []).filter((p) => p.type === 'tool');
              const textPart = (env.parts ?? []).find((p) => p.type === 'text' && p.text);
              const label =
                toolParts.length > 0
                  ? `${env.info.role} · ${toolParts.map((t) => t.tool || 'tool').join(', ')}`
                  : `${env.info.role} · ${(textPart?.text ?? msgId).slice(0, 64)}`;
              return (
                <li
                  key={msgId}
                  className="flex items-center justify-between gap-2 rounded bg-surface-primary/70 px-2 py-1"
                >
                  <span className="truncate font-mono text-[11px] text-text-primary" title={label}>
                    {label}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => revertMutation.mutate(msgId)}
                    disabled={revertMutation.isLoading}
                    className="h-5 shrink-0 gap-1 px-1.5 text-[10px]"
                    title={msgId}
                  >
                    <RotateCcw className="size-2.5" aria-hidden="true" />
                    {localize('com_ui_reset')}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {renderContent()}
    </div>
  );
}
