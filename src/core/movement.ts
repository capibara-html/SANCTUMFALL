import { ALL_DIRS, entityAt, hasTag, key, step, tileAt } from './grid';
import type { Entity, GameState, Vec } from './types';

/** Can `e` walk through tile p (not necessarily stop there)? */
export function canTraverse(s: GameState, e: Entity, p: Vec): boolean {
  const t = tileAt(s, p);
  if (!t) return false;
  if (t.terrain === 'wall') return false;
  if (t.terrain === 'abyss' && !hasTag(e, 'flying') && !hasTag(e, 'aquatic')) return false;
  // Hallowed ground: demons will never set foot on it willingly.
  if (t.consecrated && hasTag(e, 'demon')) return false;
  const occ = entityAt(s, p);
  if (occ && occ !== e) {
    // allies may pass through each other, never through enemies or structures
    if (occ.faction !== e.faction || hasTag(occ, 'structure')) return false;
  }
  return true;
}

/**
 * Breadth-first reachable destinations within the entity's move range.
 * Returns a map tileKey -> path (excluding the start tile).
 */
export function reachable(s: GameState, e: Entity): Map<string, Vec[]> {
  const out = new Map<string, Vec[]>();
  if (e.size !== 1 || e.move <= 0) return out;
  const seen = new Map<string, Vec[]>([[key(e.pos), []]]);
  let frontier: Vec[] = [e.pos];
  for (let d = 0; d < e.move; d++) {
    const next: Vec[] = [];
    for (const p of frontier) {
      for (const dir of ALL_DIRS) {
        const q = step(p, dir);
        const k = key(q);
        if (seen.has(k) || !canTraverse(s, e, q)) continue;
        const path = [...seen.get(key(p))!, q];
        seen.set(k, path);
        next.push(q);
        const occ = entityAt(s, q);
        if (!occ) out.set(k, path);
      }
    }
    frontier = next;
  }
  return out;
}
