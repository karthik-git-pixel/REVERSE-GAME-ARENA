interface Props {
  onResume(): void;
  onRestart(): void;
  onExit(): void;
}

export default function PauseMenu({ onResume, onRestart, onExit }: Props) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className="panel">
        <h2 id="pause-title" className="overlay-title">PAUSED</h2>
        <div className="btn-col">
          <button className="btn primary" autoFocus onClick={onResume}>▶ RESUME</button>
          <button className="btn" onClick={onRestart}>↻ RESTART</button>
          <button className="btn ghost" onClick={onExit}>⏏ EXIT ARENA</button>
        </div>
        <p className="keys">P resume · R restart · ESC exit</p>
      </div>
    </div>
  );
}
