import { useEffect, useRef } from 'react';

/** requestAnimationFrame loop; dt in seconds, clamped so tab switches don't teleport things. */
export function useGameLoop(callback: (dt: number) => void) {
  const cb = useRef(callback);
  cb.current = callback;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      cb.current(dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
}
