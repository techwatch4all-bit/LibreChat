import React, { useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Button, Spinner } from '@librechat/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MutationKeys, QueryKeys, dataService } from 'librechat-data-provider';
import { AlertTriangle, Globe, Play, RotateCw, Sparkles, Square } from 'lucide-react';
import {
  openCodePendingAutoPromptAtom,
  openCodeRunStateAtom,
  openCodeSessionErrorAtom,
} from './atoms';
import { useLocalize } from '~/hooks';

function formatCommandLabel(cmd: string): string {
  if (cmd === 'static') {
    return 'Static HTML';
  }
  return cmd;
}

interface OpenCodePreviewPanelProps {
  projectId: string;
  simpleMode?: boolean;
  hasRunnableApp?: boolean;
}

export default function OpenCodePreviewPanel({
  projectId,
  simpleMode = false,
  hasRunnableApp = false,
}: OpenCodePreviewPanelProps) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const runState = useAtomValue(openCodeRunStateAtom);
  const sessionError = useAtomValue(openCodeSessionErrorAtom);
  const setPendingAutoPrompt = useSetAtom(openCodePendingAutoPromptAtom);
  const [commandInput, setCommandInput] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const prevRunStateRef = useRef(runState);
  const autoStartedRef = useRef<string | null>(null);
  const userEditedCommandRef = useRef(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; message?: string; source?: string } | undefined;
      if (data?.type === 'SATCHIDA_PREVIEW_ERROR' && typeof data.message === 'string') {
        setRuntimeError(data.source ? `${data.message} (${data.source})` : data.message);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const statusQuery = useQuery(
    [QueryKeys.opencodePreviewStatus, projectId],
    () => dataService.getOpenCodePreviewStatus(projectId),
    {
      enabled: Boolean(projectId),
      refetchInterval: (data) => (data?.running && !data.port ? 1500 : 5000),
      refetchOnWindowFocus: true,
    },
  );

  const startMutation = useMutation(
    [MutationKeys.opencodeStartPreview, projectId],
    () =>
      dataService.startOpenCodePreview(projectId, {
        command: commandInput.trim() || undefined,
      }),
    {
      onSuccess: () => {
        setReloadNonce((n) => n + 1);
        queryClient.invalidateQueries([QueryKeys.opencodePreviewStatus, projectId]);
      },
    },
  );

  const stopMutation = useMutation(
    [MutationKeys.opencodeStopPreview, projectId],
    () => dataService.stopOpenCodePreview(projectId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.opencodePreviewStatus, projectId]);
      },
    },
  );

  const status = statusQuery.data;
  const isRunning = status?.running === true;
  const proxyPath = status?.proxyPath ?? null;
  const availableScripts = status?.availableScripts ?? [];
  const logs = status?.logs ?? [];
  const hasServerLogError = logs.some((line) =>
    /(?:error|exception|eaddrinuse|err_module_not_found|syntaxerror|cannot find|failed)/i.test(
      line,
    ),
  );

  useEffect(() => {
    autoStartedRef.current = null;
    userEditedCommandRef.current = false;
    setCommandInput('');
    setRuntimeError(null);
  }, [projectId]);

  useEffect(() => {
    if (!userEditedCommandRef.current && typeof status?.recommendedCommand === 'string') {
      setCommandInput(status.recommendedCommand);
    }
  }, [status?.recommendedCommand]);

  useEffect(() => {
    const wasBusy = prevRunStateRef.current !== 'idle';
    prevRunStateRef.current = runState;

    if (runState === 'idle' && hasRunnableApp && !startMutation.isLoading && !sessionError) {
      if (wasBusy) {
        // Restart preview server after a successful AI build/edit turn so updated code & port are fresh
        autoStartedRef.current = projectId;
        startMutation.mutate();
      } else if (!isRunning && autoStartedRef.current !== projectId) {
        autoStartedRef.current = projectId;
        startMutation.mutate();
      }
    }
  }, [hasRunnableApp, isRunning, projectId, runState, sessionError, startMutation]);

  const handleReload = () => {
    if (!isRunning && !startMutation.isLoading) {
      startMutation.mutate();
      return;
    }
    void statusQuery.refetch().then((res) => {
      if (!res.data?.running && !startMutation.isLoading) {
        startMutation.mutate();
      } else {
        setReloadNonce((n) => n + 1);
      }
    });
  };

  const handleAutoFix = () => {
    const recentLogs = logs.slice(-15).join('\n').trim();
    const effectiveCmd =
      status?.command || commandInput || status?.recommendedCommand || 'auto-detect';
    let prompt: string;
    if (runtimeError) {
      prompt = `Please automatically diagnose and fix this browser runtime error in the live preview so it renders cleanly:\n\nBrowser Runtime Error: ${runtimeError}${recentLogs ? `\n\nServer Logs:\n${recentLogs}` : ''}`;
    } else if (recentLogs) {
      prompt = `Please automatically diagnose and fix this preview server issue so the live preview starts and renders cleanly:\n\nPreview command: "${effectiveCmd}"\nRecent logs:\n${recentLogs}`;
    } else {
      prompt =
        'Please inspect this project workspace and configure it so the live preview server starts and renders cleanly (for example, add or verify an index.html, server.mjs, or package.json dev script).';
    }
    setRuntimeError(null);
    setPendingAutoPrompt(prompt);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-primary text-text-primary">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-light bg-surface-secondary px-3 py-2 text-xs">
        {!simpleMode ? (
          <div className="flex min-w-[200px] flex-1 items-center gap-1.5">
            {availableScripts.length > 1 ? (
              <select
                value={availableScripts.includes(commandInput) ? commandInput : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    userEditedCommandRef.current = true;
                    setCommandInput(e.target.value);
                  }
                }}
                aria-label="Select project script"
                className="rounded border border-border-light bg-surface-primary px-2 py-1 font-mono text-xs text-text-primary"
              >
                {availableScripts.map((scr) => (
                  <option key={scr} value={scr}>
                    {formatCommandLabel(scr)}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              type="text"
              value={commandInput}
              onChange={(e) => {
                userEditedCommandRef.current = true;
                setCommandInput(e.target.value);
              }}
              placeholder={localize('com_opencode_preview_command_placeholder')}
              aria-label={localize('com_opencode_preview_command_placeholder')}
              className="min-w-[140px] flex-1 rounded border border-border-light bg-surface-primary px-2 py-1 font-mono text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-border-heavy"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 font-medium text-text-primary">
            <Globe className="size-3.5 text-text-secondary" aria-hidden="true" />
            <span>{localize('com_opencode_view_preview')}</span>
            {availableScripts.length > 1 ? (
              <select
                value={commandInput}
                onChange={(e) => {
                  userEditedCommandRef.current = true;
                  setCommandInput(e.target.value);
                }}
                aria-label="Select run script"
                className="ml-1 rounded border border-border-light bg-surface-primary px-2 py-0.5 font-mono text-[11px] text-text-primary"
              >
                {availableScripts.map((scr) => (
                  <option key={scr} value={scr}>
                    {formatCommandLabel(scr)}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        )}

        <div className="flex items-center gap-2">
          {runtimeError || hasServerLogError ? (
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={handleAutoFix}
              className="h-7 gap-1 bg-amber-600 px-2.5 text-xs text-white hover:bg-amber-500"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              {localize('com_opencode_auto_fix_error')}
            </Button>
          ) : null}

          {!isRunning ? (
            <Button
              type="button"
              size="sm"
              variant="default"
              disabled={startMutation.isLoading}
              onClick={() => {
                setRuntimeError(null);
                startMutation.mutate();
              }}
              className="h-7 gap-1 px-2.5 text-xs"
            >
              <Play className="size-3.5" aria-hidden="true" />
              {startMutation.isLoading
                ? localize('com_opencode_preview_starting')
                : localize('com_opencode_preview_start')}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={startMutation.isLoading}
                onClick={handleReload}
                className="h-7 gap-1 px-2 text-xs"
              >
                <RotateCw className="size-3.5" aria-hidden="true" />
                {localize('com_opencode_preview_reload')}
              </Button>
              {!simpleMode || !proxyPath ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={stopMutation.isLoading}
                  onClick={() => stopMutation.mutate()}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Square className="size-3.5" aria-hidden="true" />
                  {localize('com_opencode_preview_stop')}
                </Button>
              ) : null}
            </>
          )}

          {!simpleMode && status?.port ? (
            <span className="rounded bg-surface-tertiary px-2 py-0.5 font-mono text-[11px] text-text-secondary">
              127.0.0.1:{status.port}
            </span>
          ) : null}
        </div>
      </div>

      {runtimeError ? (
        <div className="flex items-center justify-between gap-2 border-b border-border-light bg-surface-secondary px-3 py-1.5 text-xs text-text-destructive">
          <div className="flex items-center gap-1.5 truncate">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate font-mono">{runtimeError}</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAutoFix}
            className="h-6 px-2 text-[11px]"
          >
            <Sparkles className="mr-1 size-3" aria-hidden="true" />
            {localize('com_opencode_auto_fix_ai')}
          </Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isRunning && proxyPath ? (
          <iframe
            key={`${proxyPath}-${reloadNonce}`}
            src={proxyPath}
            title={localize('com_opencode_preview_iframe_title')}
            className="min-h-0 w-full flex-1 border-0 bg-white"
          />
        ) : null}
        {!(isRunning && proxyPath) && (isRunning || startMutation.isLoading) ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-text-secondary">
            <Spinner className="size-5" />
            <p>{localize('com_opencode_preview_waiting_port')}</p>
            {logs.length > 0 ? (
              <pre className="mt-2 max-h-44 w-full max-w-xl overflow-auto rounded-lg border border-border-light bg-surface-secondary p-3 text-left font-mono text-[11px] text-text-primary">
                {logs.slice(-12).join('\n')}
              </pre>
            ) : null}
            <div className="mt-1 flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAutoFix}
                className="h-7 gap-1 px-2.5 text-xs"
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                {localize('com_opencode_auto_configure_start')}
              </Button>
            </div>
          </div>
        ) : null}
        {!isRunning && !startMutation.isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-text-secondary">
            <Globe className="size-7 opacity-50" aria-hidden="true" />
            <p>{localize('com_opencode_preview_stopped')}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={startMutation.isLoading}
                onClick={() => startMutation.mutate()}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                <Play className="size-3.5" aria-hidden="true" />
                {commandInput
                  ? `${localize('com_opencode_preview_start')} (${formatCommandLabel(commandInput)})`
                  : localize('com_opencode_preview_start')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAutoFix}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                {localize('com_opencode_auto_configure_run')}
              </Button>
            </div>
            {logs.length > 0 ? (
              <pre className="mt-2 max-h-40 w-full max-w-xl overflow-auto rounded-lg border border-border-light bg-surface-secondary p-2.5 text-left font-mono text-[11px] text-text-primary">
                {logs.slice(-10).join('\n')}
              </pre>
            ) : null}
          </div>
        ) : null}

        {!simpleMode && (status?.logs ?? []).length > 0 ? (
          <details className="border-t border-border-light bg-surface-secondary text-xs">
            <summary className="cursor-pointer select-none px-3 py-1.5 font-medium text-text-secondary">
              {localize('com_opencode_preview_logs')} ({status?.logs.length})
            </summary>
            <pre className="max-h-36 overflow-auto border-t border-border-light bg-surface-primary p-2 font-mono text-[11px] text-text-primary">
              {(status?.logs ?? []).join('\n')}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
