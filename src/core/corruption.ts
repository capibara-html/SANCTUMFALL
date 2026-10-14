// The Taint: wounds spread corruption and birth demons. Both are announced a
// round in advance (pendingSpread / spawnMarkers) so the player can answer
// them — hallowing a threatened tile or standing on a spawn site.
import { RULES } from './rules';
import { getEncounter } from './registry';
import { ALL_DIRS, entityAt, eq, hasTag, inBounds, manhattan, step, tileAt } from './grid';
import { corruptTile, dealDamage } from './effects';
import { createEntity } from './battle';
import { shuffled } from './rng';
import type { EventSink } from './events';
import type { Entity, GameState, Vec } from './types';

export const wounds = (s: GameState): Entity[] => s.entities.filter((e) => hasTag(e, 'wound'));
export const demonCount = (s: GameState): number => s.entities.filter((e) => e.faction === 'demon' && hasTag(e, 'demon')).length;

function spreadCandidates(s: GameState, w: Entity): Vec[] {
  const out: Vec[] = [];
  for (let y = 0; y < s.height; y++)
    for (let x = 0; x < s.width; x++) {
      const p = { x, y };
      const t = tileAt(s, p)!;
      if (t.terrain !== 'floor' || t.corrupted || t.consecrated) continue;
      if (manhattan(p, w.pos) > 4) continue;
      if (s.pendingSpread.some((q) => eq(q.at, p))) continue;
      const touches = ALL_DIRS.some((d) => {
        const n = step(p, d);
        return inBounds(s, n) && (tileAt(s, n)!.corrupted || eq(n, w.pos));
      });
      if (touches) out.push(p);
    }
  return out;
}

/** Each wound announces where the Taint will creep at the end of the round. */
export function declareSpread(s: GameState): void {
  const enc = getEncounter(s.encounterId);
  s.pendingSpread = [];
  for (const w of wounds(s)) {
    const cands = shuffled(s, spreadCandidates(s, w)).sort((a, b) => manhattan(a, w.pos) - manhattan(b, w.pos));
    for (const p of cands.slice(0, enc.spreadPerWound)) s.pendingSpread.push({ at: p, sourceId: w.id });
  }
}

export function applySpread(s: GameState, ev: EventSink): void {
  for (const p of s.pendingSpread) {
    if (!s.entities.some((e) => e.id === p.sourceId)) continue;
    corruptTile(s, p.at, 'spread', ev);
  }
  s.pendingSpread = [];
}

/** Choose spawn sites for next round: corrupted, empty, unhallowed tiles near a wound. */
export function declareSpawns(s: GameState): void {
  const enc = getEncounter(s.encounterId);
  if (s.round < enc.spawnFromRound) return;
  for (const w of wounds(s)) {
    if (demonCount(s) + s.spawnMarkers.length >= enc.maxEnemies) return;
    const cands: Vec[] = [];
    for (let y = 0; y < s.height; y++)
      for (let x = 0; x < s.width; x++) {
        const p = { x, y };
        const t = tileAt(s, p)!;
        const r = manhattan(p, w.pos);
        if (r < 1 || r > 2 || t.terrain !== 'floor' || !t.corrupted || t.consecrated) continue;
        if (entityAt(s, p) || s.spawnMarkers.some((m) => eq(m.at, p))) continue;
        cands.push(p);
      }
    if (!cands.length) continue;
    const at = shuffled(s, cands)[0];
    const defId = enc.spawnPool[s.spawnCursor++ % enc.spawnPool.length];
    s.spawnMarkers.push({ at, defId, sourceId: w.id });
  }
}

/** Markers become demons. A unit standing on the site blocks it and is hurt. */
export function emergeSpawns(s: GameState, ev: EventSink): void {
  const markers = s.spawnMarkers;
  s.spawnMarkers = [];
  for (const m of markers) {
    const t = tileAt(s, m.at)!;
    if (t.consecrated) {
      ev.push({ t: 'spawnBlocked', at: m.at, reason: 'hallowed' });
      continue;
    }
    const occ = entityAt(s, m.at);
    if (occ) {
      ev.push({ t: 'spawnBlocked', at: m.at, reason: 'occupied' });
      dealDamage(s, occ, RULES.spawnBlockDamage, 'spawnBlock', ev);
      continue;
    }
    const e = createEntity(s, m.defId, m.at);
    s.entities.push(e);
    ev.push({ t: 'spawn', id: e.id, defId: e.defId, at: { ...m.at } });
  }
}

/** Remove announcements tied to a wound that no longer exists. */
export function dropWoundAnnouncements(s: GameState, woundId: string): void {
  s.spawnMarkers = s.spawnMarkers.filter((m) => m.sourceId !== woundId);
  s.pendingSpread = s.pendingSpread.filter((p) => p.sourceId !== woundId);
}

