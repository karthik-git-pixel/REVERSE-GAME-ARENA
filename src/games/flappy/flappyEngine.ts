import type { Engine, HudState, Input } from '../types';
import { Fx, label, vignette } from '../../utils/fx';
import { sfx } from '../../audio/audioManager';
import { clamp, rand } from '../../utils/random';
import { circleRect } from '../../utils/collision';

export const FLAPPY_W = 800;
export const FLAPPY_H = 500;

const BIRD_X = 210;
const BIRD_R = 14;
const PIPE_W = 78;
const GRAVITY = 1000;
const FLAP_V = -300;
const FLAP_HEIGHT = (FLAP_V * FLAP_V) / (2 * GRAVITY); // ~45px bob above cruise altitude
const MAX_FALL = 430;
const GAP_ACCEL = 2600;
const GAP_MAX = 440;
const GATES_PER_LEVEL = 6;
// index = level (1..5)
const GAP = [0, 185, 158, 148, 138, 130];
const SPEED = [0, 150, 160, 200, 210, 235];
const SPACING = [0, 370, 355, 340, 320, 300];
const DRIFT = [0, 0, 0, 0, 55, 80];
const CRUISE_RANGE = [0, 110, 125, 140, 150, 150];

interface Pipe {
  x: number; gapY: number; gap: number; drift: number;
  passed: boolean; judged: boolean; perfect: boolean; close: boolean; pulse: number;
}

export class FlappyEngine implements Engine {
  over = false;
  score = 0;

  private pipes: Pipe[] = [];
  private active: Pipe | null = null;
  private bird = { y: FLAPPY_H / 2, vy: 0, cruise: FLAPPY_H / 2 + 20, wing: 0 };
  private trail: number[] = [];
  private gapV = 0;
  private speed = SPEED[1];
  private dist = 0;
  private time = 0;
  private level = 1;
  private gates = 0;
  private perfects = 0;
  private combo = 0;
  private maxCombo = 0;
  private danger = 0;
  private beat = 0;
  private cruiseTimer = 2;
  private reason = '';
  private fx = new Fx();
  private stars = Array.from({ length: 70 }, () => ({ x: rand(0, FLAPPY_W), y: rand(0, FLAPPY_H * 0.7), s: rand(0.5, 2) }));
  private city = Array.from({ length: 26 }, (_, i) => ({ x: i * 50, w: rand(28, 48), h: rand(40, 170) }));

  constructor() {
    this.spawn(700);
  }

  private spawn(x: number) {
    const gap = GAP[this.level];
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.pipes.push({
      x, gap, gapY: rand(gap / 2 + 30, FLAPPY_H - gap / 2 - 30), drift: DRIFT[this.level] * dir,
      passed: false, judged: false, perfect: false, close: false, pulse: 0,
    });
  }

  private setCruise(delta: number) {
    const lo = 110, hi = FLAPPY_H - 50;
    const b = this.bird;
    if (b.cruise + delta < lo || b.cruise + delta > hi) delta = -delta;
    b.cruise = clamp(b.cruise + delta, lo, hi);
  }

  update(dt: number, input: Input) {
    this.fx.update(dt);
    const b = this.bird;
    if (this.over) {
      b.vy = Math.min(MAX_FALL * 1.5, b.vy + GRAVITY * dt);
      b.y = Math.min(FLAPPY_H + 40, b.y + b.vy * dt);
      return;
    }
    this.time += dt;
    this.speed += (SPEED[this.level] - this.speed) * Math.min(1, dt * 2);
    const move = this.speed * dt;
    this.dist += move;

    // --- pipes scroll + spawn
    for (const p of this.pipes) {
      p.x -= move;
      p.pulse = Math.max(0, p.pulse - dt * 2.5);
    }
    this.pipes = this.pipes.filter((p) => p.x > -PIPE_W - 20);
    const last = this.pipes[this.pipes.length - 1];
    if (!last || last.x < FLAPPY_W + 20 - SPACING[this.level]) this.spawn(last ? last.x + SPACING[this.level] : FLAPPY_W + 20);

    // --- player moves the NEXT gap (never the bird)
    const active = this.pipes.find((p) => !p.passed && p.x + PIPE_W > BIRD_X - BIRD_R) ?? null;
    if (active !== this.active) {
      this.active = active;
      this.gapV = 0;
    }
    if (active) {
      let acc = 0;
      if (input.held.has('up')) acc -= GAP_ACCEL;
      if (input.held.has('down')) acc += GAP_ACCEL;
      if (input.pointer.down) acc = clamp((input.pointer.y - active.gapY) * 70 - this.gapV * 16, -GAP_ACCEL * 1.5, GAP_ACCEL * 1.5);
      if (acc === 0) this.gapV *= Math.pow(0.0005, dt);
      else this.gapV += (Math.sign(acc) !== Math.sign(this.gapV) ? acc * 2 : acc) * dt;
      this.gapV = clamp(this.gapV, -GAP_MAX, GAP_MAX);
    }
    for (const p of this.pipes) {
      const lo = p.gap / 2 + 12, hi = FLAPPY_H - p.gap / 2 - 12;
      p.gapY += ((p === active ? this.gapV : 0) + p.drift) * dt;
      if (p.gapY < lo || p.gapY > hi) {
        p.gapY = clamp(p.gapY, lo, hi);
        p.drift = -p.drift;
        if (p === active) this.gapV = 0;
      }
    }

    // --- autonomous bird
    if (this.level >= 3 && (this.cruiseTimer -= dt) <= 0) {
      this.cruiseTimer = rand(1.8, 3.2);
      this.setCruise(rand(-55, 55));
    }
    b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * dt);
    b.y += b.vy * dt;
    if (b.y > b.cruise && b.vy > 0) {
      b.vy = FLAP_V;
      b.wing = 1;
    }
    b.wing = Math.max(0, b.wing - dt * 4);
    if (b.y < BIRD_R + 4) {
      b.y = BIRD_R + 4;
      b.vy = Math.max(0, b.vy);
    }
    this.trail.unshift(b.y);
    this.trail.length = Math.min(this.trail.length, 12);

    // --- collisions, danger, scoring
    this.danger = 0;
    for (const p of this.pipes) {
      const top = p.gapY - p.gap / 2, bot = p.gapY + p.gap / 2;
      if (circleRect(BIRD_X, b.y, BIRD_R - 2, p.x, -60, PIPE_W, top + 60)) return this.die('THE BIRD SMASHED INTO THE TOP PIPE', p);
      if (circleRect(BIRD_X, b.y, BIRD_R - 2, p.x, bot, PIPE_W, FLAPPY_H - bot + 60)) return this.die('THE BIRD SMASHED INTO THE BOTTOM PIPE', p);

      if (!p.judged && p.x + PIPE_W / 2 <= BIRD_X) {
        p.judged = true;
        p.perfect = Math.abs(b.y - p.gapY) < p.gap * 0.14;
      }
      const inside = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
      if (inside && Math.min(b.y - BIRD_R - top, bot - b.y - BIRD_R) < 7) p.close = true;
      if (p === active) {
        const ahead = p.x - (BIRD_X + BIRD_R);
        const bandTop = b.cruise - FLAP_HEIGHT - BIRD_R, bandBot = b.cruise + BIRD_R;
        if (ahead < 170 && (bandTop < top + 2 || bandBot > bot - 2)) this.danger = ahead <= 0 ? 1 : 1 - ahead / 170;
      }
      if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) this.pass(p);
    }

    if (this.danger > 0.45) {
      if ((this.beat -= dt) <= 0) {
        sfx('heartbeat');
        this.beat = 0.55;
      }
    } else this.beat = 0;
  }

  private pass(p: Pipe) {
    p.passed = true;
    p.pulse = 1;
    this.gates++;
    this.combo = p.close ? 1 : this.combo + 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const pts = (p.perfect ? 250 : 100) * Math.min(this.combo, 10);
    this.score += pts;

    const by = this.bird.y;
    this.fx.burst(BIRD_X, by, p.perfect ? '#ffe45e' : '#39ffb0', p.perfect ? 32 : 16, 210);
    this.fx.popup(BIRD_X + 30, by - 20, `+${pts}`, '#ffffff');
    if (p.perfect) {
      this.perfects++;
      this.fx.popup(BIRD_X + 30, by - 50, 'PERFECT!', '#ffe45e', true);
      this.fx.kick(4);
      sfx('perfect');
    } else sfx('gate');
    if (p.close) this.fx.popup(BIRD_X + 30, by + 22, 'CLOSE CALL', '#ff3b6b');
    else if (this.combo > 1 && this.combo % 5 === 0) {
      this.fx.popup(BIRD_X + 30, by + 22, `COMBO x${this.combo}`, '#ff5ef0');
      sfx('combo');
    }

    const lvl = Math.min(5, 1 + Math.floor(this.gates / GATES_PER_LEVEL));
    if (lvl > this.level) {
      this.level = lvl;
      sfx('level');
      this.fx.popup(FLAPPY_W / 2, FLAPPY_H / 2 - 60, `LEVEL ${lvl}`, '#5ef1ff', true);
    }
    this.setCruise((Math.random() < 0.5 ? -1 : 1) * rand(40, CRUISE_RANGE[this.level]));
  }

  private die(reason: string, p: Pipe) {
    this.over = true;
    this.reason = reason;
    p.pulse = 1;
    this.bird.vy = -220;
    this.fx.burst(BIRD_X, this.bird.y, '#ffd23f', 44, 280);
    this.fx.kick(14);
  }

  render(ctx: CanvasRenderingContext2D) {
    const W = FLAPPY_W, H = FLAPPY_H;
    const now = performance.now() / 1000;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#07051a');
    sky.addColorStop(1, '#1d0b3a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    for (const s of this.stars) {
      const x = (((s.x - this.dist * 0.04 * s.s) % W) + W) % W;
      ctx.fillStyle = `rgba(200,220,255,${0.3 + Math.sin(now * 2 + s.x) * 0.2})`;
      ctx.fillRect(x, s.y, s.s, s.s);
    }
    const cityW = this.city.length * 50;
    const off = (this.dist * 0.25) % cityW;
    ctx.fillStyle = '#150a30';
    ctx.strokeStyle = 'rgba(255,94,240,0.35)';
    ctx.lineWidth = 1;
    for (const k of [0, cityW]) {
      for (const c of this.city) {
        const x = c.x - off + k;
        if (x > W || x + c.w < 0) continue;
        ctx.fillRect(x, H - 30 - c.h, c.w, c.h);
        ctx.strokeRect(x + 0.5, H - 30 - c.h + 0.5, c.w, c.h);
      }
    }
    // scrolling floor grid
    ctx.fillStyle = '#0a0418';
    ctx.fillRect(0, H - 30, W, 30);
    ctx.strokeStyle = 'rgba(94,241,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(0, H - 30.5);
    ctx.lineTo(W, H - 30.5);
    for (let x = -(this.dist % 40); x < W + 40; x += 40) {
      ctx.moveTo(x, H - 30);
      ctx.lineTo(x - 24, H);
    }
    ctx.stroke();

    ctx.save();
    this.fx.applyShake(ctx);
    for (const p of this.pipes) this.renderPipe(ctx, p, now);
    this.renderBird(ctx, now);
    this.fx.render(ctx);
    ctx.restore();

    if (this.danger > 0.45 && !this.over) vignette(ctx, W, H, '255,40,90', 0.3 * this.danger);
  }

  private renderPipe(ctx: CanvasRenderingContext2D, p: Pipe, now: number) {
    const H = FLAPPY_H;
    const isActive = p === this.active && !this.over;
    const top = p.gapY - p.gap / 2, bot = p.gapY + p.gap / 2;
    const d = isActive ? this.danger : 0;
    const edge = d > 0.3 ? '#ff3b6b' : isActive ? '#39ffb0' : '#4a7dff';

    ctx.save();
    ctx.fillStyle = isActive ? '#08262a' : '#0c1433';
    ctx.fillRect(p.x, 0, PIPE_W, top);
    ctx.fillRect(p.x, bot, PIPE_W, H - bot);
    // subtle moving stripes
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    for (let y = (now * 20) % 22; y < H; y += 22) {
      if (y > top - 16 && y < bot + 16) continue;
      ctx.moveTo(p.x + 6, y);
      ctx.lineTo(p.x + PIPE_W - 6, y);
    }
    ctx.stroke();

    ctx.shadowColor = edge;
    ctx.shadowBlur = 10 + d * 24 + p.pulse * 24;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2 + p.pulse * 2;
    ctx.strokeRect(p.x, -4, PIPE_W, top + 4);
    ctx.strokeRect(p.x, bot, PIPE_W, H - bot + 4);
    ctx.fillStyle = '#0a0f24';
    ctx.fillRect(p.x - 7, top - 16, PIPE_W + 14, 16);
    ctx.fillRect(p.x - 7, bot, PIPE_W + 14, 16);
    ctx.strokeRect(p.x - 7, top - 16, PIPE_W + 14, 16);
    ctx.strokeRect(p.x - 7, bot, PIPE_W + 14, 16);
    ctx.restore();

    if (!isActive) return;
    const cx = p.x + PIPE_W / 2;
    // animated gap bracket + movable chevrons
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -now * 30;
    ctx.strokeStyle = 'rgba(57,255,176,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - 14, top + 4, PIPE_W + 28, p.gap - 8);
    ctx.restore();
    const bob = Math.sin(now * 6) * 3;
    ctx.fillStyle = 'rgba(57,255,176,0.8)';
    for (const s of [-1, 1]) {
      const y = p.gapY + s * (p.gap / 2 - 22) + s * bob;
      ctx.beginPath();
      ctx.moveTo(p.x - 26, y - s * 6);
      ctx.lineTo(p.x - 32, y + s * 4);
      ctx.lineTo(p.x - 20, y + s * 4);
      ctx.fill();
    }
    label(ctx, 'NEXT GAP', cx, 16, d > 0.3 ? '#ff3b6b' : '#39ffb0', 9);
    label(ctx, '▼', cx, 34 + bob, d > 0.3 ? '#ff3b6b' : '#39ffb0', 10);

    // predicted flight path (fades out as levels rise)
    if (this.level <= 4) {
      const alpha = this.level <= 2 ? 0.6 : 0.3;
      const py = this.bird.cruise - FLAP_HEIGHT / 2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.setLineDash([3, 7]);
      ctx.strokeStyle = '#ffe45e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(BIRD_X + BIRD_R + 6, this.bird.y);
      ctx.lineTo(cx, py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cx, py, BIRD_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderBird(ctx: CanvasRenderingContext2D, now: number) {
    const b = this.bird;
    this.trail.forEach((y, i) => {
      ctx.fillStyle = `rgba(255,210,63,${0.35 - i * 0.028})`;
      ctx.fillRect(BIRD_X - 18 - i * 7, y - 2, 4, 4);
    });

    ctx.save();
    ctx.translate(BIRD_X, b.y);
    ctx.rotate(this.over ? now * 9 : clamp(b.vy / 700, -0.45, 0.65));
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_R + 3, BIRD_R, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.ellipse(-1, 6, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // wing
    ctx.save();
    ctx.translate(-5, 1);
    ctx.rotate(-1.1 * b.wing + Math.sin(now * 16) * 0.2);
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath();
    ctx.ellipse(-5, 0, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // beak
    ctx.fillStyle = '#ff5e3a';
    ctx.beginPath();
    ctx.moveTo(BIRD_R + 1, -2);
    ctx.lineTo(BIRD_R + 11, 2);
    ctx.lineTo(BIRD_R + 1, 6);
    ctx.fill();
    // eye (worried when in danger)
    const worried = this.danger > 0.45;
    if (this.over) {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, -9); ctx.lineTo(10, -3);
      ctx.moveTo(10, -9); ctx.lineTo(4, -3);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(7, -5, worried ? 6 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(8.5, -5, worried ? 1.6 : 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (worried && !this.over) label(ctx, '!', BIRD_X, b.y - 30, '#ff3b6b', 14);
  }

  hud(): HudState {
    let alert: string | undefined;
    if (this.danger > 0.45) alert = '⚠ COLLISION AHEAD — MOVE THE GAP TO THE BIRD';
    else if (this.gates === 0) alert = 'REVERSED: THE BIRD FLIES ITSELF — YOU MOVE THE GAP';
    return {
      items: [
        { label: 'SCORE', value: String(this.score).padStart(6, '0') },
        { label: 'GATES', value: String(this.gates) },
        { label: 'COMBO', value: `x${Math.max(1, this.combo)}` },
        { label: 'LEVEL', value: String(this.level), warn: this.danger > 0.45 },
      ],
      alert,
    };
  }

  result() {
    return {
      reason: this.reason,
      rows: [
        ['GATES PASSED', String(this.gates)],
        ['PERFECTS', String(this.perfects)],
        ['MAX COMBO', `x${Math.max(1, this.maxCombo)}`],
        ['LEVEL', String(this.level)],
      ] as [string, string][],
    };
  }
}
