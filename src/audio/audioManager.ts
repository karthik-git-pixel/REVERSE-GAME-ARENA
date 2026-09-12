import { load, save } from '../utils/storage';

export type Sfx =
  | 'click' | 'hover' | 'start' | 'apple' | 'shrink' | 'combo' | 'gate' | 'perfect'
  | 'warning' | 'heartbeat' | 'over' | 'level' | 'orb' | 'exit' | 'tick';

let ac: AudioContext | null = null;
let muted = load<boolean>('muted', false);
const listeners = new Set<(m: boolean) => void>();

function audio() {
  if (!ac) {
    const w = window as unknown as { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext || w.webkitAudioContext;
    ac = new Ctor();
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06, slideTo?: number, delay = 0) {
  const a = audio();
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const arp = (notes: number[], step: number, type: OscillatorType = 'triangle', vol = 0.06) =>
  notes.forEach((n, i) => tone(n, step * 1.6, type, vol, undefined, i * step));

/** Browser-generated arcade blips — no audio assets. */
export function sfx(name: Sfx) {
  if (muted) return;
  try {
    switch (name) {
      case 'click': tone(660, 0.06, 'square', 0.04); break;
      case 'hover': tone(1400, 0.025, 'sine', 0.015); break;
      case 'start': arp([330, 495, 660, 990], 0.07, 'square', 0.04); break;
      case 'apple': tone(880, 0.08, 'square', 0.05, 1320); break;
      case 'shrink': tone(520, 0.22, 'sawtooth', 0.04, 120, 0.05); break;
      case 'combo': arp([990, 1320], 0.06); break;
      case 'gate': tone(700, 0.1, 'triangle', 0.07, 1100); break;
      case 'perfect': arp([784, 988, 1175, 1568], 0.06, 'triangle', 0.07); break;
      case 'warning': tone(240, 0.14, 'square', 0.05); tone(240, 0.14, 'square', 0.05, undefined, 0.2); break;
      case 'heartbeat': tone(80, 0.12, 'sine', 0.3, 50); tone(70, 0.12, 'sine', 0.22, 45, 0.15); break;
      case 'over': tone(440, 0.6, 'sawtooth', 0.06, 50); break;
      case 'level': arp([523, 659, 784, 1046], 0.07, 'square', 0.04); break;
      case 'orb': tone(1046, 0.08, 'sine', 0.08, 1568); break;
      case 'exit': arp([392, 523, 659, 784, 1046, 1318], 0.06, 'triangle', 0.07); break;
      case 'tick': tone(1800, 0.03, 'square', 0.03); break;
    }
  } catch {
    /* audio unavailable */
  }
}

export const isMuted = () => muted;

export function setMuted(m: boolean) {
  muted = m;
  save('muted', m);
  listeners.forEach((l) => l(m));
}

export function onMuteChange(fn: (m: boolean) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
