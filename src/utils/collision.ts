import { clamp } from './random';

export function circleRect(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number) {
  const dx = cx - clamp(cx, rx, rx + rw);
  const dy = cy - clamp(cy, ry, ry + rh);
  return dx * dx + dy * dy < r * r;
}

export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
