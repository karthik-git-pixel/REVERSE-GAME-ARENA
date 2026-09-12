import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { newInput } from '../games/types';
import type { Dir, GameDef, HudState } from '../games/types';
import { useGameLoop } from '../hooks/useGameLoop';
import { KEY_DIRS, useKeyboard } from '../hooks/useKeyboard';
import { sfx } from '../audio/audioManager';
import { getBest, submitScore } from '../utils/storage';
import GameHUD from './GameHUD';
import PauseMenu from './PauseMenu';
import GameOver from './GameOver';
import type { OverData } from './GameOver';
import SoundToggle from './SoundToggle';

type Status = 'ready' | 'playing' | 'paused' | 'over';

interface Props {
  def: GameDef;
  onExit(): void;
  onSwitch(): void;
}

const ARROWS: Record<Dir, string> = { up: '▲', down: '▼', left: '◀', right: '▶' };

/** Shared frame for every reverse game: loop, input, HUD, pause, restart, game over. */
export default function GameShell({ def, onExit, onSwitch }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [initialEngine] = useState(() => def.create());
  const engine = useRef(initialEngine);
  const input = useRef(newInput());
  const statusRef = useRef<Status>('ready');
  const dying = useRef(0);
  const hudTimer = useRef(0);
  const hudKey = useRef('');
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const [status, setStatusState] = useState<Status>('ready');
  const [hud, setHud] = useState<HudState>(() => initialEngine.hud());
  const [best, setBest] = useState(() => getBest(def.id));
  const [over, setOver] = useState<OverData | null>(null);

  const setStatus = useCallback((s: Status) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const start = useCallback(() => {
    if (statusRef.current !== 'ready') return;
    sfx('start');
    setStatus('playing');
  }, [setStatus]);

  const restart = useCallback(() => {
    engine.current = def.create();
    input.current = newInput();
    dying.current = 0;
    hudKey.current = '';
    setOver(null);
    setBest(getBest(def.id));
    setHud(engine.current.hud());
    sfx('start');
    setStatus('playing');
  }, [def, setStatus]);

  const togglePause = useCallback(() => {
    const s = statusRef.current;
    if (s === 'playing') {
      input.current.held.clear();
      input.current.pointer.down = false;
      setStatus('paused');
      sfx('click');
    } else if (s === 'paused') {
      setStatus('playing');
      sfx('click');
    }
  }, [setStatus]);

  const exit = useCallback(() => {
    sfx('click');
    onExit();
  }, [onExit]);

  // hi-dpi backing store; the engine always draws in logical def.width x def.height units
  useEffect(() => {
    const c = canvasRef.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(def.width * dpr);
    c.height = Math.round(def.height * dpr);
  }, [def]);

  // auto-pause when the tab/window loses focus
  useEffect(() => {
    const pause = () => statusRef.current === 'playing' && togglePause();
    const onVis = () => document.hidden && pause();
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [togglePause]);

  useGameLoop((dt) => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const eng = engine.current;
    const inp = input.current;
    const s = statusRef.current;

    if (s === 'playing') {
      eng.update(dt, inp);
      inp.presses.length = 0;
      inp.pointer.dx = 0;
      inp.pointer.dy = 0;
      if (eng.over) {
        if (dying.current === 0) sfx('over');
        dying.current += dt;
        if (dying.current > 0.9) {
          const isNew = submitScore(def.id, eng.score);
          setOver({ ...eng.result(), score: eng.score, best: getBest(def.id), isNew });
          setStatus('over');
        }
      }
    } else if (s === 'over') {
      eng.update(dt, inp); // lets death particles settle behind the overlay
    }

    ctx.setTransform(c.width / def.width, 0, 0, c.height / def.height, 0, 0);
    eng.render(ctx);

    // HUD is React, so throttle + diff to avoid per-frame re-renders
    if ((hudTimer.current += dt) > 0.1) {
      hudTimer.current = 0;
      const h = eng.hud();
      const key = JSON.stringify(h);
      if (key !== hudKey.current) {
        hudKey.current = key;
        setHud(h);
      }
    }
  });

  useKeyboard((e, down) => {
    const s = statusRef.current;
    const dir = KEY_DIRS[e.code];
    if (dir) {
      if (s === 'playing' || s === 'ready') e.preventDefault();
      const inp = input.current;
      if (down) {
        if (!e.repeat) inp.presses.push(dir);
        inp.held.add(dir);
        if (s === 'ready') start();
      } else inp.held.delete(dir);
      return;
    }
    if (!down || e.repeat) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      exit();
    } else if (e.code === 'KeyP') togglePause();
    else if (e.code === 'KeyR') restart();
    else if ((e.code === 'Space' || e.code === 'Enter') && s === 'ready') {
      e.preventDefault();
      start();
    }
  });

  const toLocal = (e: ReactPointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * def.width, y: ((e.clientY - r.top) / r.height) * def.height };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (statusRef.current === 'ready') start();
    if (statusRef.current !== 'playing') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = input.current.pointer;
    const l = toLocal(e);
    p.down = true;
    p.x = l.x;
    p.y = l.y;
    swipe.current = l;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = input.current.pointer;
    if (!p.down) return;
    const l = toLocal(e);
    p.dx += l.x - p.x;
    p.dy += l.y - p.y;
    p.x = l.x;
    p.y = l.y;
    const s0 = swipe.current;
    if (def.touch === 'dpad' && s0) {
      const dx = l.x - s0.x, dy = l.y - s0.y;
      if (Math.hypot(dx, dy) > 28) {
        input.current.presses.push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
        swipe.current = l;
      }
    }
  };

  const onPointerUp = () => {
    input.current.pointer.down = false;
    swipe.current = null;
  };

  const press = (d: Dir) => {
    if (statusRef.current === 'ready') start();
    input.current.presses.push(d);
  };

  const style = { '--accent': def.accent, '--ar': def.width / def.height } as CSSProperties;

  return (
    <div className="shell" style={style}>
      <header className="shell-top">
        <button className="btn-icon" onClick={exit} aria-label="Back to arena (Escape)">
          <b aria-hidden="true">←</b>
          <span>ARENA</span>
        </button>
        <div className="shell-title">
          <h1>
            <span aria-hidden="true">{def.emoji}</span> {def.title}
          </h1>
          <p>{def.tagline}</p>
        </div>
        <div className="shell-actions">
          <SoundToggle />
          <button
            className="btn-icon"
            onClick={togglePause}
            disabled={status === 'ready' || status === 'over'}
            aria-label={status === 'paused' ? 'Resume (P)' : 'Pause (P)'}
          >
            <b aria-hidden="true">{status === 'paused' ? '▶' : '❚❚'}</b>
          </button>
        </div>
      </header>

      <div className="play">
        <GameHUD hud={hud} best={Math.max(best, engine.current.score)} />
        <div className="stage" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <canvas ref={canvasRef} role="img" aria-label={`${def.title} play field`} />
        </div>
        <p className="hint">
          <span className="desk">{def.controls.desktop} · P pause · R restart · ESC arena</span>
          <span className="touch">{def.controls.mobile}</span>
        </p>
      </div>

      {def.touch === 'dpad' && (
        <div className="dpad">
          {(['up', 'left', 'right', 'down'] as Dir[]).map((d) => (
            <button
              key={d}
              className={`dpad-${d}`}
              tabIndex={-1}
              aria-label={`Steer ${d}`}
              onPointerDown={(e) => {
                e.preventDefault();
                press(d);
              }}
            >
              {ARROWS[d]}
            </button>
          ))}
        </div>
      )}

      {status === 'ready' && <ReadyCard def={def} onStart={start} />}
      {status === 'paused' && <PauseMenu onResume={togglePause} onRestart={restart} onExit={exit} />}
      {status === 'over' && over && <GameOver def={def} data={over} onRestart={restart} onSwitch={onSwitch} onExit={exit} />}
    </div>
  );
}

function ReadyCard({ def, onStart }: { def: GameDef; onStart(): void }) {
  return (
    <div className="overlay ready" role="dialog" aria-modal="true" aria-labelledby="ready-title" onClick={onStart}>
      <div className="panel">
        <div className="ready-emoji" aria-hidden="true">{def.emoji}</div>
        <h2 id="ready-title" className="overlay-title">{def.title}</h2>
        <p className="tagline">{def.tagline}</p>
        <div className="flip">
          <div className="flip-normal">
            <span>NORMAL</span>
            <s>{def.normal}</s>
          </div>
          <div className="flip-arrow" aria-hidden="true">⇄</div>
          <div className="flip-reverse">
            <span>REVERSE</span>
            <b>{def.reverse}</b>
          </div>
        </div>
        <ul className="howto">
          {def.howTo.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <button
          className="btn primary big"
          autoFocus
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
        >
          ▶ START
        </button>
        <p className="keys">
          <span className="desk">or press any arrow / WASD key</span>
          <span className="touch">or tap anywhere</span>
        </p>
      </div>
    </div>
  );
}
