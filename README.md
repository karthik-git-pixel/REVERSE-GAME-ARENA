# REVERSE GAME ARENA

> You don't control the hero. You control the game.

A browser arcade of familiar games with their core rule flipped. Built with React, TypeScript, Vite and HTML5 Canvas. There are no game engines, no audio files and no runtime dependencies besides React.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle in dist/
```

## Games

| Game | Normal | Reverse |
|---|---|---|
| 🐍 Reverse Snake | Eat → grow | Eat → **shrink**. At 3 segments you're critical and the next apple kills you. |
| 🐦 Reverse Flappy | Control the bird | The bird flies itself. **You move the pipe gap.** |
| 🌀 Reverse Maze | Move through the maze | You're locked in place. **You move the maze.** |

**Controls:** WASD / arrow keys · `P` pause · `R` restart · `ESC` back to arena.
**Mobile:** swipe or D-pad for Snake. Drag for Flappy and Maze.

## Adding a game

1. Create `src/games/<name>/<name>Engine.ts` implementing the `Engine` interface in `src/games/types.ts` (`update`, `render`, `hud`, `result`).
2. Add a `GameDef` entry to `GAMES` in `src/games/registry.ts`.

The arena cards, loading transition, HUD, pause and game-over screens, high scores and input handling all come from `GameShell`.

## Structure

```
src/
  App.tsx                 view routing (arena → transition → game)
  components/             ArenaHome, GameCard, GameShell, GameHUD, PauseMenu, GameOver, Transition
  games/types.ts          Engine / GameDef contracts
  games/registry.ts       playable + coming-soon games
  games/{snake,flappy,maze}/*Engine.ts
  hooks/                  useGameLoop (rAF), useKeyboard
  audio/audioManager.ts   WebAudio-generated SFX + mute persistence
  utils/                  fx (particles/popups/shake), collision, random, storage
```

Per-frame game state lives inside the engines, not in React. The HUD re-renders at most 10 times per second, and only when a value changes.
