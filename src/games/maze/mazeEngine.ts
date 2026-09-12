import type { Engine, HudState, Input } from '../types';
import { Fx, label, vignette } from '../../utils/fx';
import { sfx } from '../../audio/audioManager';
import { clamp, randInt, shuffle } from '../../utils/random';
import { circleRect, dist } from '../../utils/collision';

export const MAZE_W = 600;
export const MAZE_H = 600;

const TILE = 46;
const R = 13;
const SPEED = 230;
// index = level (1..5)
const CELLS = [0, 6, 8, 10, 12, 14];
const TIME = [0, 45, 55, 65, 75, 85];
const ORBS = [0, 4, 6, 8, 10, 12];
const FOG = [0, 340, 310, 280, 250, 230];

export class MazeEngine implements Engine {
  over = false;
  score = 0;

  private stage = 1;
  private level = 1;
  private tw = 0;
  private th = 0;
  private grid = new Uint8Array(0);
  /** Player position in maze space. The player never moves on screen — the maze does. */
  private px = 0;
  private py = 0;
  private vx = 0;
  private vy = 0;
  private lookX = 1;
  private lookY = 0;
  private exit = { x: 0, y: 0 };
  private orbs: { x: number; y: number }[] = [];
  private stageOrbs = 0;
  private orbsTotal = 0;
  private timeLeft = 0;
  private lastSec = 0;
  private time = 0;
  private combo = 0;
  private comboTimer = 0;
  private maxCombo = 0;
  private cleared = 0;
  private flash = 0;
  private reason = '';
  private fx = new Fx();

  constructor() {
    this.build();
  }

  private build() {
    this.level = Math.min(5, this.stage);
    const n = CELLS[this.level];
    const tw = (this.tw = n * 2 + 1);
    this.th = tw;
    const g = new Uint8Array(tw * tw).fill(1);
    const depth = new Int32Array(n * n).fill(-1);
    const carve = (cx: number, cy: number) => (g[(2 * cy + 1) * tw + 2 * cx + 1] = 0);

    // recursive backtracker (iterative)
    const stack = [0];
    depth[0] = 0;
    carve(0, 0);
    let far = 0;
    while (stack.length) {
      const c = stack[stack.length - 1];
      const cx = c % n, cy = (c / n) | 0;
      const next = shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]]).find(([dx, dy]) => {
        const nx = cx + dx, ny = cy + dy;
        return nx >= 0 && ny >= 0 && nx < n && ny < n && depth[ny * n + nx] < 0;
      });
      if (!next) {
        stack.pop();
        continue;
      }
      const nx = cx + next[0], ny = cy + next[1], ni = ny * n + nx;
      depth[ni] = depth[c] + 1;
      if (depth[ni] > depth[far]) far = ni;
      g[(2 * cy + 1 + next[1]) * tw + (2 * cx + 1 + next[0])] = 0;
      carve(nx, ny);
      stack.push(ni);
    }
    // knock out a few extra walls so there are loops (less dead-end frustration)
    for (let i = 0; i < n * 1.5; i++) {
      const x = randInt(1, tw - 2), y = randInt(1, tw - 2);
      if ((x + y) % 2 === 1) g[y * tw + x] = 0;
    }
    this.grid = g;

    const cellCenter = (c: number) => ({ x: (2 * (c % n) + 1.5) * TILE, y: (2 * ((c / n) | 0) + 1.5) * TILE });
    const start = cellCenter(0);
    this.px = start.x;
    this.py = start.y;
    this.vx = this.vy = 0;
    this.exit = cellCenter(far);
    const cells = shuffle(Array.from({ length: n * n }, (_, i) => i).filter((i) => i !== 0 && i !== far));
    this.orbs = cells.slice(0, ORBS[this.level]).map(cellCenter);
    this.stageOrbs = this.orbs.length;
    this.timeLeft = TIME[this.level];
    this.lastSec = Math.ceil(this.timeLeft);
  }

  private solid(tx: number, ty: number) {
    return tx < 0 || ty < 0 || tx >= this.tw || ty >= this.th || this.grid[ty * this.tw + tx] === 1;
  }

  private collides(x: number, y: number) {
    for (let ty = Math.floor((y - R) / TILE); ty <= Math.floor((y + R) / TILE); ty++)
      for (let tx = Math.floor((x - R) / TILE); tx <= Math.floor((x + R) / TILE); tx++)
        if (this.solid(tx, ty) && circleRect(x, y, R, tx * TILE, ty * TILE, TILE, TILE)) return true;
    return false;
  }

  /** Moves the player through maze space with wall sliding. Returns which axes were blocked. */
  private moveBy(dx: number, dy: number): [boolean, boolean] {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 5));
    let bx = false, by = false;
    for (let i = 0; i < steps; i++) {
      if (!bx) {
        const nx = this.px + dx / steps;
        if (this.collides(nx, this.py)) bx = true;
        else this.px = nx;
      }
      if (!by) {
        const ny = this.py + dy / steps;
        if (this.collides(this.px, ny)) by = true;
        else this.py = ny;
      }
    }
    return [bx, by];
  }

  update(dt: number, input: Input) {
    this.fx.update(dt);
    if (this.over) return;
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 1.5);
    this.timeLeft -= dt;
    const sec = Math.ceil(this.timeLeft);
    if (sec < this.lastSec) {
      this.lastSec = sec;
      if (sec <= 10 && sec > 0) sfx(sec <= 5 ? 'heartbeat' : 'tick');
    }
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      return this.die('TIME EXPIRED — THE MAZE WON');
    }
    if (this.combo > 0 && (this.comboTimer -= dt) <= 0) this.combo = 0;

    // Input pushes the MAZE. Maze moves +d on screen => player travels -d through it.
    const h = input.held;
    let tx = 0, ty = 0;
    if (h.has('left')) tx -= 1;
    if (h.has('right')) tx += 1;
    if (h.has('up')) ty -= 1;
    if (h.has('down')) ty += 1;
    const len = Math.hypot(tx, ty) || 1;
    const k = 1 - Math.pow(0.0001, dt);
    this.vx += ((tx / len) * SPEED - this.vx) * k;
    this.vy += ((ty / len) * SPEED - this.vy) * k;
    let mdx = this.vx * dt, mdy = this.vy * dt;
    if (input.pointer.down) {
      mdx += clamp(input.pointer.dx, -60, 60);
      mdy += clamp(input.pointer.dy, -60, 60);
    }
    const [bx, by] = this.moveBy(-mdx, -mdy);
    if (bx) this.vx = 0;
    if (by) this.vy = 0;
    const m = Math.hypot(mdx, mdy);
    if (m > 0.2) {
      this.lookX = -mdx / m;
      this.lookY = -mdy / m;
    }

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      if (dist(o.x, o.y, this.px, this.py) > R + 12) continue;
      this.orbs.splice(i, 1);
      this.orbsTotal++;
      this.combo++;
      this.comboTimer = 4;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const pts = 100 * Math.min(this.combo, 10);
      this.score += pts;
      this.timeLeft += 2;
      this.fx.burst(o.x, o.y, '#5ef1ff', 22, 200);
      this.fx.popup(o.x, o.y - 22, `+${pts}`, '#ffe45e', this.combo > 1);
      this.fx.popup(o.x, o.y + 12, '+2s', '#5ef1ff');
      sfx('orb');
      if (this.combo > 1) sfx('combo');
    }

    if (dist(this.exit.x, this.exit.y, this.px, this.py) < R + 16) {
      const bonus = 500 * this.level + Math.floor(this.timeLeft) * 10;
      this.score += bonus;
      this.cleared++;
      this.stage++;
      sfx('exit');
      this.build();
      this.fx.particles = [];
      this.fx.popups = [];
      this.fx.burst(this.px, this.py, '#ff5ef0', 40, 300);
      this.fx.popup(this.px, this.py - 70, 'MAZE CLEARED', '#ff5ef0', true);
      this.fx.popup(this.px, this.py - 42, `+${bonus}`, '#ffe45e');
      this.fx.kick(6);
      this.flash = 1;
    }
  }

  private die(reason: string) {
    this.over = true;
    this.reason = reason;
    this.fx.burst(this.px, this.py, '#ff3b6b', 40, 240);
    this.fx.kick(10);
  }

  render(ctx: CanvasRenderingContext2D) {
    const W = MAZE_W, H = MAZE_H;
    const now = performance.now() / 1000;
    ctx.fillStyle = '#04050d';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    this.fx.applyShake(ctx);
    const ox = Math.round(W / 2 - this.px), oy = Math.round(H / 2 - this.py);
    ctx.translate(ox, oy);
    const x0 = Math.max(0, Math.floor(-ox / TILE)), x1 = Math.min(this.tw - 1, Math.floor((W - ox) / TILE));
    const y0 = Math.max(0, Math.floor(-oy / TILE)), y1 = Math.min(this.th - 1, Math.floor((H - oy) / TILE));

    ctx.fillStyle = '#0a0d22';
    ctx.fillRect(0, 0, this.tw * TILE, this.th * TILE);
    ctx.fillStyle = 'rgba(94,241,255,0.12)';
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) if (!this.solid(tx, ty)) ctx.fillRect(tx * TILE + TILE / 2 - 1, ty * TILE + TILE / 2 - 1, 2, 2);

    // walls: fill, then one neon outline path along edges that face open floor
    ctx.fillStyle = '#1a1045';
    const edges = new Path2D();
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!this.solid(tx, ty)) continue;
        const x = tx * TILE, y = ty * TILE;
        ctx.fillRect(x, y, TILE, TILE);
        const open = (ax: number, ay: number) => ax >= 0 && ay >= 0 && ax < this.tw && ay < this.th && !this.solid(ax, ay);
        if (open(tx, ty - 1)) { edges.moveTo(x, y); edges.lineTo(x + TILE, y); }
        if (open(tx, ty + 1)) { edges.moveTo(x, y + TILE); edges.lineTo(x + TILE, y + TILE); }
        if (open(tx - 1, ty)) { edges.moveTo(x, y); edges.lineTo(x, y + TILE); }
        if (open(tx + 1, ty)) { edges.moveTo(x + TILE, y); edges.lineTo(x + TILE, y + TILE); }
      }
    }
    ctx.save();
    ctx.strokeStyle = '#b98cff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#b98cff';
    ctx.shadowBlur = 10;
    ctx.stroke(edges);
    ctx.restore();

    // orbs
    for (const o of this.orbs) {
      const r = 7 + Math.sin(now * 5 + o.x) * 2;
      ctx.save();
      ctx.shadowColor = '#5ef1ff';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#5ef1ff';
      ctx.beginPath();
      ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // exit portal
    const { x: ex, y: ey } = this.exit;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.shadowColor = '#ff5ef0';
    ctx.shadowBlur = 20;
    for (let i = 0; i < 3; i++) {
      ctx.rotate(now * (1.5 + i * 0.6));
      ctx.strokeStyle = i === 1 ? '#ffe45e' : '#ff5ef0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 16 - i * 4, 0, Math.PI * 1.3);
      ctx.stroke();
    }
    ctx.restore();
    label(ctx, 'EXIT', ex, ey - 28, '#ff5ef0', 8);

    this.fx.render(ctx);
    ctx.restore();

    // fog of war centered on the (fixed) player
    const fog = FOG[this.level];
    const g = ctx.createRadialGradient(W / 2, H / 2, fog * 0.45, W / 2, H / 2, fog);
    g.addColorStop(0, 'rgba(4,5,13,0)');
    g.addColorStop(1, 'rgba(4,5,13,0.94)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    this.renderPlayer(ctx, now);

    if (this.timeLeft <= 10 && !this.over) vignette(ctx, W, H, '255,40,90', 0.3 + Math.sin(now * 8) * 0.1);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(185,140,255,${this.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
      label(ctx, `STAGE ${this.stage} · MAZE REWRITTEN`, W / 2, H / 2 + 80, '#ffffff', 11);
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, now: number) {
    const cx = MAZE_W / 2, cy = MAZE_H / 2;
    const moving = Math.hypot(this.vx, this.vy) > 20;

    // exit compass
    const a = Math.atan2(this.exit.y - this.py, this.exit.x - this.px);
    if (dist(this.exit.x, this.exit.y, this.px, this.py) > 90) {
      ctx.save();
      ctx.translate(cx + Math.cos(a) * 42, cy + Math.sin(a) * 42);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(255,94,240,0.85)';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-5, -6);
      ctx.lineTo(-5, 6);
      ctx.fill();
      ctx.restore();
    }

    // "locked" crosshair ticks
    ctx.strokeStyle = 'rgba(94,241,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const t = (i * Math.PI) / 2 + Math.PI / 4;
      ctx.moveTo(cx + Math.cos(t) * (R + 10), cy + Math.sin(t) * (R + 10));
      ctx.lineTo(cx + Math.cos(t) * (R + 17), cy + Math.sin(t) * (R + 17));
    }
    ctx.stroke();

    ctx.save();
    ctx.shadowColor = '#5ef1ff';
    ctx.shadowBlur = 22;
    ctx.fillStyle = this.over ? '#ff3b6b' : '#5ef1ff';
    ctx.beginPath();
    ctx.arc(cx, cy, R + (moving ? 0 : Math.sin(now * 4)), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    for (const s of [-1, 1]) {
      const exx = cx + this.lookX * 4 - this.lookY * 5 * s;
      const eyy = cy + this.lookY * 4 + this.lookX * 5 * s;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(exx, eyy, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#061018';
      ctx.beginPath();
      ctx.arc(exx + this.lookX * 1.4, eyy + this.lookY * 1.4, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.stage === 1 && this.time < 6) {
      label(ctx, 'YOU ARE LOCKED IN PLACE', cx, cy + 46, '#5ef1ff', 9);
      label(ctx, 'PUSH THE MAZE', cx, cy + 64, '#ffe45e', 9);
    }
    if (moving) {
      const arrow = Math.abs(this.vx) > Math.abs(this.vy) ? (this.vx > 0 ? '▶' : '◀') : this.vy > 0 ? '▼' : '▲';
      label(ctx, `MAZE ${arrow}`, MAZE_W / 2, MAZE_H - 18, '#b98cff', 9);
    }
  }

  hud(): HudState {
    const t = Math.ceil(this.timeLeft);
    const low = t <= 10;
    let alert: string | undefined;
    if (low) alert = '⚠ TIME CRITICAL — BRING THE EXIT TO YOU';
    else if (this.stage === 1 && this.time < 6) alert = 'REVERSED: YOU STAY STILL — THE MAZE MOVES';
    return {
      items: [
        { label: 'SCORE', value: String(this.score).padStart(6, '0') },
        { label: 'TIME', value: low ? `${t}s ⚠` : `${t}s`, warn: low },
        { label: 'ORBS', value: `${this.stageOrbs - this.orbs.length}/${this.stageOrbs}` },
        { label: 'STAGE', value: String(this.stage) },
      ],
      alert,
    };
  }

  result() {
    return {
      reason: this.reason,
      rows: [
        ['MAZES CLEARED', String(this.cleared)],
        ['ORBS', String(this.orbsTotal)],
        ['MAX COMBO', `x${Math.max(1, this.maxCombo)}`],
        ['STAGE', String(this.stage)],
      ] as [string, string][],
    };
  }
}
