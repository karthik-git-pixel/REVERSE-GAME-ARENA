import { useEffect, useRef } from 'react';
import type { Dir } from '../games/types';

export const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export function useKeyboard(handler: (e: KeyboardEvent, down: boolean) => void) {
  const h = useRef(handler);
  h.current = handler;

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => h.current(e, true);
    const onUp = (e: KeyboardEvent) => h.current(e, false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);
}
