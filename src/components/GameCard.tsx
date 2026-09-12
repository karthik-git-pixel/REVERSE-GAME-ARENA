import type { CSSProperties } from 'react';
import type { GameDef } from '../games/types';
import { sfx } from '../audio/audioManager';



interface Props {
  def: GameDef;
  index: number;
  onPlay(): void;
}

export default function GameCard({ def, index, onPlay }: Props) {
  const style = { '--accent': def.accent, animationDelay: `${index * 0.08}s` } as CSSProperties;
  return (
    <article className="card" style={style} onMouseEnter={() => sfx('hover')}>

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
