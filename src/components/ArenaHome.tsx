import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { COMING_SOON, GAMES } from '../games/registry';
import { getBest } from '../utils/storage';
import { sfx } from '../audio/audioManager';
import { reducedMotion } from '../utils/fx';
import GameCard from './GameCard';
import SoundToggle from './SoundToggle';
import ParticleField from './ParticleField';

interface Props {
  onPlay(id: string): void;
  returning: boolean;
}

export default function ArenaHome({ onPlay, returning }: Props) {
  const [lore, setLore] = useState(false);
  const gamesRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (returning) gamesRef.current?.scrollIntoView({ block: 'start' });
  }, [returning]);

  const closeLore = useCallback(() => {
    setLore(false);
    gamesRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    gamesRef.current?.querySelector<HTMLButtonElement>('.card .btn')?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!lore) return;
    const t = setTimeout(closeLore, reducedMotion ? 1400 : 2700);
    return () => clearTimeout(t);
  }, [lore, closeLore]);

  const enter = () => {
    sfx('start');
    setLore(true);
  };

  return (
    <main className="home">
      <ParticleField />
      <nav className="topbar">
        <div className="logo">
          REVERSE<span>//</span>ARENA
        </div>
        <SoundToggle />
      </nav>

      <section className="hero">
        <img src="/neon.png" alt="Neon Mascot" className="hero-mascot" />
        <p className="eyebrow">▸ EXPERIMENTAL ARCADE · {GAMES.length} PROTOCOLS ONLINE</p>
        <h1 className="hero-title">
          <span className="flip-word" aria-label="Reverse">
            {'REVERSE'.split('').map((ch, i) => (
              <span key={i} aria-hidden="true" style={{ animationDelay: `${i * 0.12}s` }}>
                {ch}
              </span>
            ))}
          </span>
          <span className="glitch" data-text="GAME ARENA">GAME ARENA</span>
        </h1>
        <p className="motto">
          "You don't control the hero.
          <br />
          You control the game."
        </p>
        <p className="sub">
          Familiar games. <em>Completely wrong rules.</em>
        </p>
        <p className="support">Step into a collection of games where the rules you know have been turned upside down.</p>
        <button className="btn primary big pulse" onClick={enter}>
          [ ENTER THE ARENA ]
        </button>

        <div className="bests" aria-label="Personal best scores">
          <span className="bests-label">PERSONAL BEST</span>
          {GAMES.map((g) => (
            <div key={g.id} className="best-chip" style={{ '--accent': g.accent } as CSSProperties}>
              <span aria-hidden="true">{g.emoji}</span> {g.title.replace('REVERSE ', '')}
              <strong>{getBest(g.id).toLocaleString()}</strong>
            </div>
          ))}
        </div>
        <div className="hero-floor" aria-hidden="true" />
      </section>

      <section className="games" id="games" ref={gamesRef} aria-labelledby="games-title">
        <h2 id="games-title" className="section-title">
          CHOOSE YOUR <span>REVERSE</span> GAME
        </h2>
        <div className="card-grid">
          {GAMES.map((g, i) => (
            <GameCard key={g.id} def={g} index={i} onPlay={() => onPlay(g.id)} />
          ))}
        </div>

        <h3 className="section-title small">COMING SOON</h3>
        <div className="soon-grid">
          {COMING_SOON.map((s) => (
            <div className="soon" key={s.title}>
              <span className="soon-emoji" aria-hidden="true">{s.emoji}</span>
              <strong>{s.title}</strong>
              <small>{s.hint}</small>
              <em>🔒 LOCKED</em>
            </div>
          ))}
        </div>
      </section>

      <footer className="foot">REVERSE GAME ARENA · P PAUSE · R RESTART · ESC EXIT</footer>

      {lore && (
        <div className="lore" role="dialog" aria-modal="true" aria-label="System message" onClick={closeLore}>
          <div className="terminal">
            <p className="t-head">SYSTEM MESSAGE</p>
            <p style={{ animationDelay: '0.1s' }}>&gt; STANDARD GAME RULES DETECTED.</p>
            <p style={{ animationDelay: '0.6s' }}>&gt; OVERRIDING...</p>
            <p className="ok" style={{ animationDelay: '1.1s' }}>&gt; REVERSE PROTOCOL ACTIVE.</p>
            <p className="welcome" style={{ animationDelay: '1.6s' }}>WELCOME TO THE REVERSE GAME ARENA.</p>
            <button className="skip" autoFocus onClick={closeLore}>SKIP ▸</button>
          </div>
        </div>
      )}
    </main>
  );
}
