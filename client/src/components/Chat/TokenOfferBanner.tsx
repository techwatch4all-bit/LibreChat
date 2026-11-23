import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Gift, Sparkles, CheckCircle2 } from 'lucide-react';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
} from '@librechat/client';
import { request } from 'librechat-data-provider';

interface TokenOffer {
  id: number;
  title: string;
  message: string;
  grant_input_mtok: number;
  grant_output_mtok: number;
  target_type: string;
  target_value: string;
}

const GlitterCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = 384;
    const height = 160;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const colors = ['#fbbf24', '#fde047', '#f472b6', '#c084fc', '#ffffff', '#38bdf8'];
    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      phase: number;
      speed: number;
      color: string;
      star: boolean;
    };

    const particles: Particle[] = Array.from({ length: 70 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: -0.2 - Math.random() * 0.5,
      size: 1.2 + Math.random() * 2.8,
      alpha: Math.random(),
      phase: Math.random() * Math.PI * 2,
      speed: 0.04 + Math.random() * 0.08,
      color: colors[Math.floor(Math.random() * colors.length)],
      star: Math.random() > 0.65,
    }));

    const drawStar = (x: number, y: number, r: number, color: string, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        ctx.lineTo(x + Math.cos(angle) * r * 2.1, y + Math.sin(angle) * r * 2.1);
        ctx.lineTo(
          x + Math.cos(angle + Math.PI / 4) * r * 0.45,
          y + Math.sin(angle + Math.PI / 4) * r * 0.45,
        );
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;

    const renderFrame = () => {
      ctx.clearRect(0, 0, width, height);

      // Soft radial golden glow behind the Mandala logo
      const grad = ctx.createRadialGradient(width / 2, height * 0.46, 8, width / 2, height * 0.46, 120);
      grad.addColorStop(0, 'rgba(251, 191, 36, 0.42)');
      grad.addColorStop(0.5, 'rgba(236, 72, 153, 0.22)');
      grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      for (const p of particles) {
        p.phase += p.speed;
        const twinkle = 0.25 + 0.75 * Math.abs(Math.sin(p.phase));
        if (!reducedMotion) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y < -8) {
            p.y = height + 8;
            p.x = Math.random() * width;
          }
          if (p.x < -8) p.x = width + 8;
          if (p.x > width + 8) p.x = -8;
        }
        if (p.star) {
          drawStar(p.x, p.y, p.size, p.color, twinkle);
        } else {
          ctx.save();
          ctx.globalAlpha = twinkle;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.75, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      if (!reducedMotion) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
};

const TokenOfferBanner: React.FC = () => {
  const [offers, setOffers] = useState<TokenOffer[]>([]);
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchOffers = useCallback(async () => {
    try {
      const res = await request.get<{ offers?: TokenOffer[] }>('/api/user/token-offers');
      if (Array.isArray(res?.offers)) {
        setOffers(res.offers);
      }
    } catch {
      // silent fail — offer polling should never disrupt chat
    }
  }, []);

  useEffect(() => {
    fetchOffers();
    const timer = setInterval(fetchOffers, 60000);
    return () => clearInterval(timer);
  }, [fetchOffers]);

  const activeOffer = offers[0];
  if (!activeOffer) {
    return null;
  }

  const totalMtok = Number(
    (Number(activeOffer.grant_input_mtok || 0) + Number(activeOffer.grant_output_mtok || 0)).toFixed(2),
  );
  const totalTokens = Math.round(totalMtok * 1_000_000);

  const handleClaim = async () => {
    setClaiming(true);
    setErrorMsg('');
    try {
      const res = await request.post<{ success?: boolean; message?: string }>(
        `/api/user/token-offers/${encodeURIComponent(String(activeOffer.id))}/claim`,
        {},
      );
      if (res?.success) {
        setClaimed(true);
        setTimeout(() => {
          setOpen(false);
          setClaimed(false);
          setOffers((prev) => prev.filter((o) => o.id !== activeOffer.id));
        }, 1400);
      } else {
        setErrorMsg(res?.message || 'Could not claim offer.');
      }
    } catch {
      setErrorMsg('Could not claim offer right now. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <>
      {/* Colourful Floating Offer Badge */}
      <button
        type="button"
        onClick={() => {
          setClaimed(false);
          setErrorMsg('');
          setOpen(true);
        }}
        aria-label={`Claim ${totalMtok} Mtok bonus offer`}
        className="fixed bottom-20 right-4 z-40 flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg ring-2 ring-white/30 transition-transform duration-200 hover:scale-105 focus:outline-none motion-safe:animate-bounce"
      >
        <img
          src="/assets/satchida/satchida-splash-mandala.png?v=clean4"
          alt="Satchida"
          className="size-5 rounded-full bg-white/90 p-0.5 object-contain"
        />
        <Gift className="size-3.5 shrink-0" aria-hidden="true" />
        <span>Bonus tokens</span>
      </button>

      {/* Celebratory Offer Popup with Animated Golden Glitter Background & Satchida Mandala */}
      <OGDialog open={open} onOpenChange={setOpen}>
        <OGDialogContent className="max-w-md overflow-hidden rounded-2xl border border-amber-400/50 bg-surface-primary p-0 shadow-2xl">
          <div className="relative flex flex-col items-center overflow-hidden bg-gradient-to-br from-[#1b1033] via-[#2d1448] to-[#1a0d2e] px-6 pb-6 pt-8 text-center">
            <GlitterCanvas />

            <div className="relative z-10 mb-4 flex size-28 items-center justify-center rounded-full bg-white/95 p-2 shadow-[0_0_38px_rgba(251,191,36,0.75)] ring-4 ring-amber-300/90">
              <img
                src="/assets/satchida/satchida-splash-mandala.png?v=clean4"
                alt="Satchida Mandala Logo"
                className="size-24 object-contain"
              />
            </div>

            <OGDialogHeader className="relative z-10 text-center">
              <OGDialogTitle className="flex items-center justify-center gap-2 text-xl font-black tracking-tight text-white drop-shadow">
                <Sparkles className="size-5 text-amber-300" aria-hidden="true" />
                <span>{activeOffer.title}</span>
              </OGDialogTitle>
            </OGDialogHeader>
          </div>

          <div className="flex flex-col items-center gap-5 px-6 py-7 text-center">
            <div className="flex w-full flex-col items-center gap-1.5">
              <span className="text-lg font-bold uppercase tracking-widest text-text-secondary">
                Bonus tokens
              </span>
              <span className="w-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-6xl font-black leading-none tracking-tight text-transparent drop-shadow-[0_2px_16px_rgba(251,191,36,0.35)] tabular-nums sm:text-7xl">
                {totalTokens}
              </span>
            </div>

            {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

            {claimed ? (
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-emerald-500/15 px-5 py-2.5 text-base font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-5" aria-hidden="true" />
                <span>Bonus Tokens Claimed!</span>
              </div>
            ) : (
              <div className="mt-2 flex w-full gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={claiming}
                  className="h-11 flex-1 text-sm font-semibold"
                >
                  Later
                </Button>
                <Button
                  type="button"
                  variant="default"
                  onClick={handleClaim}
                  disabled={claiming}
                  className="h-11 flex-1 bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 text-sm font-extrabold text-white shadow-lg hover:opacity-90"
                >
                  {claiming ? 'Claiming...' : 'Accept & Claim'}
                </Button>
              </div>
            )}
          </div>
        </OGDialogContent>
      </OGDialog>
    </>
  );
};

export default TokenOfferBanner;
