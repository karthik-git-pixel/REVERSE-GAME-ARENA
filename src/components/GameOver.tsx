import { useEffect, useState } from 'react';
import type { GameDef, GameResult } from '../games/types';

export interface OverData extends GameResult {
  score: number;
  best: number;
  isNew: boolean;
}

interface Props {
  def: GameDef;
  data: OverData;
  onRestart(): void;
  onSwitch(): void;
  onExit(): void;
}

export default function GameOver({ def, data, onRestart, onSwitch, onExit }: Props) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      setShown(Math.round(data.score * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data.score]);

  return (
    <div className="overlay over" role="dialog" aria-modal="true" aria-labelledby="over-title">
      <div className="panel">
        <h2 id="over-title" className="overlay-title glitch" data-text={def.overTitle}>{def.overTitle}</h2>
        <p className="reason">{data.reason}</p>
        <div className="final">
          <span>YOUR SCORE</span>
          <strong aria-label={String(data.score)}>{shown.toLocaleString()}</strong>
          {data.isNew && <em className="new-best">★ NEW PERSONAL BEST ★</em>}
        </div>
        <dl className="stats">
          <div>
            <dt>BEST SCORE</dt>
            <dd>{data.best.toLocaleString()}</dd>
          </div>
          {data.rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="btn-col">
          <button className="btn primary" autoFocus onClick={onRestart}>
            ↻ {def.id === 'flappy' ? 'TRY AGAIN' : 'PLAY AGAIN'}
          </button>
          <button className="btn" onClick={onSwitch}>⇄ TRY OTHER GAME</button>
          <button className="btn ghost" onClick={onExit}>⏏ BACK TO ARENA</button>
        </div>
      </div>
    </div>
  );
}
