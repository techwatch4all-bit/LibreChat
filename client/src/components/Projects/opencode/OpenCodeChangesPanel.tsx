import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, RotateCw } from 'lucide-react';
import { Button, Spinner } from '@librechat/client';
import { QueryKeys, dataService } from 'librechat-data-provider';
import OpenCodeDiffPanel from './OpenCodeDiffPanel';
import { useLocalize } from '~/hooks';

interface OpenCodeChangesPanelProps {
  projectId: string;
}

export default function OpenCodeChangesPanel({ projectId }: OpenCodeChangesPanelProps) {
  const localize = useLocalize();

  const vcsQuery = useQuery(
    [QueryKeys.opencodeVcs, projectId],
    () => dataService.getOpenCodeVcs(projectId),
    { enabled: Boolean(projectId), refetchOnWindowFocus: false },
  );

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

      {renderContent()}
    </div>
  );
}
