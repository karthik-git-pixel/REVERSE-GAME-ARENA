import type { CSSProperties, ReactNode } from 'react';
import type { GameDef } from '../games/types';
import { sfx } from '../audio/audioManager';

const PREVIEWS: Record<string, ReactNode> = {
  snake: (
    <>
      <div className="pv-snake">
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <b className="pv-apple" />
      <em className="pv-tag">-1</em>
    </>
  ),
  flappy: (
    <>
      <i className="pv-bird" />
      <div className="pv-pipe">
        <div className="pv-slide">
          <b />
          <b />
        </div>
      </div>
    </>
  ),
  maze: (
    <>
      <div className="pv-maze-grid" />
      <i className="pv-dot" />
    </>
  ),
};

interface Props {
  def: GameDef;
  index: number;
  onPlay(): void;
}

export default function GameCard({ def, index, onPlay }: Props) {
  const style = { '--accent': def.accent, animationDelay: `${index * 0.08}s` } as CSSProperties;
  return (
    <article className="card" style={style} onMouseEnter={() => sfx('hover')}>
      <div className={`preview pv-${def.id}-wrap`} aria-hidden="true" onClick={onPlay}>
        {PREVIEWS[def.id]}
      </div>
      <div className="card-body">
        <h3>
          <span aria-hidden="true">{def.emoji}</span> {def.title}
        </h3>
        <div className="rules">
          <div className="rule normal">
            <span>NORMAL</span>
            <p>{def.normal}</p>
          </div>
          <div className="rule reverse">
            <span>REVERSE</span>
            <p>{def.reverse}</p>
          </div>
        </div>
        <button className="btn primary" onClick={onPlay} aria-label={`Play ${def.title}`}>
          ▶ PLAY
        </button>
      </div>
    </article>
  );
}
