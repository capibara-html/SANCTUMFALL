// Campaign progress, remembered in this browser only. Storage can be missing
// or blocked (private windows), so every access is guarded.
const KEY = 'sanctumfall.progress.v1';

export interface Progress {
  cleared: string[];
  muted: boolean;
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      return { cleared: Array.isArray(p.cleared) ? p.cleared : [], muted: !!p.muted };
    }
  } catch {
    /* ignore */
  }
  return { cleared: [], muted: false };
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
