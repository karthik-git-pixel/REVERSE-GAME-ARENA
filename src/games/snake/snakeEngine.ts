import type { Dir, Engine, HudState, Input } from '../types';
import { Fx, drawGrid, vignette, label } from '../../utils/fx';
import { sfx } from '../../audio/audioManager';
import { lerp, randInt } from '../../utils/random';

const COLS = 14;
const ROWS = 14;
const CELL = 30;
export const SNAKE_W = COLS * CELL;
export const SNAKE_H = ROWS * CELL;

const START_LEN = 8;
const MIN_LEN = 3;
const MAX_LEN = 18;
const APPLES_PER_LEVEL = 4;
// index = level (1..5)
const TICK = [0, 0.16, 0.14, 0.13, 0.115, 0.1];
const OBSTACLES = [0, 0, 0, 4, 8, 13];
const REGROW = [0, 4.5, 4.2, 4, 3.6, 3.2];

const VEC: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

interface P { x: number; y: number }
const center = (p: P) => [p.x * CELL + CELL / 2, p.y * CELL + CELL / 2] as const;

export class SnakeEngine implements Engine {
  over = false;
  score = 0;

  private snake: P[] = [];
  private prev: P[] = [];
  private dir: Dir = 'right';
  private queue: Dir[] = [];
  private activeApples: P[] = [];
  private obstacles: P[] = [];
  private ghosts: { x: number; y: number; life: number }[] = [];
  private fx = new Fx();
  private tick = 0;
  private time = 0;
  private survival = 0;
  private regrow = 0;
  private combo = 0;
  private comboTimer = 0;
  private maxCombo = 0;
  private apples = 0;
  private level = 1;
  private critical = false;
  private reason = '';

  constructor() {
    for (let i = 0; i < START_LEN; i++) this.snake.push({ x: 9 - i, y: 10 });
    this.prev = this.snake.map((p) => ({ ...p }));
    this.placeApples();
  }

  private blocked(x: number, y: number) {
    return this.snake.some((s) => s.x === x && s.y === y) || this.obstacles.some((o) => o.x === x && o.y === y);
  }

  private placeApples() {
    const head = this.snake[0];
    const numApples = 8;
    while (this.activeApples.length < numApples) {
      let placed = false;

      for (let i = 0; i < 400; i++) {
        const x = randInt(1, COLS - 2);
        const y = randInt(1, ROWS - 2);

        if (!this.blocked(x, y) && !this.activeApples.some(a => a.x === x && a.y === y) && Math.abs(x - head.x) + Math.abs(y - head.y) > 3) {
          this.activeApples.push({ x, y });
          placed = true;
          break;
        }
      }
      if (!placed) break; // prevent infinite loop if full
    }
  }

  private addObstacles(target: number) {
    const head = this.snake[0];
    const [vx, vy] = VEC[this.dir];
    let tries = 0;
    while (this.obstacles.length < target && tries++ < 500) {
      const x = randInt(1, COLS - 2);
      const y = randInt(1, ROWS - 2);
      const ahead = (vx !== 0 && y === head.y) || (vy !== 0 && x === head.x);
      if (this.blocked(x, y) || this.activeApples.some(a => x === a.x && y === a.y)) continue;
      if (Math.abs(x - head.x) + Math.abs(y - head.y) < 5 || ahead) continue;
      this.obstacles.push({ x, y });
      const [cx, cy] = center({ x, y });
      this.fx.burst(cx, cy, '#ff5ef0', 10, 90);
    }
  }

  private enqueue(d: Dir) {
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (d === last || d === OPP[last] || this.queue.length >= 2) return;
    this.queue.push(d);
  }

  update(dt: number, input: Input) {
    this.fx.update(dt);
    for (const g of this.ghosts) g.life += dt;
    this.ghosts = this.ghosts.filter((g) => g.life < 0.5);
    if (this.over) return;

    for (const d of input.presses) this.enqueue(d);
    this.time += dt;
    this.survival += dt;
    while (this.survival >= 1) {
      this.survival -= 1;
      this.score += 10;
    }
    if (this.combo > 0 && (this.comboTimer -= dt) <= 0) this.combo = 0;
    this.regrow = Math.min(this.regrow + dt, REGROW[this.level] + 0.01);

    const interval = TICK[this.level] * (this.critical ? 0.72 : 1);
    this.tick += dt;
    while (this.tick >= interval && !this.over) {
      this.tick -= interval;
      this.step();
    }
  }

  private step() {
    if (this.queue.length) this.dir = this.queue.shift()!;
    this.prev = this.snake.map((p) => ({ ...p }));
    const [vx, vy] = VEC[this.dir];
    const nx = this.snake[0].x + vx;
    const ny = this.snake[0].y + vy;

    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return this.die('YOU HIT THE ARENA WALL');
    if (this.obstacles.some((o) => o.x === nx && o.y === ny)) return this.die('YOU CRASHED INTO AN OBSTACLE');
    const grow = this.regrow >= REGROW[this.level] && this.snake.length < MAX_LEN;
    const body = grow ? this.snake : this.snake.slice(0, -1);
    if (body.some((s) => s.x === nx && s.y === ny)) return this.die('YOU BIT YOUR OWN TAIL');

    this.snake.unshift({ x: nx, y: ny });
    if (grow) {
      this.regrow = 0;
      const [tx, ty] = center(this.snake[this.snake.length - 1]);
      this.fx.popup(tx, ty - 8, '+1', '#5ef1ff');
    } else {
      this.snake.pop();
    }
    const eatIndex = this.activeApples.findIndex(a => nx === a.x && ny === a.y);
    if (eatIndex !== -1) this.eat(eatIndex);
    this.setCritical(this.snake.length <= MIN_LEN);
  }

  private setCritical(on: boolean) {
    if (on && !this.critical) {
      sfx('warning');
      this.fx.kick(8);
    }
    this.critical = on;
  }

  private eat(index: number) {
    const apple = this.activeApples[index];
    this.activeApples.splice(index, 1);
    const [cx, cy] = center(apple);
    if (this.snake.length <= MIN_LEN) {
      this.fx.burst(cx, cy, '#ff3b6b', 50, 280);
      return this.die('THE LAST APPLE ATE YOU. NOTHING LEFT.');
    }
    this.apples++;
    this.combo++;
    this.comboTimer = 5;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const pts = 100 * Math.min(this.combo, 10);
    this.score += pts;

    const want = this.level >= 3 && Math.random() < 0.5 ? 2 : 1;
    const cut = Math.min(want, this.snake.length - MIN_LEN);
    for (let i = 0; i < cut; i++) {
      const t = this.snake.pop()!;
      this.ghosts.push({ ...t, life: 0 });
      const [tx, ty] = center(t);
      this.fx.burst(tx, ty, '#39ffb0', 12, 140);
      if (i === cut - 1) this.fx.popup(tx, ty - 6, `-${cut}`, '#39ffb0', true);
    }

    this.fx.burst(cx, cy, '#ff3b6b', 26, 230);
    this.fx.popup(cx, cy - 16, `+${pts}`, '#ffe45e', this.combo > 1);
    if (this.combo > 1) {
      this.fx.popup(cx, cy + 14, `COMBO x${this.combo}`, '#ff5ef0');
      sfx('combo');
    }
    this.fx.kick(5);
    sfx('apple');
    sfx('shrink');

    const lvl = Math.min(5, 1 + Math.floor(this.apples / APPLES_PER_LEVEL));
    if (lvl > this.level) {
      this.level = lvl;
      sfx('level');
      this.fx.popup(SNAKE_W / 2, SNAKE_H / 2, `LEVEL ${lvl}`, '#5ef1ff', true);
      this.addObstacles(OBSTACLES[lvl]);
    }
    this.placeApples();
  }

  private die(reason: string) {
    this.over = true;
    this.reason = reason;
    const [hx, hy] = center(this.snake[0]);
    this.fx.burst(hx, hy, '#39ffb0', 40, 260);
    this.fx.kick(14);
  }

  render(ctx: CanvasRenderingContext2D) {
    const now = performance.now() / 1000;
    ctx.fillStyle = this.critical ? '#12050c' : '#060814';
    ctx.fillRect(0, 0, SNAKE_W, SNAKE_H);
    ctx.save();
    this.fx.applyShake(ctx);
    drawGrid(ctx, SNAKE_W, SNAKE_H, CELL, this.critical ? 'rgba(255,59,107,0.09)' : 'rgba(94,241,255,0.06)');

    // arena border (pulses red on level 5 "dangerous arena")
    const danger = this.level >= 5 ? 0.5 + Math.sin(now * 5) * 0.5 : 0;
    ctx.strokeStyle = danger ? `rgba(255,59,107,${0.4 + danger * 0.6})` : 'rgba(94,241,255,0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, SNAKE_W - 3, SNAKE_H - 3);

    // obstacles
    for (const o of this.obstacles) {
      const x = o.x * CELL + 3, y = o.y * CELL + 3, s = CELL - 6;
      ctx.fillStyle = '#2a0b2e';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#ff5ef0';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, s, s);
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 5); ctx.lineTo(x + s - 5, y + s - 5);
      ctx.moveTo(x + s - 5, y + 5); ctx.lineTo(x + 5, y + s - 5);
      ctx.stroke();
    }

    // removed tail segments fading out
    for (const g of this.ghosts) {
      const k = g.life / 0.5;
      const pad = 2 - k * 8;
      ctx.strokeStyle = `rgba(57,255,176,${1 - k})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(g.x * CELL + pad, g.y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
    }

    // apples
    for (const apple of this.activeApples) {
      const [ax, ay] = center(apple);
      const pulse = Math.sin(now * 6) * 2;
      ctx.save();
      ctx.shadowColor = '#ff3b6b';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ff3b6b';
      ctx.beginPath();
      ctx.arc(ax, ay + 1, 9 + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#39ffb0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay - 8);
      ctx.quadraticCurveTo(ax + 4, ay - 14, ax + 7, ay - 13);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = now * 2 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = 'rgba(255,228,94,0.8)';
        ctx.fillRect(ax + Math.cos(a) * 16 - 1, ay + Math.sin(a) * 16 - 1, 2, 2);
      }
    }

    this.renderSnake(ctx, now);
    this.fx.render(ctx);
    ctx.restore();

    if (this.critical && !this.over) {
      vignette(ctx, SNAKE_W, SNAKE_H, '255,30,80', 0.35 + Math.sin(now * 8) * 0.12);
      label(ctx, '⚠ CRITICAL LENGTH', SNAKE_W / 2, 22, '#ff3b6b', 11);
    }
  }

  private renderSnake(ctx: CanvasRenderingContext2D, now: number) {
    const t = this.over ? 1 : Math.min(1, this.tick / (TICK[this.level] * (this.critical ? 0.72 : 1)));
    const pts = this.snake.map((s, i) => {
      const p = this.prev[i] ?? s;
      return [lerp(p.x, s.x, t) * CELL + CELL / 2, lerp(p.y, s.y, t) * CELL + CELL / 2] as const;
    });
    const bodyColor = this.critical ? (Math.sin(now * 12) > 0 ? '#ffb13b' : '#ff3b6b') : '#39ffb0';

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = CELL * 0.62;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.1, pts[0][1]);
    ctx.stroke();
    ctx.restore();

    // segment markers
    for (let i = 1; i < pts.length; i++) {
      ctx.fillStyle = `rgba(5,20,30,${0.35 + (i / pts.length) * 0.3})`;
      ctx.beginPath();
      ctx.arc(pts[i][0], pts[i][1], CELL * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }

    // head + eyes
    const [hx, hy] = pts[0];
    const [vx, vy] = VEC[this.dir];
    ctx.fillStyle = '#eafff6';
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(hx, hy, CELL * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    const eyeR = this.critical ? 5 : 4;
    for (const side of [-1, 1]) {
      const ex = hx + vx * 4 - vy * 6 * side;
      const ey = hy + vy * 4 + vx * 6 * side;
      if (this.over) {
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ex - 3, ey - 3); ctx.lineTo(ex + 3, ey + 3);
        ctx.moveTo(ex + 3, ey - 3); ctx.lineTo(ex - 3, ey + 3);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#081018';
      ctx.beginPath();
      ctx.arc(ex + vx * 1.6, ey + vy * 1.6, this.critical ? 1.6 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  hud(): HudState {
    const len = this.snake.length;
    let alert: string | undefined;
    if (this.critical) alert = '⚠ CRITICAL LENGTH — ONE MORE APPLE IS FATAL';
    else if (this.time < 5) alert = 'REVERSED: EVERY APPLE MAKES YOU SHORTER';
    return {
      items: [
        { label: 'SCORE', value: String(this.score).padStart(6, '0') },
        { label: 'LENGTH', value: this.critical ? `${len} ⚠` : String(len), warn: this.critical },
        { label: 'COMBO', value: `x${Math.max(1, this.combo)}` },
        { label: 'LEVEL', value: String(this.level) },
      ],
      alert,
    };
  }

  result() {
    return {
      reason: this.reason,
      rows: [
        ['APPLES', String(this.apples)],
        ['MAX COMBO', `x${Math.max(1, this.maxCombo)}`],
        ['LEVEL', String(this.level)],
        ['SURVIVED', `${Math.floor(this.time)}s`],
      ] as [string, string][],
    };
  }
}
