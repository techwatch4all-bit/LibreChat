import { useEffect } from 'react';

/* ============================================================================
   Scene rig — binds pointer input to the CSS depth tokens.

   Two separate effects share one rAF, because both are easing toward a target
   and would otherwise fight over the frame budget:

   - `--depth-shift-*` / `--depth-tilt-*` move the aurora and horizon planes,
     then `.content` counter-rotates slightly so the console feels looked
     *around* rather than dragged.
   - `--spec-x/y` places the specular highlight inside whichever panel the
     pointer is over.
   ========================================================================= */

const REDUCED = '(prefers-reduced-motion: reduce)';

const MAX_SHIFT = 26;
const MAX_TILT = 2.2;

export function useSceneRig(): void {
  useEffect(() => {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia(REDUCED);

    let targetX = 0;
    let targetY = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentX = 0;
    let currentY = 0;
    let frame = 0;
    let running = true;

    let specEl: HTMLElement | null = null;
    let specX = 50;
    let specY = 0;
    let specTargetX = 50;
    let specTargetY = 0;

    const onPointerMove = (event: PointerEvent): void => {
      const nx = event.clientX / window.innerWidth - 0.5;
      const ny = event.clientY / window.innerHeight - 0.5;
      targetX = nx * MAX_SHIFT;
      targetY = ny * MAX_SHIFT;
      targetTiltX = ny * MAX_TILT;
      targetTiltY = nx * MAX_TILT;

      const panel = (event.target as HTMLElement | null)?.closest<HTMLElement>('.panel') ?? null;
      if (panel !== specEl) {
        specEl?.style.removeProperty('--spec-x');
        specEl?.style.removeProperty('--spec-y');
        specEl = panel;
      }
      if (panel) {
        const rect = panel.getBoundingClientRect();
        specTargetX = ((event.clientX - rect.left) / rect.width) * 100;
        specTargetY = ((event.clientY - rect.top) / rect.height) * 100;
      }
    };

    const onPointerLeave = (): void => {
      targetX = 0;
      targetY = 0;
      targetTiltX = 0;
      targetTiltY = 0;
      specEl?.style.removeProperty('--spec-x');
      specEl?.style.removeProperty('--spec-y');
      specEl = null;
    };

    const loop = (): void => {
      if (!running) {
        return;
      }
      /* Critically-damped style easing: frame-rate independent enough to look
       * the same on a 60 Hz laptop and a 144 Hz monitor. */
      const k = 0.06;
      currentX += (targetX - currentX) * k;
      currentY += (targetY - currentY) * k;
      specX += (specTargetX - specX) * 0.12;
      specY += (specTargetY - specY) * 0.12;

      root.style.setProperty('--depth-shift-x', `${currentX.toFixed(2)}px`);
      root.style.setProperty('--depth-shift-y', `${currentY.toFixed(2)}px`);
      root.style.setProperty('--depth-tilt-x', `${(targetTiltX).toFixed(3)}deg`);
      root.style.setProperty('--depth-tilt-y', `${(targetTiltY).toFixed(3)}deg`);
      if (specEl) {
        specEl.style.setProperty('--spec-x', `${specX.toFixed(1)}%`);
        specEl.style.setProperty('--spec-y', `${specY.toFixed(1)}%`);
      }
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
    const onMotionChange = (): void => {
      if (reduceMotion.matches) {
        stop();
        root.style.setProperty('--depth-shift-x', '0px');
        root.style.setProperty('--depth-shift-y', '0px');
        root.style.setProperty('--depth-tilt-x', '0deg');
        root.style.setProperty('--depth-tilt-y', '0deg');
      } else {
        start();
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    reduceMotion.addEventListener('change', onMotionChange);

    if (reduceMotion.matches) {
      onMotionChange();
    } else {
      frame = requestAnimationFrame(loop);
    }

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      reduceMotion.removeEventListener('change', onMotionChange);
    };
  }, []);
}
