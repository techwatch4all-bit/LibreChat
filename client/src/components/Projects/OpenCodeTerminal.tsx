import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { RotateCw } from 'lucide-react';
import { Button } from '@librechat/client';
import { dataService } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';

interface OpenCodeTerminalProps {
  projectId: string;
  projectPath?: string;
  className?: string;
}

export default function OpenCodeTerminal({
  projectId,
  projectPath,
  className = '',
}: OpenCodeTerminalProps) {
  const localize = useLocalize();
  const localizeRef = useRef(localize);
  localizeRef.current = localize;
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mode, setMode] = useState<'opencode' | 'shell'>('opencode');
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>(
    'disconnected',
  );

  const syncPtySize = useCallback(
    (cols: number, rows: number) => {
      const activePtyId = ptyIdRef.current;
      if (!activePtyId || !projectId || cols < 20 || rows < 5) {
        return;
      }
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }
      resizeTimerRef.current = setTimeout(() => {
        void dataService.resizeOpenCodePty(projectId, activePtyId, { cols, rows }).catch(() => {
          /* ignore transient resize failure */
        });
      }, 80);
    },
    [projectId],
  );

  const connectTerminal = useCallback(
    async (targetMode: 'opencode' | 'shell' = mode) => {
      if (!projectId) {
        return;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      ptyIdRef.current = null;
      termInstance.current?.reset();
      setStatus('connecting');

      try {
        const pty = await dataService.createOpenCodePty(projectId, { mode: targetMode });
        ptyIdRef.current = pty.id;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/opencode/pty/${encodeURIComponent(
          pty.id,
        )}/connect?ticket=${encodeURIComponent(pty.connectTicket)}`;

        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          setStatus('connected');
          try {
            fitAddonRef.current?.fit();
            if (termInstance.current) {
              syncPtySize(termInstance.current.cols, termInstance.current.rows);
            }
          } catch {
            /* ignore */
          }
          termInstance.current?.focus();
        };

        ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            termInstance.current?.write(event.data);
          }
        };

        ws.onerror = () => {
          setStatus('error');
        };

        ws.onclose = () => {
          setStatus('disconnected');
        };
      } catch {
        setStatus('error');
        termInstance.current?.writeln(
          `\r\n[${localizeRef.current('com_opencode_terminal_init_error')}]\r\n`,
        );
      }
    },
    [mode, projectId, syncPtySize],
  );

  useEffect(() => {
    if (!terminalRef.current) {
      return;
    }

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Consolas, "Fira Code", monospace, "Segoe UI"',
      fontSize: 13,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    termInstance.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(data);
      }
    });

    // Native clipboard paste support (Ctrl+V / Shift+Insert / right-click paste)
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text');
      if (text && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        e.preventDefault();
        socketRef.current.send(text);
      }
    };
    const terminalEl = terminalRef.current;
    terminalEl.addEventListener('paste', handlePaste);

    const resizeDisp = term.onResize(({ cols, rows }) => {
      syncPtySize(cols, rows);
    });

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch {
        /* ignore resize error when hidden */
      }
    };
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    if (resizeObserver && terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }
    window.addEventListener('resize', handleResize);
    void connectTerminal(mode);

    return () => {
      terminalEl?.removeEventListener('paste', handlePaste);
      resizeDisp.dispose();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
      term.dispose();
    };
  }, [connectTerminal, mode, syncPtySize]);

  const statusKeyMap = {
    connected: 'com_opencode_status_connected',
    connecting: 'com_opencode_status_connecting',
    error: 'com_opencode_status_error',
    disconnected: 'com_opencode_status_disconnected',
  } as const;
  const statusText = localize(statusKeyMap[status]);

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border border-border-light bg-surface-primary ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border-light bg-surface-secondary px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2 truncate">
          <div className="flex items-center rounded border border-border-light bg-surface-primary p-0.5">
            <button
              type="button"
              onClick={() => setMode('opencode')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                mode === 'opencode'
                  ? 'bg-surface-active text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {localize('com_opencode_terminal_mode_tui')}
            </button>
            <button
              type="button"
              onClick={() => setMode('shell')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                mode === 'shell'
                  ? 'bg-surface-active text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {localize('com_opencode_terminal_mode_shell')}
            </button>
          </div>
          {projectPath ? (
            <span className="truncate font-mono text-[11px] text-text-secondary">
              {projectPath}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-surface-tertiary px-1.5 py-0.5 text-[10px] text-text-secondary">
            {statusText}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void connectTerminal(mode)}
            className="h-6 px-2 text-xs"
            aria-label={localize('com_opencode_terminal_reconnect')}
          >
            <RotateCw className="mr-1 size-3" aria-hidden="true" />
            {localize('com_opencode_terminal_reconnect')}
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden bg-black p-1.5">
        <div ref={terminalRef} className="h-full w-full overflow-hidden" />
      </div>
    </div>
  );
}
