import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';

/* ============================================================================
   Mandala stage — the brand mark with tags flying out of its petals.

   The artwork is a fixed raster (800x690) and is never overdrawn.
   Each tag matches the petal that carries the same wording and rests on
   an ellipse concentric with the mark at that petal's own angle.

   A slim animated white line runs from each petal to its tag, carrying
   a bright travelling segment (matching the mandala's sweep ring),
   flowing outward continuously.
   ========================================================================= */

interface Petal {
  id: string;
  /** That petal's own label, as a % of the mandala box. */
  ax: number;
  ay: number;
  label: TranslationKeys;
  angleDeg: number;
}

const PETALS: Petal[] = [
  { id: 'local-first', ax: 49.5, ay: 28.7, angleDeg: 270, label: 'com_callout_local_first' },
  { id: 'fixed-term', ax: 62.5, ay: 31.2, angleDeg: 310, label: 'com_callout_fixed_term' },
  { id: 'no-hidden-cost', ax: 88.4, ay: 56.5, angleDeg: 352, label: 'com_callout_no_hidden_cost' },
  { id: 'no-user-limit', ax: 88.1, ay: 72.0, angleDeg: 36, label: 'com_callout_no_user_limit' },
  { id: 'zero-telemetry', ax: 50.0, ay: 86.5, angleDeg: 88, label: 'com_callout_zero_telemetry' },
  { id: 'local-solutions', ax: 35.0, ay: 71.4, angleDeg: 134, label: 'com_callout_local_solutions' },
  { id: 'no-caps', ax: 21.5, ay: 58.3, angleDeg: 166, label: 'com_callout_no_caps' },
  { id: 'sovereignty', ax: 12.5, ay: 45.5, angleDeg: 198, label: 'com_callout_sovereignty' },
  { id: 'native-ai', ax: 34.0, ay: 30.5, angleDeg: 228, label: 'com_callout_native_ai' },
];

const CYCLE_S = 17;
const STAGGER_S = 0.3;
const CHIP_H = 34;

interface Placed {
  id: string;
  cx: number;
  cy: number;
  px: number;
  py: number;
  lx: number;
  ly: number;
  d: string;
  dx: number;
  dy: number;
}

export default function MandalaStage({ children }: { children: ReactNode }): JSX.Element {
  const localize = useLocalize();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [ring, setRing] = useState<boolean>(false);
  const [chipW, setChipW] = useState(148);

  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const disc = stage.querySelector<HTMLElement>('.satchida-auth-brand__frame');
    if (!disc) {
      return;
    }

    const stageW = stage.clientWidth;
    if (stageW < 10) {
      return;
    }

    /* Un-transformed layout geometry. The disc tilts in 3D, so we read
       offsetWidth/offsetHeight rather than the moving bounding rect. */
    const frameW = disc.offsetWidth;
    const frameH = disc.offsetHeight;
    if (frameW < 10 || frameH < 10) {
      return;
    }

    // Mandala artwork is 800x690 inside the square frame
    const imgW = frameW;
    const imgH = frameW * (690 / 800);

    const width = Math.min(168, Math.max(115, Math.round(stageW * 0.12)));
    const hx = width / 2;
    const hy = CHIP_H / 2;

    // Center coordinates inside stage
    const cx0 = stageW / 2;

    // Halo sits at inset -14% + 26px blur. Extra padding ensures total clearance
    const padX = Math.round(frameW * 0.16 + 16);
    const padY = Math.round(imgH * 0.16 + 16);
    const a = frameW / 2 + padX;
    const b = imgH / 2 + padY;
    const clearance = stageW < 960 ? 22 : 36;

    // Reach needed vertically for tags
    const maxReachY = Math.ceil(b + hy + clearance + 28);
    const minStageH = Math.max(620, Math.ceil(maxReachY * 2 + 16));

    if (stage.style.minHeight !== `${minStageH}px`) {
      stage.style.minHeight = `${minStageH}px`;
    }
    const cy0 = minStageH / 2;

    // Mandala image bounding box inside the centered frame
    const imgLeft = cx0 - imgW / 2;
    const imgTop = cy0 - imgH / 2;

    // Frame exclusion box (un-transformed) with margin
    const discBox = {
      left: cx0 - a,
      right: cx0 + a,
      top: cy0 - b,
      bottom: cy0 + b,
    };

    // Allowance for vertical petal tips reaching past frame
    const A = frameW / 2 + padX + hx;
    const B = imgH / 2 + padY + hy;

    const fitsBox = (p: { cx: number }): boolean =>
      p.cx - hx >= 8 && p.cx + hx <= stageW - 8;

    const clears = (cx: number, cy: number): boolean => {
      const l = cx - hx;
      const r = cx + hx;
      const tp = cy - hy;
      const bt = cy + hy;
      return r <= discBox.left || l >= discBox.right || bt <= discBox.top || tp >= discBox.bottom;
    };

    const next: Placed[] = PETALS.map((petal) => {
      // Petal anchor inside image
      const px = imgLeft + (petal.ax / 100) * imgW;
      const py = imgTop + (petal.ay / 100) * imgH;
      const angle = (petal.angleDeg * Math.PI) / 180;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Precise Euclidean ellipse radius along ray
      const denom = Math.hypot(B * cosA, A * sinA) || 1;
      const ellipseRadius = (A * B) / denom;
      const verticalAllowance = Math.abs(sinA) > 0.82 ? 18 : 0;
      const dist = ellipseRadius + clearance + verticalAllowance;

      let cx = cx0 + cosA * dist;
      let cy = cy0 + sinA * dist;

      // Push outward if still within exclusion box
      if (!clears(cx, cy)) {
        for (let step = 4; step <= 160; step += 4) {
          const testCx = cx0 + cosA * (dist + step);
          const testCy = cy0 + sinA * (dist + step);
          if (clears(testCx, testCy)) {
            cx = testCx;
            cy = testCy;
            break;
          }
        }
      }

      // Inner edge of tag where connector line terminates
      const toCenter = Math.atan2(cy0 - cy, cx0 - cx);
      const lx = cx + Math.cos(toCenter) * hx;
      const ly = cy + Math.sin(toCenter) * hy;

      // Smooth curved path bowing slightly away from radius
      const mx = (px + lx) / 2;
      const my = (py + ly) / 2;
      const bowX = mx + (ly - py) * 0.08;
      const bowY = my - (lx - px) * 0.08;

      // Spawn vector: tag spawns along the connector line outside the halo box
      // so it NEVER sits on top of the mandala artwork even during flyout animation
      const spawnFactor = 0.55;
      const spawnX = px + (lx - px) * (1 - spawnFactor);
      const spawnY = py + (ly - py) * (1 - spawnFactor);
      const dx = spawnX - cx;
      const dy = spawnY - cy;

      return {
        id: petal.id,
        cx,
        cy,
        px,
        py,
        lx,
        ly,
        d: `M ${px.toFixed(1)} ${py.toFixed(1)} Q ${bowX.toFixed(1)} ${bowY.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)}`,
        dx,
        dy,
      };
    });

    const fits = next.every(fitsBox) && next.every((p) => clears(p.cx, p.cy));

    setRing((prev) => (prev === fits ? prev : fits));
    setChipW((prev) => (Math.abs(prev - width) < 0.5 ? prev : width));
    setPlaced((prev) => {
      if (!fits) {
        return prev.length === 0 ? prev : [];
      }
      const same =
        prev.length === next.length &&
        prev.every((q, i) => q && next[i] && q.id === next[i].id && Math.abs(q.cx - next[i].cx) < 0.5);
      return same ? prev : next;
    });
  }, []);

  useEffect(() => {
    measure();
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    const disc = stage.querySelector<HTMLElement>('.satchida-auth-brand__frame');
    if (disc) {
      ro.observe(disc);
    }
    window.addEventListener('resize', measure);
    const mo = new MutationObserver(measure);
    mo.observe(stage, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  return (
    <div className="mandala-stage" ref={stageRef}>
      {ring && placed.length === PETALS.length ? (
        <svg
          className="mandala-lines"
          aria-hidden="true"
          width="100%"
          height="100%"
        >
          <defs>
            <filter id="satchida-line-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {placed.map((p, i) => (
            <g
              key={p.id}
              className="mandala-line-group"
              style={{ '--cycle': `${CYCLE_S}s`, '--stagger': `${i * STAGGER_S}s` } as CSSProperties}
            >
              <path className="mandala-line-track" d={p.d} />
              <path
                className="mandala-line-pulse"
                d={p.d}
                pathLength="100"
                filter="url(#satchida-line-glow)"
              />
            </g>
          ))}
        </svg>
      ) : null}

      <div className="mandala-stage__disc">{children}</div>

      <ul className={`mandala-tags${ring ? '' : ' mandala-tags--stacked'}`}>
        {PETALS.map((petal, i) => {
          const place = ring ? placed.find((p) => p.id === petal.id) : undefined;
          const style = (
            ring
              ? {
                  '--cycle': `${CYCLE_S}s`,
                  '--stagger': `${i * STAGGER_S}s`,
                  '--dx': `${place?.dx ?? 0}px`,
                  '--dy': `${place?.dy ?? 0}px`,
                  '--chip-w': `${chipW}px`,
                  left: place ? `${place.cx}px` : undefined,
                  top: place ? `${place.cy}px` : undefined,
                }
              : { '--i': i, '--chip-w': `${chipW}px` }
          ) as unknown as CSSProperties;

          return (
            <li className="mandala-tag" key={petal.id} style={style}>
              <span className="mandala-tag__mark" aria-hidden="true" />
              <span className="mandala-tag__label">{localize(petal.label)}</span>
              <span className="mandala-tag__sheen" aria-hidden="true" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
