import type { CSSProperties } from 'react';
import type { GameDef } from '../games/types';

export default function Transition({ def }: { def: GameDef }) {
  return (
    <div className="transition" style={{ '--accent': def.accent } as CSSProperties} role="status" aria-live="polite">
      <div className="tr-emoji" aria-hidden="true">{def.emoji}</div>
      <p className="tr-line">
        INITIALIZING REVERSE PROTOCOL<span className="dots" />
      </p>
      <p className="tr-rule">
        <s>{def.normal}</s> <span aria-hidden="true">→</span> <b>{def.reverse}</b>
      </p>
      <div className="tr-bar">
        <i />
      </div>
      <p className="tr-sub">REWRITING THE RULES...</p>
    </div>
  );
}
