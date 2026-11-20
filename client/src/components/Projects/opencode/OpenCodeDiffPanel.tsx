import React from 'react';
import { FileDiff } from 'lucide-react';
import { Spinner } from '@librechat/client';
import type { OpenCodeDiffDto } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';

interface OpenCodeDiffPanelProps {
  diffs: OpenCodeDiffDto[];
  isLoading: boolean;
}

export default function OpenCodeDiffPanel({ diffs, isLoading }: OpenCodeDiffPanelProps) {
  const localize = useLocalize();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 p-6 text-sm text-text-secondary">
        <Spinner className="size-4" />
        <span>{localize('com_opencode_diff_loading')}</span>
      </div>
    );
  }

  if (diffs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-text-secondary">
        <FileDiff className="size-6 opacity-50" aria-hidden="true" />
        <p>{localize('com_opencode_diffs_empty')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      {diffs.map((entry, idx) => (
        <article
          key={`${entry.file ?? 'diff'}-${idx}`}
          className="overflow-hidden rounded-lg border border-border-light bg-surface-primary"
        >
          <header className="flex items-center justify-between border-b border-border-light bg-surface-secondary px-3 py-1.5 text-xs">
            <span className="truncate font-mono font-medium text-text-primary">
              {entry.file ?? 'unknown'}
            </span>
            <span className="flex shrink-0 items-center gap-2 font-mono">
              {entry.status ? (
                <span className="rounded bg-surface-tertiary px-1.5 py-0.5 text-[10px] uppercase text-text-secondary">
                  {entry.status}
                </span>
              ) : null}
              <span className="text-text-primary">+{entry.additions}</span>
              <span className="text-text-destructive">-{entry.deletions}</span>
            </span>
          </header>
          {entry.patch ? (
            <pre className="max-h-96 overflow-auto p-2.5 font-mono text-xs leading-relaxed text-text-primary">
              {entry.patch.split('\n').map((line, lineIdx) => {
                let lineClass = 'block px-1';
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  lineClass += ' bg-surface-tertiary font-medium text-text-primary';
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                  lineClass += ' bg-surface-destructive/10 text-text-destructive';
                } else if (line.startsWith('@@')) {
                  lineClass += ' text-text-secondary';
                }
                return (
                  <span key={lineIdx} className={lineClass}>
                    {line}
                  </span>
                );
              })}
            </pre>
          ) : null}
        </article>
      ))}
    </div>
  );
}
