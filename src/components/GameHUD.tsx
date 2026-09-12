import type { HudState } from '../games/types';

export default function GameHUD({ hud, best }: { hud: HudState; best: number }) {
  const danger = hud.alert?.startsWith('⚠');
  return (
    <div className="hud">
      <div className="hud-row">
        {hud.items.map((i) => (
          <div key={i.label} className={`hud-item${i.warn ? ' warn' : ''}`}>
            <span>{i.label}</span>
            <strong>{i.value}</strong>
          </div>
        ))}
        <div className="hud-item best">
          <span>BEST</span>
          <strong>{String(best).padStart(6, '0')}</strong>
        </div>
      </div>
      <div className={`hud-alert${hud.alert ? ' on' : ''}${danger ? ' danger' : ''}`} role="status" aria-live="polite">
        {hud.alert ?? ' '}
      </div>
    </div>
  );
}
