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
  VolumeX,
  Film,
  FastForward,
  Rewind,
  Sliders,
  Layers,
  Wand2,
  Send,
  Check,
} from 'lucide-react';
import { useToastContext } from '@librechat/client';
import { mainTextareaId } from '~/common';
import type { Artifact } from '~/common';
import { renderFilmVideo, saveVideoToDisk, type ExportProgress } from './exportEngine';
import { useCodeState } from '~/Providers/EditorContext';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';

export const SATCHIDA_FILM_MIME = 'application/vnd.satchida.film' as const;

export function isFilmArtifact(type?: string, content?: string): boolean {
  if (!type) {
    return false;
  }
  if (
    type === SATCHIDA_FILM_MIME ||
    type === 'application/vnd.librechat.film' ||
    type === 'film' ||
    type === 'video'
  ) {
    return true;
  }
  if (
    content &&
    (content.includes('window.film') ||
      content.includes('<section data-track=') ||
      content.includes('data-openfilm'))
  ) {
    return true;
  }
  return false;
}

interface OpenFilmStudioProps {
  artifact: Artifact;
  onExportVideo?: (blob: Blob) => void;
}

type AspectRatio = '16:9' | '9:16' | '1:1';
type FPS = 24 | 30 | 60;

export default function OpenFilmStudio({ artifact, onExportVideo }: OpenFilmStudioProps) {
  const _localize = useLocalize();
  let currentCode: string | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const codeCtx = useCodeState();
    currentCode = codeCtx.currentCode;
  } catch {
    currentCode = undefined;
  }
  const { token } = useAuthContext();

  const [activeTab, setActiveTab] = useState<'workbench' | 'preview'>('workbench');
  const [studioUrl, setStudioUrl] = useState<string>(
    `/projects/PQhJ7O71SYVE?key=8708e7f0687fe2db0e26f9681d67f57307b1beeee7d50921${token ? `&token=${encodeURIComponent(token)}` : ''}`
  );
  const [isStudioLoading, setIsStudioLoading] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [fps, setFps] = useState<FPS>(30);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(10);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportPhase, setExportPhase] = useState<'preparing' | 'rendering' | 'encoding' | 'done'>(
    'preparing',
  );
  const [showBrowserNotice, setShowBrowserNotice] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    return navigator.userAgent.toLowerCase().includes('firefox');
  });
  const { showToast } = useToastContext();
  const [suggestedPrompt, setSuggestedPrompt] = useState<{ effectName: string; prompt: string } | null>(null);

  // Sync OpenFilm project with the backend proxy based on the artifact
  useEffect(() => {
    let isMounted = true;
    const syncProject = async () => {
      try {
        setIsStudioLoading(true);
        // Derive project name and media from artifact title / content / id
        const rawContent = (currentCode || artifact.content || '').trim();
        const baseTitle = (artifact.title || 'FilmProject')
          .replace(/[^a-zA-Z0-9_-]/g, '')
          .slice(0, 24) || 'FilmProject';
        const idSuffix = (artifact.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(-8);
        const cleanTitle = idSuffix ? `${baseTitle}_${idSuffix}` : baseTitle;
        
        let mediaParam = '';
        const matchMedia = rawContent.match(/src=["']([^"']+\.(?:mp4|webm))["']/i) ||
          rawContent.match(/(?:https?:\/\/[^\s"'<>]+|\/[^\s"'<>]+)(?:\.(?:mp4|webm))/i) ||
          rawContent.match(/([a-zA-Z0-9_\-]+\.(?:mp4|webm))/i);
        if (matchMedia && matchMedia[1]) {
          mediaParam = `&media=${encodeURIComponent(matchMedia[1])}`;
        } else if (matchMedia && matchMedia[0]) {
          mediaParam = `&media=${encodeURIComponent(matchMedia[0])}`;
        }
        
        const url = `/api/openfilm/project-sync?name=${encodeURIComponent(cleanTitle)}${mediaParam}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (isMounted && data.studioUrl) {
          const fullStudioUrl = `${data.studioUrl}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
          setStudioUrl(fullStudioUrl);
        }
      } catch (err) {
        // Fallback to default DawnValley project if sync fails
        if (isMounted) {
          setStudioUrl(`/projects/PQhJ7O71SYVE?key=8708e7f0687fe2db0e26f9681d67f57307b1beeee7d50921${token ? `&token=${encodeURIComponent(token)}` : ''}`);
        }
      } finally {
        if (isMounted) {
          setIsStudioLoading(false);
        }
      }
    };
    syncProject();
    return () => {
      isMounted = false;
    };
  }, [artifact.id, artifact.title, artifact.content, currentCode, token]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);
  const isScrubbingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Source film HTML: from current editor state, or artifact content, or fallback demo
  const rawFilmContent = useMemo(() => {
    const raw = (currentCode || artifact.content || '').trim();
    if (
      raw.length > 0 &&
      (raw.includes('</script>') || raw.includes('</html>')) &&
      (raw.includes('window.film') ||
        raw.includes('requestAnimationFrame') ||
        raw.includes('renderer.render'))
    ) {
      return raw;
    }

    // Direct video element playback if the artifact points to an mp4/webm URL
    const videoMatch = raw.match(/src=["']([^"']+\.(?:mp4|webm))["']/i);
    const videoUrl =
      (videoMatch && videoMatch[1]) ||
      raw.match(/https?:\/\/[^\s"'<>]+(?:\.(?:mp4|webm))/i)?.[0] ||
      raw.match(/\/[^\s"'<>]+\.(?:mp4|webm)/i)?.[0] ||
      raw.match(/[a-zA-Z0-9_\-]+\.(?:mp4|webm)/i)?.[0];

    if (videoUrl) {
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
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <video id="studio-video" src="${videoUrl}" preload="auto" playsinline></video>
  <script>
    (function() {
      var v = document.getElementById('studio-video');
      window.film = {
        duration: 10,
        width: 1920,
        height: 1080,
        frame: function(t) {
          if (v && !isNaN(v.duration) && v.duration > 0) {
            v.currentTime = Math.min(v.duration, Math.max(0, t));
          }
        },
        setMuted: function(m) {
          if (v) v.muted = m;
        }
      };
      v.addEventListener('loadedmetadata', function() {
        if (v.duration && !isNaN(v.duration)) {
          window.film.duration = v.duration;
          window.parent.postMessage({
            type: 'FILM_METADATA',
            duration: v.duration,
            width: v.videoWidth || 1920,
            height: v.videoHeight || 1080
          }, '*');
        }
      });
    })();
  </script>
</body>
</html>`;
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
      var W = 1920, H = 1080, DURATION = 10;

      // Pre-generate starfield
      var stars = [];
      for (var i = 0; i < 450; i++) {
        stars.push({
          x: (Math.sin(i * 997.1) * 0.5 + 0.5) * W,
          y: (Math.cos(i * 613.7) * 0.5 + 0.5) * H,
          r: (i % 7 === 0) ? 2.2 : ((i % 3 === 0) ? 1.4 : 0.8),
          alpha: (i % 5 === 0) ? 0.9 : 0.5,
          hue: (i % 4 === 0) ? '210' : ((i % 6 === 0) ? '40' : '0')
        });
      }

      // Procedural continents map
      var mapCanvas = document.createElement('canvas');
      mapCanvas.width = 1024;
      mapCanvas.height = 512;
      var mctx = mapCanvas.getContext('2d');
      mctx.fillStyle = '#0a192f';
      mctx.fillRect(0, 0, 1024, 512);

      mctx.fillStyle = '#1e3a2f';
      function drawLand(cx, cy, rx, ry, seed) {
        mctx.beginPath();
        for (var a = 0; a < Math.PI * 2; a += 0.1) {
          var r = 1 + Math.sin(a * 4 + seed) * 0.25 + Math.cos(a * 7 - seed) * 0.15;
          var x = cx + Math.cos(a) * rx * r;
          var y = cy + Math.sin(a) * ry * r;
          if (a === 0) mctx.moveTo(x, y); else mctx.lineTo(x, y);
        }
        mctx.closePath();
        mctx.fill();
      }
      drawLand(280, 180, 120, 80, 1.2);
      drawLand(360, 340, 70, 110, 2.4);
      drawLand(520, 210, 90, 80, 3.1);
      drawLand(540, 320, 90, 100, 4.5);
      drawLand(720, 200, 170, 100, 5.7);
      drawLand(800, 370, 70, 50, 6.2);

      // Night city lights
      var nightCanvas = document.createElement('canvas');
      nightCanvas.width = 1024;
      nightCanvas.height = 512;
      var nctx = nightCanvas.getContext('2d');
      nctx.fillStyle = '#000000';
      nctx.fillRect(0, 0, 1024, 512);
      nctx.fillStyle = '#fbbf24';
      for (var ni = 0; ni < 300; ni++) {
        var lx = (Math.sin(ni * 43.1) * 0.5 + 0.5) * 1024;
        var ly = (Math.cos(ni * 89.7) * 0.5 + 0.5) * 512;
        var p = mctx.getImageData(lx | 0, ly | 0, 1, 1).data;
        if (p[1] > 35) {
          nctx.beginPath();
          nctx.arc(lx, ly, Math.random() * 1.5 + 0.5, 0, Math.PI * 2);
          nctx.fill();
        }
      }

      window.film = {
        duration: DURATION,
        width: W,
        height: H,
        frame: function(t) {
          t = Math.max(0, Math.min(DURATION, t));
          ctx.clearRect(0, 0, W, H);

          // Deep cosmic void
          var nebulaGrad = ctx.createRadialGradient(W * 0.3, H * 0.4, 100, W * 0.5, H * 0.5, W * 0.8);
          nebulaGrad.addColorStop(0, '#0d091a');
          nebulaGrad.addColorStop(0.5, '#050814');
          nebulaGrad.addColorStop(1, '#000002');
          ctx.fillStyle = nebulaGrad;
          ctx.fillRect(0, 0, W, H);

          var camPanX = (t / DURATION) * 80;
          var camPanY = Math.sin((t / DURATION) * Math.PI) * 40;

          // Parallax Stars
          for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            var sx = (s.x - camPanX * (s.r * 0.3) + W) % W;
            var sy = (s.y - camPanY * (s.r * 0.3) + H) % H;
            var twinkle = s.alpha * (0.8 + Math.sin(t * 3 + i) * 0.2);
            ctx.fillStyle = s.hue === '0' ? 'rgba(255,255,255,' + twinkle + ')' :
                            (s.hue === '210' ? 'rgba(186,230,253,' + twinkle + ')' : 'rgba(254,240,138,' + twinkle + ')');
            ctx.beginPath();
            ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
            ctx.fill();
          }

          // Moon
          var moonP = t / DURATION;
          var moonX = W * 0.15 + moonP * 60;
          var moonY = H * 0.28 - moonP * 20;
          var moonR = 34;
          var moonGrad = ctx.createRadialGradient(moonX - moonR * 0.3, moonY - moonR * 0.3, 4, moonX, moonY, moonR);
          moonGrad.addColorStop(0, '#e2e8f0');
          moonGrad.addColorStop(0.7, '#94a3b8');
          moonGrad.addColorStop(1, '#475569');
          ctx.save();
          ctx.beginPath();
          ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
          ctx.fillStyle = moonGrad;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(moonX + 10, moonY - 5, moonR * 0.95, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(2, 6, 23, 0.75)';
          ctx.fill();
          ctx.restore();

          // Camera trajectory
          var earthX, earthY, earthR, sunX, sunY, sunIntensity;
          if (t < 3.5) {
            var p1 = t / 3.5;
            earthX = W * 0.55 - p1 * 40;
            earthY = H * 0.85 + (1 - p1) * 80;
            earthR = 520 + p1 * 30;
            sunX = earthX - earthR * 0.7;
            sunY = earthY - earthR * 0.75;
            sunIntensity = Math.max(0, (p1 - 0.5) * 2);
          } else if (t < 7.0) {
            var p2 = (t - 3.5) / 3.5;
            earthX = W * 0.51 - p2 * 30;
            earthY = H * 0.85;
            earthR = 550 - p2 * 20;
            sunX = earthX - earthR * 0.72 + p2 * 40;
            sunY = earthY - earthR * 0.76 - p2 * 30;
            sunIntensity = 1.0;
          } else {
            var p3 = (t - 7.0) / 3.0;
            earthX = W * 0.48 - p3 * 50;
            earthY = H * 0.85 + p3 * 40;
            earthR = 530 - p3 * 70;
            sunX = earthX - earthR * 0.70 + 40;
            sunY = earthY - earthR * 0.78 - 30;
            sunIntensity = 1.0 - p3 * 0.15;
          }

          // 1. Sun & Solar Flare
          if (sunIntensity > 0.05) {
            var flareAlpha = Math.min(1, sunIntensity);
            var corona = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 400);
            corona.addColorStop(0, 'rgba(255, 255, 255, ' + flareAlpha + ')');
            corona.addColorStop(0.15, 'rgba(254, 240, 138, ' + (flareAlpha * 0.8) + ')');
            corona.addColorStop(0.4, 'rgba(251, 146, 60, ' + (flareAlpha * 0.4) + ')');
            corona.addColorStop(0.7, 'rgba(147, 51, 234, ' + (flareAlpha * 0.15) + ')');
            corona.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = corona;
            ctx.beginPath();
            ctx.arc(sunX, sunY, 400, 0, Math.PI * 2);
            ctx.fill();

            // Anamorphic horizontal lens flare streak
            var streakGrad = ctx.createLinearGradient(sunX - 700, sunY, sunX + 700, sunY);
            streakGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
            streakGrad.addColorStop(0.35, 'rgba(56, 189, 248, ' + (flareAlpha * 0.4) + ')');
            streakGrad.addColorStop(0.5, 'rgba(255, 255, 255, ' + (flareAlpha * 0.9) + ')');
            streakGrad.addColorStop(0.65, 'rgba(56, 189, 248, ' + (flareAlpha * 0.4) + ')');
            streakGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
            ctx.fillStyle = streakGrad;
            ctx.fillRect(sunX - 700, sunY - 4, 1400, 8);

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
            ctx.fill();
          }

          // 2. Earth Globe
          ctx.save();
          ctx.beginPath();
          ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
          ctx.clip();

          var rotSpeed = 0.04;
          var rotOffset = (t * rotSpeed * 1024) % 1024;
          ctx.drawImage(mapCanvas, rotOffset, 0, 1024 - rotOffset, 512, earthX - earthR, earthY - earthR, earthR * 2 * ((1024 - rotOffset) / 1024), earthR * 2);
          if (rotOffset > 0) {
            ctx.drawImage(mapCanvas, 0, 0, rotOffset, 512, earthX - earthR + earthR * 2 * ((1024 - rotOffset) / 1024), earthY - earthR, earthR * 2 * (rotOffset / 1024), earthR * 2);
          }

          // Clouds
          ctx.save();
          ctx.globalAlpha = 0.55;
          for (var c = 0; c < 8; c++) {
            var cy = earthY - earthR * 0.7 + c * (earthR * 1.4 / 8);
            ctx.beginPath();
            ctx.ellipse(earthX, cy, earthR * 0.95, 24 + Math.sin(t + c) * 6, 0, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 18;
            ctx.stroke();
          }
          ctx.restore();

          // Terminator Shadow
          var shadowGrad = ctx.createRadialGradient(
            sunX, sunY, earthR * 0.2,
            earthX + earthR * 0.4, earthY + earthR * 0.4, earthR * 1.3
          );
          shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          shadowGrad.addColorStop(0.48, 'rgba(0, 0, 0, 0.15)');
          shadowGrad.addColorStop(0.65, 'rgba(2, 6, 23, 0.85)');
          shadowGrad.addColorStop(0.85, 'rgba(1, 3, 12, 0.98)');
          shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 1.0)');
          ctx.fillStyle = shadowGrad;
          ctx.fillRect(earthX - earthR, earthY - earthR, earthR * 2, earthR * 2);

          // Night city lights
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = 0.75 * (1 - sunIntensity * 0.5);
          ctx.drawImage(nightCanvas, rotOffset, 0, 1024 - rotOffset, 512, earthX - earthR, earthY - earthR, earthR * 2 * ((1024 - rotOffset) / 1024), earthR * 2);
          ctx.restore();

          ctx.restore(); // end earth clip

          // 3. Atmospheric Rayleigh Scattering Glow (Outer Limb)
          var atmoGrad = ctx.createRadialGradient(earthX, earthY, earthR - 4, earthX, earthY, earthR + 42);
          atmoGrad.addColorStop(0, 'rgba(56, 189, 248, 0.8)');
          atmoGrad.addColorStop(0.2, 'rgba(56, 189, 248, 0.5)');
          atmoGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.25)');
          atmoGrad.addColorStop(0.8, 'rgba(147, 51, 234, 0.08)');
          atmoGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.save();
          ctx.beginPath();
          ctx.arc(earthX, earthY, earthR + 42, 0, Math.PI * 2);
          ctx.arc(earthX, earthY, earthR - 2, Math.PI * 2, 0, true);
          ctx.fillStyle = atmoGrad;
          ctx.fill();
          ctx.restore();

          // 4. Horizon Rim Specular Light
          if (sunIntensity > 0.1) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(earthX, earthY, earthR + 2, Math.PI * 1.15, Math.PI * 1.55);
            ctx.strokeStyle = 'rgba(255, 255, 255, ' + (sunIntensity * 0.95) + ')';
            ctx.lineWidth = 6;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 25;
            ctx.stroke();
            ctx.restore();
          }

          // 5. Cinematic 2.39:1 Anamorphic Letterboxing
          var letterboxHeight = (H - (W / 2.39)) / 2;
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, W, letterboxHeight);
          ctx.fillRect(0, H - letterboxHeight, W, letterboxHeight);

          // 6. Optical Vignette
          var vigGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.7);
          vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
          ctx.fillStyle = vigGrad;
          ctx.fillRect(0, 0, W, H);
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
        #controls, #scrubber, .hint, #satchida-controls, #btn-play, #btn-restart, .playback-bar, #veil, #hud, #bar { display: none !important; }
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
            } else if (e.data && e.data.type === 'AUDIO_MUTE') {
              if (window.film && typeof window.film.setMuted === 'function') {
                try {
                  window.film.setMuted(e.data.muted);
                } catch (err) {
                  console.warn('Audio mute error:', err);
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

  const applyPromptToChatTextarea = useCallback((prompt: string, shouldFocus = false) => {
    const textarea = document.getElementById(mainTextareaId) as HTMLTextAreaElement | null;
    if (!textarea) {
      return;
    }
    const currentVal = (textarea.value || '').trim();
    let nextVal = currentVal;
    if (!currentVal) {
      nextVal = prompt;
    } else if (!currentVal.toLowerCase().includes(prompt.toLowerCase())) {
      const lowered = `${prompt.charAt(0).toLowerCase()}${prompt.slice(1)}`;
      nextVal = currentVal.endsWith('.')
        ? `${currentVal} Also, ${lowered}`
        : `${currentVal}. In addition, ${lowered}`;
    }
    if (nextVal !== textarea.value) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(textarea, nextVal);
      } else {
        textarea.value = nextVal;
      }
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (shouldFocus) {
      textarea.focus();
    }
  }, []);

  // Handle incoming metadata messages from iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'FILM_METADATA') {
        if (typeof e.data.duration === 'number' && e.data.duration > 0) {
          setDuration(e.data.duration);
        }
      } else if (e.data && e.data.type === 'OPENFILM_STUDIO_SUGGEST_PROMPT') {
        const { effectName, prompt } = e.data;
        if (prompt) {
          setSuggestedPrompt({ effectName: effectName || 'Effect', prompt });
          applyPromptToChatTextarea(prompt, false);
          if (showToast) {
            showToast({
              message: `Layered ${effectName || 'effect'} into chat prompt!`,
              status: 'info',
            });
          }
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [applyPromptToChatTextarea, showToast]);

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
        {/* Left: Studio Branding, Title & Mode Tabs */}
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center gap-1.5 rounded-md border border-purple-500/30 bg-purple-600/20 px-2 py-1 font-semibold text-purple-400">
            <Film className="h-3.5 w-3.5" />
            <span>OpenFilm Studio</span>
          </div>
          <span className="hidden max-w-[140px] truncate font-medium text-slate-300 md:inline sm:max-w-xs">
            {artifact.title || 'Motion Project'}
          </span>

          {/* Mode Switcher: 4-Editor Workbench vs Live Motion Viewport */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/90 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('workbench')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                activeTab === 'workbench'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="OpenFilm 4-Editor Suite: Screening (Frame edits), Timeline Edit, Canvas planning, Color grading & Library"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Studio Workbench</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                activeTab === 'preview'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Omni-Studio Real-Time Interactive Scene & Video Player"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Omni-Motion View</span>
            </button>
          </div>
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

      {/* Full 4-Editor OpenFilm Studio Workbench (Screening, Edit, Canvas, Color & Library) */}
      {activeTab === 'workbench' && (
        <div className="relative flex flex-1 flex-col overflow-hidden bg-[#0a0f1d]">
          {isStudioLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#070b16]/90 backdrop-blur-xs">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
              <span className="mt-3 text-xs font-semibold text-slate-300">
                Initializing OpenFilm Studio Workbench...
              </span>
            </div>
          )}
          {/* Student Prompt Suggestions Floating Card */}
          {suggestedPrompt && (
            <div className="absolute bottom-3 left-3 right-3 z-30 flex items-center justify-between gap-3 rounded-xl border border-violet-500/50 bg-[#0f172a]/95 p-3 shadow-2xl backdrop-blur-md">
              <div className="flex items-start gap-2.5 overflow-hidden">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-600/30 text-violet-300">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-violet-400">
                      Suggested Edit Prompt · {suggestedPrompt.effectName}
                    </span>
                    <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-300">
                      Click to Apply in Chat
                    </span>
                  </div>
                  <p className="truncate text-xs font-medium text-slate-200">
                    "{suggestedPrompt.prompt}"
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    applyPromptToChatTextarea(suggestedPrompt.prompt, true);
                    if (showToast) {
                      showToast({
                        message: 'Layered effect prompt into message box!',
                        status: 'success',
                      });
                    }
                  }}
                  className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-violet-500 transition-colors"
                >
                  <Send className="h-3 w-3" />
                  <span>Use in Chat</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestedPrompt(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  title="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {studioUrl ? (
            <iframe
              src={studioUrl}
              title="OpenFilm Studio 4-Editor Suite"
              allow="autoplay; fullscreen; clipboard-read; clipboard-write"
              className="h-full w-full border-0"
              onLoad={() => setIsStudioLoading(false)}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-slate-400">
              Connecting to OpenFilm Studio service...
            </div>
          )}
        </div>
      )}

      {/* Omni-Motion Preview & Timeline View (Option A Diffusion / Option B 3D) */}
      <div className={`flex flex-1 flex-col overflow-hidden ${activeTab === 'preview' ? 'flex' : 'hidden'}`}>
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
            <button
              type="button"
              onClick={() => {
                const nextMuted = !isMuted;
                setIsMuted(nextMuted);
                if (iframeRef.current?.contentWindow) {
                  iframeRef.current.contentWindow.postMessage(
                    { type: 'AUDIO_MUTE', muted: nextMuted },
                    '*',
                  );
                }
              }}
              className={`rounded p-1.5 transition-colors ${
                !isMuted ? 'text-amber-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800'
              }`}
              title={isMuted ? 'Unmute Audio & Music' : 'Mute Audio & Music'}
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
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
