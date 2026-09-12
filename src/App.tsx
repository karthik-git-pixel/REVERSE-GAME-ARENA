import { useEffect, useState } from 'react';
import ArenaHome from './components/ArenaHome';
import GameShell from './components/GameShell';
import Transition from './components/Transition';
import { GAMES, getGame } from './games/registry';
import { sfx } from './audio/audioManager';
import { reducedMotion } from './utils/fx';

type View = { name: 'home'; returning: boolean } | { name: 'loading' | 'game'; id: string };

export default function App() {
  const [view, setView] = useState<View>({ name: 'home', returning: false });

  useEffect(() => {
    if (view.name !== 'loading') return;
    const id = view.id;
    const t = setTimeout(() => setView({ name: 'game', id }), reducedMotion ? 250 : 850);
    return () => clearTimeout(t);
  }, [view]);

  const play = (id: string) => {
    sfx('click');
    setView({ name: 'loading', id });
  };
  const home = () => setView({ name: 'home', returning: true });
  const other = (id: string) => play(GAMES[(GAMES.findIndex((g) => g.id === id) + 1) % GAMES.length].id);

  if (view.name === 'home') return <ArenaHome onPlay={play} returning={view.returning} />;
  const def = getGame(view.id);
  if (view.name === 'loading') return <Transition def={def} />;
  return <GameShell key={def.id} def={def} onExit={home} onSwitch={() => other(def.id)} />;
}
