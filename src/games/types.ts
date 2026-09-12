export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Input {
  held: Set<Dir>;
  presses: Dir[];
  pointer: { down: boolean; x: number; y: number; dx: number; dy: number };
}

export interface HudItem {
  label: string;
  value: string;
  warn?: boolean;
}

export interface HudState {
  items: HudItem[];
  alert?: string;
}

export interface GameResult {
  reason: string;
  rows: [string, string][];
}

/** Every game engine implements this; GameShell drives it. */
export interface Engine {
  over: boolean;
  score: number;
  update(dt: number, input: Input): void;
  render(ctx: CanvasRenderingContext2D): void;
  hud(): HudState;
  result(): GameResult;
}

export interface GameDef {
  id: string;
  title: string;
  emoji: string;
  tagline: string;
  normal: string;
  reverse: string;
  accent: string;
  overTitle: string;
  howTo: string[];
  controls: { desktop: string; mobile: string };
  width: number;
  height: number;
  touch: 'dpad' | 'drag';
  create(): Engine;
}

export const newInput = (): Input => ({
  held: new Set(),
  presses: [],
  pointer: { down: false, x: 0, y: 0, dx: 0, dy: 0 },
});
