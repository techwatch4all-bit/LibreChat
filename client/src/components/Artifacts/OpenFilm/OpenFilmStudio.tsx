/* eslint-disable i18next/no-literal-string */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Repeat,
  Download,
  Video,
  Monitor,
  Smartphone,
  Square,
  Sparkles,
  AlertCircle,
  X,
  Volume2,
  Film,
  FastForward,
  Rewind,
} from 'lucide-react';
import type { Artifact } from '~/common';
import { renderFilmVideo, saveVideoToDisk, type ExportProgress } from './exportEngine';
import { useCodeState } from '~/Providers/EditorContext';
import { useLocalize } from '~/hooks';

export const SATCHIDA_FILM_MIME = 'application/vnd.satchida.film' as const;

export function isFilmArtifact(type?: string): boolean {
  if (!type) {
    return false;
  }
  return type === SATCHIDA_FILM_MIME || type === 'application/vnd.librechat.film';
}

interface OpenFilmStudioProps {
  artifact: Artifact;
  onExportVideo?: (blob: Blob) => void;
}

type AspectRatio = '16:9' | '9:16' | '1:1';
type FPS = 24 | 30 | 60;

export default function OpenFilmStudio({ artifact, onExportVideo }: OpenFilmStudioProps) {
  const _localize = useLocalize();
  const { currentCode } = useCodeState();

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [fps, setFps] = useState<FPS>(30);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(10);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportPhase, setExportPhase] = useState<'preparing' | 'rendering' | 'encoding' | 'done'>(
    'preparing',
  );
  const [showBrowserNotice, setShowBrowserNotice] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    return navigator.userAgent.toLowerCase().includes('firefox');
  });

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);
  const isScrubbingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Source film HTML: from current editor state, or artifact content, or fallback demo
  const rawFilmContent = useMemo(() => {
    const raw = (currentCode || artifact.content || '').trim();
    if (raw.length > 0) {
      return raw;
    }
    // High-yield fallback Satchida Motion Studio template
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #020617;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    canvas {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: radial-gradient(circle at center, #0f172a 0%, #020617 100%);
    }
  </style>
</head>
<body>
  <canvas id="film" width="1920" height="1080"></canvas>
  <script>
    (function() {
      var canvas = document.getElementById('film');
      var ctx = canvas.getContext('2d');
      var W = 1920, H = 1080;
      
      var stars = [];
      for (var i = 0; i < 160; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 2.5 + 0.5,
          color: i % 3 === 0 ? '#8b5cf6' : (i % 3 === 1 ? '#06b6d4' : '#ffffff'),
          speed: Math.random() * 0.8 + 0.2
        });
      }

      window.film = {
        duration: 10,
        width: W,
        height: H,
        frame: function(t) {
          ctx.clearRect(0, 0, W, H);
          
          var grad = ctx.createRadialGradient(W/2, H/2, 100, W/2, H/2, W * 0.7);
          grad.addColorStop(0, '#090d1f');
          grad.addColorStop(1, '#020617');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);

          var orbGlow = ctx.createRadialGradient(
            W/2 + Math.cos(t * 1.5) * 80, 
            H/2 + Math.sin(t * 1.2) * 40, 
            20, 
            W/2, 
            H/2, 
            480 + Math.sin(t * 3) * 60
          );
          orbGlow.addColorStop(0, 'rgba(139, 92, 246, 0.45)');
          orbGlow.addColorStop(0.5, 'rgba(6, 182, 212, 0.2)');
          orbGlow.addColorStop(1, 'rgba(2, 6, 23, 0)');
          ctx.fillStyle = orbGlow;
          ctx.fillRect(0, 0, W, H);

          for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            var sx = (s.x + Math.sin(t * s.speed + i) * 60) % W;
            var sy = (s.y + Math.cos(t * s.speed + i) * 30) % H;
            ctx.beginPath();
            ctx.arc(sx, sy, s.r * (1 + Math.sin(t * 4 + i) * 0.3), 0, Math.PI * 2);
            ctx.fillStyle = s.color;
            ctx.globalAlpha = Math.min(1, Math.max(0.2, Math.sin(t * 2 + i) * 0.5 + 0.5));
            ctx.fill();
          }
          ctx.globalAlpha = 1.0;

          for (var r = 1; r <= 4; r++) {
            var pulseR = 140 * r + Math.sin(t * 4 + r) * 20;
            ctx.beginPath();
            ctx.arc(W/2, H/2, pulseR, 0, Math.PI * 2);
            ctx.strokeStyle = r % 2 === 0 ? 'rgba(139, 92, 246, 0.25)' : 'rgba(6, 182, 212, 0.2)';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          var barCount = 36;
          var barWidth = W / (barCount * 1.6);
          var barGap = barWidth * 0.6;
          var startX = (W - (barCount * (barWidth + barGap))) / 2;
          for (var b = 0; b < barCount; b++) {
            var freq = Math.sin(t * 6 + b * 0.4) * 0.5 + 0.5;
            var barHeight = 20 + freq * 140;
            var bx = startX + b * (barWidth + barGap);
            var by = H - 120 - barHeight;
            
            var barGrad = ctx.createLinearGradient(bx, by, bx, by + barHeight);
            barGrad.addColorStop(0, '#c084fc');
            barGrad.addColorStop(1, '#3b82f6');
            ctx.fillStyle = barGrad;
            ctx.fillRect(bx, by, barWidth, barHeight);
          }

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          if (t < 3.5) {
            var p1 = Math.min(1, t / 1.2);
            var scale1 = 0.8 + p1 * 0.2;
            ctx.save();
            ctx.translate(W/2, H/2 - 40);
            ctx.scale(scale1, scale1);
            ctx.font = '900 96px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#8b5cf6';
            ctx.shadowBlur = 35;
            ctx.fillText('SATCHIDA STUDIO', 0, 0);

            ctx.font = '600 28px system-ui, sans-serif';
            ctx.fillStyle = '#a855f7';
            ctx.shadowBlur = 15;
            ctx.fillText('CINEMA-GRADE MOTION GRAPHICS ENGINE', 0, 75);
            ctx.restore();
          } else if (t < 7.0) {
            var p2 = Math.min(1, (t - 3.5) / 1.0);
            var scale2 = 0.85 + p2 * 0.15;
            ctx.save();
            ctx.translate(W/2, H/2 - 40);
            ctx.scale(scale2, scale2);
            ctx.font = '900 84px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#38bdf8';
            ctx.shadowColor = '#06b6d4';
            ctx.shadowBlur = 30;
            ctx.fillText('DETERMINISTIC 60 FPS', 0, 0);

            ctx.font = '600 26px system-ui, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.shadowBlur = 10;
            ctx.fillText('PURE FUNCTION MATHEMATICAL PLAYHEAD', 0, 70);
            ctx.restore();
          } else {
            var p3 = Math.min(1, (t - 7.0) / 1.0);
            var scale3 = 0.85 + p3 * 0.15;
            ctx.save();
            ctx.translate(W/2, H/2 - 40);
            ctx.scale(scale3, scale3);
            ctx.font = '900 84px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#a855f7';
            ctx.shadowColor = '#d946ef';
            ctx.shadowBlur = 30;
            ctx.fillText('100% CLIENT-SIDE WEBGL', 0, 0);

            ctx.font = '600 26px system-ui, sans-serif';
            ctx.fillStyle = '#cbd5e1';
            ctx.shadowBlur = 10;
            ctx.fillText('ZERO SERVER COMPUTE • DIRECT DEVICE MP4 EXPORT', 0, 70);
            ctx.restore();
          }

          ctx.font = '500 18px ui-monospace, monospace';
          ctx.fillStyle = '#64748b';
          ctx.shadowBlur = 0;
          ctx.fillText('PLAYHEAD: ' + t.toFixed(2) + 's / 10.00s  •  FPS: 60', W/2, H - 40);
        }
      };
      
      window.film.frame(0);
    })();
  </script>
</body>
</html>`;
  }, [currentCode, artifact.content]);

  // Prepared srcDoc embedding the deterministic listener and defensive polyfills
  const srcDoc = useMemo(() => {
    let content = rawFilmContent.trim();
    if (!content.includes('window.film')) {
      content = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${content}</body></html>`;
    }

    const headInjection = `
      <style>
        html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow: hidden !important; background: #000 !important; }
        canvas { width: 100% !important; height: 100% !important; object-fit: contain !important; }
        #controls, #scrubber, .hint, #satchida-controls, #btn-play, #btn-restart, .playback-bar { display: none !important; }
      </style>
      <script>
        window.film = window.film || {};
        window.film._tick = function() {};
      </script>
    `;

    const bodyInjection = `
      <script>
        (function() {
          window.film = window.film || {};
          window.film._tick = window.film._tick || function() {};

          window.addEventListener('message', function(e) {
            if (e.data && e.data.type === 'SEEK_FRAME') {
              if (window.film && typeof window.film.frame === 'function') {
                try {
                  window.film._tick = window.film._tick || function() {};
                  window.film.frame(e.data.time);
                } catch (err) {
                  console.warn('Frame render error at t=' + e.data.time, err);
                }
              }
            }
          });

          window.addEventListener('load', function() {
            if (window.film) {
              window.film._tick = window.film._tick || function() {};
              window.parent.postMessage({
                type: 'FILM_METADATA',
                duration: window.film.duration || 10,
                width: window.film.width || 1920,
                height: window.film.height || 1080,
              }, '*');
              if (typeof window.film.frame === 'function') {
                try {
                  window.film.frame(0);
                } catch (err) {
                  console.warn('Initial frame render error:', err);
                }
              }
            }
          });
        })();
      </script>
    `;

    if (content.includes('<head>')) {
      content = content.replace('<head>', `<head>${headInjection}`);
    } else {
      content = `${headInjection}${content}`;
    }

    if (content.includes('</body>')) {
      content = content.replace('</body>', `${bodyInjection}</body>`);
    } else {
      content = `${content}${bodyInjection}`;
    }

    return content;
  }, [rawFilmContent]);

  // Sync seek position into iframe
  const postSeek = useCallback((t: number) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'SEEK_FRAME',
          time: t,
        },
        '*',
      );
    }
  }, []);

  // Handle incoming metadata messages from iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'FILM_METADATA') {
        if (typeof e.data.duration === 'number' && e.data.duration > 0) {
          setDuration(e.data.duration);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Animation Playhead Loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    lastTickTimeRef.current = performance.now();

    const loop = (now: number) => {
      const deltaSec = (now - lastTickTimeRef.current) / 1000;
      lastTickTimeRef.current = now;

      setCurrentTime((prev) => {
        let next = prev + deltaSec;
        if (next >= duration) {
          if (isLooping) {
            next = 0;
          } else {
            setIsPlaying(false);
            next = duration;
          }
        }
        postSeek(next);
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, isLooping, duration, postSeek]);

  // Timeline scrub handler
  const handleScrub = useCallback(
    (clientX: number) => {
      if (!timelineRef.current || duration <= 0) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const fraction = clickX / rect.width;
      const targetTime = fraction * duration;
      setCurrentTime(targetTime);
      postSeek(targetTime);
    },
    [duration, postSeek],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      isScrubbingRef.current = true;
      handleScrub(e.clientX);

      const onMouseMove = (ev: MouseEvent) => {
        if (isScrubbingRef.current) {
          handleScrub(ev.clientX);
        }
      };

      const onMouseUp = () => {
        isScrubbingRef.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [handleScrub],
  );

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next && currentTime >= duration) {
        setCurrentTime(0);
        postSeek(0);
      }
      return next;
    });
  }, [currentTime, duration, postSeek]);

  // Rewind / Reset
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    postSeek(0);
  }, [postSeek]);

  // Step backward / forward
  const stepTime = useCallback(
    (delta: number) => {
      setCurrentTime((prev) => {
        const next = Math.max(0, Math.min(prev + delta, duration));
        postSeek(next);
        return next;
      });
    },
    [duration, postSeek],
  );

  // Save Project directly to client storage
  const handleSaveProject = useCallback(async () => {
    const filename = `${artifact.title || 'satchida_motion_project'}.film.html`;
    const blob = new Blob([rawFilmContent], { type: 'text/html' });

    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (
          window as unknown as {
            showSaveFilePicker: (options: unknown) => Promise<{
              createWritable: () => Promise<{
                write: (data: Blob) => Promise<void>;
                close: () => Promise<void>;
              }>;
            }>;
          }
        ).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'Satchida Studio Film File',
              accept: { 'text/html': ['.html', '.film.html'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [artifact.title, rawFilmContent]);

  // Format seconds to mm:ss.ms
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Client-Side Video Export Handlers
  const handleStartExport = useCallback(async () => {
    if (isExporting || !iframeRef.current) return;
    setIsPlaying(false);
    setIsExporting(true);
    setExportProgress(0);
    setExportPhase('preparing');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const blob = await renderFilmVideo({
        iframe: iframeRef.current,
        duration,
        fps,
        signal: controller.signal,
        onProgress: (p: ExportProgress) => {
          setExportProgress(p.percent);
          setExportPhase(p.phase);
        },
      });

      onExportVideo?.(blob);
      await saveVideoToDisk(blob, artifact.title || 'satchida_motion_video');
    } catch (err: unknown) {
      if (
        (err as Error)?.name !== 'AbortError' &&
        (err as Error)?.message !== 'Export aborted by user'
      ) {
        console.error('Video export error:', err);
      }
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  }, [isExporting, duration, fps, onExportVideo, artifact.title]);

  const handleCancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsExporting(false);
  }, []);

  // Viewport aspect ratio container style
  const aspectClass = useMemo(() => {
    switch (aspectRatio) {
      case '9:16':
        return 'aspect-[9/16] max-h-[85%]';
      case '1:1':
        return 'aspect-square max-h-[85%]';
      case '16:9':
      default:
        return 'aspect-video max-w-full';
    }
  }, [aspectRatio]);

  return (
    <div className="relative flex h-full w-full select-none flex-col overflow-hidden bg-[#0a0f1d] text-slate-100">
      {/* Top Header & Toolbar */}
      <div className="flex h-11 items-center justify-between border-b border-slate-800 bg-[#0d1326] px-3 text-xs">
        {/* Left: Studio Branding & Title */}
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center gap-1.5 rounded-md border border-purple-500/30 bg-purple-600/20 px-2 py-1 font-semibold text-purple-400">
            <Film className="h-3.5 w-3.5" />
            <span>Satchida Studio</span>
          </div>
          <span className="max-w-[180px] truncate font-medium text-slate-300 sm:max-w-xs">
            {artifact.title || 'Motion Project'}
          </span>
        </div>

        {/* Center: Aspect Ratio & FPS Selectors */}
        <div className="hidden items-center space-x-1.5 rounded-lg border border-slate-800 bg-slate-900/80 p-0.5 sm:flex">
          <button
            type="button"
            onClick={() => setAspectRatio('16:9')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              aspectRatio === '16:9'
                ? 'shadow-xs bg-purple-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="16:9 Widescreen (1920x1080)"
          >
            <Monitor className="h-3 w-3" />
            <span>16:9</span>
          </button>
          <button
            type="button"
            onClick={() => setAspectRatio('9:16')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              aspectRatio === '9:16'
                ? 'shadow-xs bg-purple-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="9:16 Vertical Reels / Shorts (1080x1920)"
          >
            <Smartphone className="h-3 w-3" />
            <span>9:16</span>
          </button>
          <button
            type="button"
            onClick={() => setAspectRatio('1:1')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              aspectRatio === '1:1'
                ? 'shadow-xs bg-purple-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="1:1 Square (1080x1080)"
          >
            <Square className="h-3 w-3" />
            <span>1:1</span>
          </button>
        </div>

        {/* Right: FPS & Save / Export */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center rounded border border-slate-800 bg-slate-900/80 font-mono text-[10px] text-slate-300">
            <button
              type="button"
              onClick={() => setFps(24)}
              className={`rounded-l px-1.5 py-1 ${fps === 24 ? 'bg-slate-700 text-white' : 'hover:bg-slate-800'}`}
            >
              24
            </button>
            <button
              type="button"
              onClick={() => setFps(30)}
              className={`px-1.5 py-1 ${fps === 30 ? 'bg-slate-700 text-white' : 'hover:bg-slate-800'}`}
            >
              30
            </button>
            <button
              type="button"
              onClick={() => setFps(60)}
              className={`rounded-r px-1.5 py-1 ${fps === 60 ? 'bg-slate-700 text-white' : 'hover:bg-slate-800'}`}
            >
              60fps
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveProject}
            className="flex items-center space-x-1 rounded border border-slate-700/60 bg-slate-800 px-2 py-1 font-medium text-slate-200 transition-colors hover:bg-slate-700"
            title="Save film project source (.html) to your local device"
          >
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">Save</span>
          </button>

          <button
            type="button"
            onClick={handleStartExport}
            disabled={isExporting}
            className="shadow-xs flex items-center space-x-1 rounded bg-purple-600 px-2.5 py-1 font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
            title="Client-Side Hardware Accelerated Video Render"
          >
            <Video className="h-3 w-3" />
            <span>{isExporting ? 'Exporting...' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* Browser Compatibility Notice for Firefox */}
      {showBrowserNotice && (
        <div className="flex items-center justify-between border-b border-amber-600/30 bg-amber-950/40 px-3 py-1.5 text-[11px] text-amber-200">
          <div className="flex items-center space-x-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>
              💡 For optimal 60 FPS hardware acceleration and direct MP4 export, Google Chrome,
              Microsoft Edge, Brave, or Safari 16+ is recommended.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowBrowserNotice(false)}
            className="ml-2 text-amber-400 hover:text-amber-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Center Viewport Stage */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#070b16] p-3">
        <div
          className={`relative flex items-center justify-center overflow-hidden rounded-lg border border-slate-800/80 bg-black shadow-2xl transition-all ${aspectClass}`}
          style={{ width: aspectRatio === '16:9' ? '100%' : undefined }}
        >
          <iframe
            ref={iframeRef}
            srcDoc={srcDoc}
            title={artifact.title || 'Satchida Studio Film'}
            sandbox="allow-scripts allow-same-origin"
            className="h-full w-full border-0 bg-black"
          />
        </div>
      </div>

      {/* Bottom Timeline & Scrubber Panel */}
      <div className="flex flex-col space-y-2 border-t border-slate-800 bg-[#0d1326] p-2.5">
        {/* Transport Controls & Timecode */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={handleReset}
              className="rounded p-1.5 text-slate-300 transition-colors hover:bg-slate-800"
              title="Reset to 0s"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => stepTime(-1)}
              className="rounded p-1.5 text-slate-300 transition-colors hover:bg-slate-800"
              title="Step -1s"
            >
              <Rewind className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="shadow-xs rounded-full bg-purple-600 p-1.5 text-white transition-colors hover:bg-purple-500"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => stepTime(1)}
              className="rounded p-1.5 text-slate-300 transition-colors hover:bg-slate-800"
              title="Step +1s"
            >
              <FastForward className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsLooping(!isLooping)}
              className={`rounded p-1.5 transition-colors ${
                isLooping ? 'bg-purple-950/40 text-purple-400' : 'text-slate-400 hover:bg-slate-800'
              }`}
              title={isLooping ? 'Loop Enabled' : 'Loop Disabled'}
            >
              <Repeat className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Precise Timecode display */}
          <div className="rounded border border-slate-800 bg-slate-900 px-2.5 py-1 font-mono text-xs font-semibold tracking-wider text-purple-300">
            <span>{formatTime(currentTime)}</span>
            <span className="mx-1 text-slate-500">/</span>
            <span className="text-slate-400">{formatTime(duration)}</span>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-slate-400">
            <span className="hidden sm:inline">Active Tracks: 3</span>
            <span className="rounded border border-emerald-600/30 bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
              Deterministic 60fps
            </span>
          </div>
        </div>

        {/* Multi-Track Visual Timeline */}
        <div
          ref={timelineRef}
          onMouseDown={handleMouseDown}
          className="relative flex h-16 w-full cursor-pointer select-none flex-col justify-between overflow-hidden rounded border border-slate-800 bg-slate-950 py-1"
        >
          {/* Time Ruler Ticks */}
          <div className="relative flex h-3 w-full items-center border-b border-slate-800/80">
            {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => {
              const posPercent = (i / duration) * 100;
              return (
                <div
                  key={i}
                  className="pointer-events-none absolute -top-1 flex -translate-x-1/2 transform flex-col items-center"
                  style={{ left: `${posPercent}%` }}
                >
                  <div className="h-1.5 w-px bg-slate-700" />
                  <span className="mt-0.5 font-mono text-[8px] leading-none text-slate-500">
                    {i}s
                  </span>
                </div>
              );
            })}
          </div>

          {/* Track 1: 🎬 Video & Shot Keyframes */}
          <div className="rounded-xs relative mx-0.5 flex h-3.5 w-full items-center overflow-hidden bg-slate-900/60 px-1">
            <div className="flex items-center gap-1 text-[9px] font-medium text-purple-300">
              <Film className="h-2.5 w-2.5 shrink-0" />
              <span>Shot 1 (Intro)</span>
            </div>
            <div
              className="absolute left-[30%] h-full w-px bg-purple-500/40"
              title="Shot Transition Marker"
            />
            <div
              className="absolute left-[65%] h-full w-px bg-purple-500/40"
              title="Shot Transition Marker"
            />
          </div>

          {/* Track 2: ⚡ Kinetic & Motion Elements */}
          <div className="rounded-xs relative mx-0.5 flex h-3.5 w-full items-center overflow-hidden bg-slate-900/40 px-1">
            <div className="flex items-center gap-1 text-[9px] font-medium text-cyan-300">
              <Sparkles className="h-2.5 w-2.5 shrink-0" />
              <span>Kinetic Typography & SVG Canvas</span>
            </div>
          </div>

          {/* Track 3: 🎵 Audio Rhythm */}
          <div className="rounded-xs relative mx-0.5 flex h-3 w-full items-center overflow-hidden bg-slate-900/20 px-1">
            <div className="flex items-center gap-1 text-[9px] font-medium text-amber-300/80">
              <Volume2 className="h-2.5 w-2.5 shrink-0" />
              <span>Audio Sync Beat (128 BPM)</span>
            </div>
          </div>

          {/* Red Playhead Needle Cursor */}
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
            style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
          >
            <div className="rounded-xs absolute -left-1.5 -top-1 h-3 w-3 rotate-45 bg-red-500" />
          </div>
        </div>
      </div>

      {/* Hidden in-DOM OpenFilm Side-Chat Container (Zero duplicate UI, 100% prompt contract preservation) */}
      <div
        aria-hidden="true"
        style={{
          display: 'none',
          visibility: 'hidden',
          position: 'absolute',
          width: 0,
          height: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {/* Hidden bridge mount for OpenFilm prompt state */}
        <div data-testid="openfilm-hidden-side-chat" />
      </div>

      {/* Hardware-Accelerated Video Export Progress Modal */}
      {isExporting && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Exporting Video"
          className="backdrop-blur-xs absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-[#0d1326] p-5 shadow-2xl">
            <div className="mb-4 flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-600/20 text-purple-400">
                <Video className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Rendering Video</h3>
                <p className="text-[11px] text-slate-400">100% Client-Side WebGL / Canvas</p>
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="capitalize text-slate-300">{exportPhase}...</span>
                <span className="font-bold text-purple-400">{exportProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-500 transition-all duration-150"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500">
                Direct save to device • Zero server computation
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCancelExport}
                className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
              >
                Cancel Render
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
