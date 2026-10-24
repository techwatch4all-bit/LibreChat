import { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw, Terminal, Check, Clipboard } from 'lucide-react';
import { Button } from '@librechat/client';
import { useAuthContext } from '~/hooks/AuthContext';

export default function IdeView() {
  const { token } = useAuthContext();
  const [nonce, setNonce] = useState(() => Date.now().toString(36));
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [copied, setCopied] = useState(false);

  const idePort = 8085;
  const ideProxyUrl = '/api/ide/';
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
  const iframeSrc = `${ideProxyUrl}?folder=D:/LAN-AI-Infra/workspace&_r=${nonce}${tokenParam}`;

  const checkHealth = async () => {
    setStatus('checking');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(ideProxyUrl, {
        signal: controller.signal,
        headers,
      });
      clearTimeout(timeout);
      // HTTP 200 means proxy connected to upstream code-server successfully
      if (res.ok || res.status === 401) {
        setStatus('online');
      } else {
        setStatus('offline');
      }
    } catch {
      setStatus('offline');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const handleReload = () => {
    setNonce(Date.now().toString(36));
    checkHealth();
  };

  const handlePopOut = () => {
    window.open(ideProxyUrl, '_blank', 'noopener,noreferrer');
  };

  const copyUrl = async () => {
    try {
      const fullUrl = `${window.location.origin}${ideProxyUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-surface-primary text-text-primary">
      {/* Top action bar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-light bg-surface-primary-alt px-4 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-wide text-text-primary">
            VibeStudio IDE
          </span>
          <div className="flex items-center gap-1.5 rounded bg-surface-secondary px-2 py-0.5 text-[11px] text-text-secondary border border-border-light">
            <span
              className={`h-2 w-2 rounded-full ${
                status === 'online'
                  ? 'bg-emerald-500'
                  : status === 'offline'
                  ? 'bg-red-500'
                  : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span>PORT {idePort} ({status.toUpperCase()})</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={copyUrl}
            className="h-7 text-xs text-text-secondary hover:text-text-primary gap-1"
            title="Copy local IDE URL"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : 'Copy URL'}</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleReload}
            className="h-7 text-xs text-text-secondary hover:text-text-primary gap-1"
            title="Reload IDE Frame"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reload</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handlePopOut}
            className="h-7 text-xs gap-1"
            title="Open IDE in separate window"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Pop Out</span>
          </Button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 w-full overflow-hidden">
        {status === 'offline' ? (
          <div className="flex h-full w-full items-center justify-center p-6 bg-surface-primary">
            <div className="max-w-md rounded-xl border border-border-light bg-surface-primary-alt p-6 text-center shadow-lg">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-secondary text-amber-400">
                <Terminal className="h-6 w-6" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-text-primary">
                VScoder Server Offline
              </h3>
              <p className="mb-4 text-xs text-text-secondary">
                The IDE service is not responding on <code>{ideProxyUrl}</code>. Run the startup script to initialize the workspace:
              </p>
              <pre className="mb-4 rounded bg-surface-tertiary p-2 text-left font-mono text-[11px] text-text-primary overflow-x-auto">
                .\start-vscoder.ps1
              </pre>
              <Button size="sm" variant="default" onClick={checkHealth} className="w-full">
                Retry Connection
              </Button>
            </div>
          </div>
        ) : (
          <iframe
            key={nonce}
            src={iframeSrc}
            title="VibeStudio IDE"
            className="h-full w-full border-none"
            allow="clipboard-read; clipboard-write; fullscreen; cross-origin-isolated; storage-access; microphone; camera; display-capture; autoplay"
          />
        )}
      </div>
    </div>
  );
}
