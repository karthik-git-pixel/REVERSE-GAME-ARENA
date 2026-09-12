import type { GameDef } from './types';
import { SnakeEngine, SNAKE_W, SNAKE_H } from './snake/snakeEngine';
import { FlappyEngine, FLAPPY_W, FLAPPY_H } from './flappy/flappyEngine';
import { MazeEngine, MAZE_W, MAZE_H } from './maze/mazeEngine';

/** Add a new reverse game here: an Engine + a definition. The arena and shell pick it up automatically. */
export const GAMES: GameDef[] = [
  {
    id: 'snake',
    title: 'REVERSE SNAKE',
    emoji: '🐍',
    tagline: 'EAT TO GET SMALLER.',
    normal: 'Eat → Grow',
    reverse: 'Eat → SHRINK',
    accent: '#39ffb0',
    overTitle: 'GAME OVER',
    howTo: [
      'Every apple SHRINKS you by 1–2 segments.',
      'At 3 segments: CRITICAL LENGTH — you speed up and the next apple is fatal.',
      'Your tail slowly regrows. Walls, obstacles and your own body kill.',
    ],
    controls: { desktop: 'WASD / ARROWS steer', mobile: 'SWIPE or D-PAD to steer' },
    width: SNAKE_W,
    height: SNAKE_H,
    touch: 'dpad',
    create: () => new SnakeEngine(),
  },
  {
    id: 'flappy',
    title: 'REVERSE FLAPPY',
    emoji: '🐦',
    tagline: "DON'T CONTROL THE BIRD. CONTROL THE WORLD.",
    normal: 'Control the Bird',
    reverse: 'Control the PIPES',
    accent: '#ffe45e',
    overTitle: 'FLIGHT TERMINATED',
    howTo: [
      'The bird flies itself. You cannot touch it.',
      'Slide the NEXT GAP up and down so the bird flies through.',
      'Line the gap up dead-center for PERFECT +250.',
    ],
    controls: { desktop: 'W / ↑ gap up · S / ↓ gap down · or drag', mobile: 'DRAG up/down to move the gap' },
    width: FLAPPY_W,
    height: FLAPPY_H,
    touch: 'drag',
    create: () => new FlappyEngine(),
  },
  {
    id: 'maze',
    title: 'REVERSE MAZE',
    emoji: '🌀',
    tagline: "YOU DON'T MOVE. THE MAZE DOES.",
    normal: 'Move through the Maze',
    reverse: 'Move the MAZE around you',
    accent: '#b98cff',
    overTitle: 'SIGNAL LOST',
    howTo: [
      'You are locked to the center of the screen.',
      'Push or drag the MAZE to bring the EXIT portal to you.',
      'Orbs give points and +2s. Beat the clock.',
    ],
    controls: { desktop: 'WASD / ARROWS push the maze · or drag it', mobile: 'DRAG the maze around you' },
    width: MAZE_W,
    height: MAZE_H,
    touch: 'drag',
    create: () => new MazeEngine(),
  },
];

export const COMING_SOON = [
  { emoji: '🚗', title: 'REVERSE RACING', hint: 'Steer the road, not the car.' },
  { emoji: '🏓', title: 'REVERSE PONG', hint: 'Move the goal, not the paddle.' },
  { emoji: '🧱', title: 'REVERSE TETRIS', hint: 'Rotate the well, not the piece.' },
  { emoji: '🏀', title: 'REVERSE BASKETBALL', hint: 'Move the hoop to the ball.' },
  { emoji: '🏃', title: 'REVERSE RUNNER', hint: 'Drop obstacles. The runner dodges.' },
];

export const getGame = (id: string) => GAMES.find((g) => g.id === id) ?? GAMES[0];
