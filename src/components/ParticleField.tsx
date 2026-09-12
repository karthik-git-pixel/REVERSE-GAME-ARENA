import { useEffect, useRef } from 'react';
import { reducedMotion } from '../utils/fx';

const COLORS = ['#5ef1ff', '#ff5ef0', '#39ffb0', '#ffe45e'];

/** Slow drifting neon pixels behind the arena. */
export default function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    let w = 0, h = 0, raf = 0;
    const resize = () => {
      w = c.width = window.innerWidth;
      h = c.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    const ps = Array.from({ length: 46 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      s: 1 + Math.random() * 2.5,
      v: 8 + Math.random() * 22,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      a: 0.15 + Math.random() * 0.45,
    }));
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.y -= p.v * dt;
        if (p.y < -5) {
          p.y = h + 5;
          p.x = Math.random() * w;
        }
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }
      if (!reducedMotion) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="particles" aria-hidden="true" />;
}
