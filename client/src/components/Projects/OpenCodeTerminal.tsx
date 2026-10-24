import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Play, Square, RotateCw } from 'lucide-react';
import { Button } from '@librechat/client';

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
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>(
    'disconnected',
  );
  const [ptyInfo, setPtyInfo] = useState<{ id: string; command: string } | null>(null);

  const connectTerminal = async () => {
    if (!projectId) return;
    setStatus('connecting');

    try {
      // 1. Create a PTY session via /api/opencode/:projectId/pty
      const res = await fetch(`/api/opencode/${encodeURIComponent(projectId)}/pty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`Failed to create PTY: ${res.statusText}`);
      }

      const pty = await res.json();
      setPtyInfo({ id: pty.id, command: pty.command });

      // 2. Open WebSocket to /api/opencode/pty/:ptyId/connect
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/opencode/pty/${pty.id}/connect`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        termInstance.current?.focus();
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          termInstance.current?.write(event.data);
        }
      };

      ws.onerror = (err) => {
        console.error('PTY WebSocket error:', err);
        setStatus('error');
      };

      ws.onclose = () => {
        setStatus('disconnected');
      };
    } catch (err: any) {
      console.error('Terminal init error:', err);
      setStatus('error');
      termInstance.current?.writeln(`\r\n\x1b[31m[Error starting terminal: ${err.message}]\x1b[0m\r\n`);
    }
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Consolas, "Fira Code", monospace, "Segoe UI"',
      fontSize: 13,
      theme: {
        background: '#141416',
        foreground: '#e4e4e7',
        cursor: '#38bdf8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
      },
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

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch (e) {}
    };
    window.addEventListener('resize', handleResize);

    // Initial connection
    connectTerminal();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (socketRef.current) {
        socketRef.current.close();
      }
      term.dispose();
    };
  }, [projectId]);

  const sendCommand = (cmd: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(`${cmd}\r\n`);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-[#141416] text-white rounded-xl border border-border-light overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-light bg-surface-secondary text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'connected'
                ? 'bg-green-500'
                : status === 'connecting'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
            }`}
          />
          <span className="font-mono font-medium text-text-primary">
            OpenCode CLI Terminal
          </span>
          {projectPath && (
            <span className="text-text-secondary truncate max-w-xs font-mono">
              ({projectPath})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => sendCommand('opencode run')}
            className="h-7 text-xs px-2 gap-1 text-text-secondary hover:text-text-primary"
            title="Launch interactive OpenCode session"
          >
            <Play className="size-3" />
            opencode run
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (socketRef.current) socketRef.current.close();
              connectTerminal();
            }}
            className="h-7 text-xs px-2 gap-1 text-text-secondary hover:text-text-primary"
            title="Restart terminal"
          >
            <RotateCw className="size-3" />
            Reset
          </Button>
        </div>
      </div>
      <div className="flex-1 p-2 min-h-[160px]" ref={terminalRef} />
    </div>
  );
}
