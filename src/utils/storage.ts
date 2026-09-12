const PREFIX = 'rga:';

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode etc.) */
  }
}

export const getBest = (id: string) => load<number>('best:' + id, 0);

/** Returns true when the score is a new personal best. */
export function submitScore(id: string, score: number): boolean {
  if (score <= getBest(id)) return false;
  save('best:' + id, score);
  return true;
}
