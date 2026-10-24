import { useEffect, useRef } from 'react';

/* ============================================================================
   Particle field — a small perspective renderer, written directly against
   Canvas2D rather than pulled from a 3D library.

   The console needs real depth, not a parallax image: particles are held in 3D,
   the camera yaws and pitches with the pointer, each point is projected through
   a focal-length divide, depth-sorted, and fogged toward the vanishing point.
   That is what makes near motes sweep past while far ones barely move.

   Colour fades continuously because each point is drawn as a cross-fade
   between two pre-rendered ramp sprites under additive blending — the field
   shifts through the brand palette every frame without any per-particle
   gradient work.
   ========================================================================= */

type Vec3 = { x: number; y: number; z: number };

type Particle = Vec3 & {
  radius: number;
  /** Offset into the colour cycle, so the field never pulses in unison. */
  phase: number;
  speed: number;
  drift: number;
};

const FOCAL = 900;
/** Negative z is away from the viewer; this is the depth of the field. */
const Z_FAR = -900;
const Z_NEAR = -140;
const SPAN_X = 1100;
const SPAN_Y = 680;

/** Brand ramps, mirrored from tokens.css so the canvas and the DOM agree. */
const RAMP: readonly (readonly [number, number, number])[] = [
  [34, 211, 238], /* cyan */
  [139, 92, 246], /* purple */
  [236, 72, 153], /* pink */
  [125, 211, 252], /* cyan-soft */
  [71, 45, 138], /* violet */
];

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

type RampStop = { index: number; next: number; blend: number };

function rampAt(t: number): RampStop {
  const wrapped = ((t % 1) + 1) % 1;
  const scaled = wrapped * RAMP.length;
  const index = Math.floor(scaled) % RAMP.length;
  return { index, next: (index + 1) % RAMP.length, blend: scaled - Math.floor(scaled) };
}

/** Pre-rendered glow sprite. Building a radial gradient per particle per frame
 *  is the single most expensive thing a 2D canvas can be asked to do; one
 *  cached bitmap per ramp colour replaces all of it. */
function createSprite(size: number, [r, g, b]: readonly [number, number, number]): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const ctx = sprite.getContext('2d');
  if (ctx) {
    const half = size / 2;
    const glow = ctx.createRadialGradient(half, half, 0, half, half, half);
    glow.addColorStop(0, `rgba(${r},${g},${b},1)`);
    glow.addColorStop(0.18, `rgba(${r},${g},${b},0.7)`);
    glow.addColorStop(0.42, `rgba(${r},${g},${b},0.24)`);
    glow.addColorStop(0.72, `rgba(${r},${g},${b},0.05)`);
    glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
  }
  return sprite;
}

function seedParticles(count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: (Math.random() - 0.5) * SPAN_X,
      y: (Math.random() - 0.5) * SPAN_Y,
      /* Bias toward the far plane so the field has genuine depth falloff
       * rather than an even scatter that reads as flat noise. */
      z: Z_FAR + Math.random() ** 1.7 * (Z_NEAR - Z_FAR),
      radius: 0.9 + Math.random() ** 2 * 3.2,
      phase: Math.random(),
      speed: 0.35 + Math.random() * 0.65,
      drift: Math.random() * Math.PI * 2,
    });
  }
  return particles;
}

export function Particles(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sprites = RAMP.map((colour) => createSprite(64, colour));

    let width = 0;
    let height = 0;
    let particles = seedParticles(140);
    let frame = 0;
    let running = true;

    /* Pointer drives the camera, not the projection. That is the difference
     * between the field sliding and the field being looked around. */
    let targetYaw = 0;
    let targetPitch = 0;
    let yaw = 0;
    let pitch = 0;

    const onPointerMove = (event: PointerEvent): void => {
      targetYaw = (event.clientX / window.innerWidth - 0.5) * 0.34;
      targetPitch = (event.clientY / window.innerHeight - 0.5) * 0.2;
    };
    const onPointerLeave = (): void => {
      targetYaw = 0;
      targetPitch = 0;
    };

    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      /* Density scales with viewport so a phone does not pay desktop cost. */
      particles = seedParticles(Math.round(Math.min(180, Math.max(60, (width * height) / 9000))));
    };

    const draw = (time: number): void => {
      const t = time / 1000;
      const cx = width / 2;
      const cy = height * 0.46;

      yaw = lerp(yaw, targetYaw, 0.045);
      pitch = lerp(pitch, targetPitch, 0.045);

      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      /* Sort far-to-near so additive blending accumulates correctly. */
      const ordered = particles.slice().sort((a, b) => a.z - b.z);

      for (const p of ordered) {
        /* Yaw about Y, then pitch about X — an actual camera, so near points
         * sweep further than far ones under the same pointer movement. */
        const x1 = p.x * cosYaw - p.z * sinYaw;
        const z1 = p.x * sinYaw + p.z * cosYaw;
        const y2 = p.y * cosPitch - z1 * sinPitch;
        const z2 = p.y * sinPitch + z1 * cosPitch;

        const wobble = Math.sin(t * 0.32 * p.speed + p.drift);
        const scale = FOCAL / (FOCAL - z2);
        const sx = cx + x1 * scale;
        const sy = cy + y2 * scale + wobble * 16;

        if (sx < -60 || sx > width + 60 || sy < -60 || sy > height + 60) {
          continue;
        }

        const depth = (z2 - Z_FAR) / (Z_NEAR - Z_FAR);
        const size = p.radius * scale * 6.4;
        /* Fog toward the vanishing point: distant motes dim out rather than
         * stacking into a solid mass. */
        const alpha = Math.max(0, Math.min(1, 0.04 + depth * 0.4));

        const stop = rampAt(p.phase + t * 0.014 * p.speed);
        const from = sprites[stop.index] as HTMLCanvasElement;
        const to = sprites[stop.next] as HTMLCanvasElement;

        /* Cross-fade the two neighbouring ramp sprites. Under additive blending
         * their weighted sum is a true intermediate colour. */
        ctx.globalAlpha = alpha * (1 - stop.blend);
        ctx.drawImage(from, sx - size / 2, sy - size / 2, size, size);
        ctx.globalAlpha = alpha * stop.blend;
        ctx.drawImage(to, sx - size / 2, sy - size / 2, size, size);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    const loop = (time: number): void => {
      if (!running) {
        return;
      }
      draw(time);
      frame = requestAnimationFrame(loop);
    };

    const start = (): void => {
      if (reduceMotion.matches || running) {
        return;
      }
      running = true;
      frame = requestAnimationFrame(loop);
    };
    const stop = (): void => {
      running = false;
      cancelAnimationFrame(frame);
    };
    const onVisibility = (): void => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);

    if (reduceMotion.matches) {
      /* One composed frame, drawn far enough in to have colours resolved. */
      draw(4200);
    } else {
      frame = requestAnimationFrame(loop);
    }

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas className="particles" ref={canvasRef} aria-hidden="true" />;
}
