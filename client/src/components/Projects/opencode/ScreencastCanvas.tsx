import React, { useEffect, useRef, useState } from 'react';
import { Button, Spinner } from '@librechat/client';
import {
  AlertCircle,
  Camera,
  Circle,
  ExternalLink,
  Maximize2,
  MousePointer,
  RotateCw,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuthContext } from '~/hooks';

interface ScreencastCanvasProps {
  projectId: string;
  inspectMode?: boolean;
  onElementSelect?: (selector: string, text?: string) => void;
  isRecording?: boolean;
  onToggleRecording?: () => void;
}

export default function ScreencastCanvas({
  projectId,
  inspectMode = false,
  onElementSelect,
  isRecording = true,
  onToggleRecording,
}: ScreencastCanvasProps) {
  const { token } = useAuthContext();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('about:blank');
  const [inputUrl, setInputUrl] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!projectId || !token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/opencode/${projectId}/browser/screencast?token=${encodeURIComponent(
      token,
    )}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'frame' && payload.data && canvasRef.current) {
          const img = new Image();
          img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
          };
          img.src = `data:image/jpeg;base64,${payload.data}`;
          if (payload.url) {
            setCurrentUrl(payload.url);
          }
        } else if (payload.type === 'status' && payload.url) {
          setCurrentUrl(payload.url);
        }
      } catch (err) {
        // ignore parse error
      }
    };

    return () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    };
  }, [projectId, token]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    if (inspectMode && onElementSelect) {
      onElementSelect(`body`, `Clicked at (${x}, ${y})`);
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'mouse_click',
          x,
          y,
          button: e.button === 2 ? 'right' : 'left',
        }),
      );
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (inspectMode) return;
    const { x, y } = getCanvasCoords(e);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'mouse_move',
          x,
          y,
        }),
      );
    }
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'mouse_wheel',
          deltaX: e.deltaX,
          deltaY: e.deltaY,
        }),
      );
    }
  };

  const handleNavigateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    let target = inputUrl.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = `https://${target}`;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'navigate',
          url: target,
        }),
      );
    }
    setInputUrl('');
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-neutral-950 text-white">
      {/* Remote Browser Navigation & Recording Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs">
        <form onSubmit={handleNavigateSubmit} className="flex min-w-[240px] flex-1 items-center gap-1.5">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder={currentUrl !== 'about:blank' ? currentUrl : 'Enter URL to navigate in remote browser...'}
            className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none"
          />
          <Button type="submit" size="sm" variant="default" className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-500">
            Go
          </Button>
        </form>

        <div className="flex items-center gap-2">
          {/* Default Screen Recording Indicator */}
          {isRecording ? (
            <button
              type="button"
              onClick={onToggleRecording}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-950/80 border border-red-700/60 px-2.5 py-0.5 text-[11px] font-medium text-red-300 hover:bg-red-900/60"
              title="Screen recording active (Studio Library auto-sync)"
            >
              <span className="size-2 rounded-full bg-red-500 animate-pulse" />
              <span>REC {formatDuration(recordingSeconds)}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleRecording}
              className="inline-flex items-center gap-1 rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-400 hover:text-white"
            >
              <Circle className="size-2 text-neutral-500" />
              <span>Record</span>
            </button>
          )}

          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              connected ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            <span className={`size-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-neutral-500'}`} />
            {connected ? 'Remote CDP Live' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <div className="relative flex flex-1 items-center justify-center overflow-auto bg-neutral-950 p-2">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onWheel={handleCanvasWheel}
          tabIndex={0}
          className={`max-h-full max-w-full rounded shadow-2xl border border-neutral-800 focus:outline-none ${
            inspectMode ? 'cursor-crosshair ring-2 ring-blue-500' : 'cursor-default'
          }`}
          style={{ objectFit: 'contain' }}
        />
        {!connected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950/80 backdrop-blur-xs text-neutral-300">
            <Spinner className="size-6 text-blue-500" />
            <p className="text-xs">Initializing Sandboxed Chromium Screencast...</p>
          </div>
        )}
      </div>
    </div>
  );
}
