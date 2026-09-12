import { useEffect, useState } from 'react';
import { isMuted, onMuteChange, setMuted, sfx } from '../audio/audioManager';

export default function SoundToggle() {
  const [muted, set] = useState(isMuted);
  useEffect(() => onMuteChange(set), []);

  const toggle = () => {
    setMuted(!muted);
    if (muted) sfx('click');
  };

  return (
    <button className="btn-icon" onClick={toggle} aria-pressed={!muted} aria-label={muted ? 'Sound is off. Turn sound on' : 'Sound is on. Turn sound off'}>
      <b aria-hidden="true">{muted ? '🔇' : '🔊'}</b>
      <span>SOUND {muted ? 'OFF' : 'ON'}</span>
    </button>
  );
}
