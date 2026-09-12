import { rand } from './random';

export const reducedMotion =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const FONT = '"Press Start 2P", monospace';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Popup { x: number; y: number; text: string; color: string; life: number; big: boolean }

/** Shared juice: particles, floating score popups, screen shake. */
export class Fx {
  particles: Particle[] = [];
  popups: Popup[] = [];
  shake = 0;

  burst(x: number, y: number, color: string, count = 18, speed = 180) {
    const n = reducedMotion ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(speed * 0.3, speed);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rand(0.35, 0.8), color, size: rand(2, 4.5) });
    }
  }

  popup(x: number, y: number, text: string, color = '#fff', big = false) {
    this.popups.push({ x, y, text, color, life: 0, big });
  }

  kick(amount: number) {
    if (!reducedMotion) this.shake = Math.max(this.shake, amount);
  }

  update(dt: number) {
    const drag = Math.pow(0.02, dt);
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const p of this.popups) {
      p.life += dt;
      p.y -= 38 * dt;
    }
    this.popups = this.popups.filter((p) => p.life < 1);
    this.shake = Math.max(0, this.shake - dt * 40);
  }

  applyShake(ctx: CanvasRenderingContext2D) {
    if (this.shake > 0) ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      ctx.globalAlpha = 1 - p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.popups) {
      const t = p.life;
      ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const scale = t < 0.12 ? 0.5 + (t / 0.12) * 0.5 : 1;
      ctx.font = `${Math.round((p.big ? 22 : 13) * scale)}px ${FONT}`;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
  }
}

export function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, size: number, color: string, ox = 0, oy = 0) {
  ctx.beginPath();
  for (let x = ((ox % size) + size) % size; x <= w; x += size) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = ((oy % size) + size) % size; y <= h; y += size) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, rgb: string, strength: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, `rgba(${rgb},0)`);
  g.addColorStop(1, `rgba(${rgb},${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 10, align: CanvasTextAlign = 'center') {
  ctx.save();
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillText(text, x, y);
  ctx.restore();
}
