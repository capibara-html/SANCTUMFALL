// Primitive rule operations shared by every ability, hazard and boss:
// damage, death, forced movement and terrain changes.
import { RULES } from './rules';
import { entityAt, eq, footprint, hasTag, inBounds, step, tileAt } from './grid';
import type { EventSink } from './events';
import type { Dir, Entity, GameState, Vec } from './types';

// --- death hooks -----------------------------------------------------------

export type DeathHook = (s: GameState, e: Entity, ev: EventSink) => void;
const deathHooks = new Map<string, DeathHook>();
export function registerDeathHook(id: string, hook: DeathHook): void {
  deathHooks.set(id, hook);
}

/** True while any warding bell stands: bosses cannot be harmed directly. */
export function isWarded(s: GameState, e: Entity): boolean {
  return hasTag(e, 'boss') && s.entities.some((o) => hasTag(o, 'bell'));
}

export function dealDamage(s: GameState, e: Entity, amount: number, cause: string, ev: EventSink): void {
  if (amount <= 0 || !s.entities.includes(e)) return;
  if (cause !== 'bellSeal' && isWarded(s, e)) {
    ev.push({ t: 'warded', id: e.id });
    return;
  }
  if (e.shield) {
    e.shield = false;
    ev.push({ t: 'shieldBlock', id: e.id });
    return;
  }
  e.hp = Math.max(0, e.hp - amount);
  ev.push({ t: 'damage', id: e.id, amount, hp: e.hp, cause });
  if (e.hp <= 0) kill(s, e, 'damage', ev);
}

export function kill(s: GameState, e: Entity, cause: 'damage' | 'drown', ev: EventSink): void {
  const idx = s.entities.indexOf(e);
  if (idx < 0) return;
  s.entities.splice(idx, 1);
  e.intent = null;
  ev.push({ t: 'death', id: e.id, cause, at: { ...e.pos }, defId: e.defId });
  if (e.faction === 'demon' && hasTag(e, 'demon')) {
    s.stats.demonsSlain++;
    if (cause === 'drown') s.stats.drownedDemons++;
  }
  if (e.faction === 'vigil') s.stats.vigilFallen.push(e.name);
  if (hasTag(e, 'shrine')) s.stats.structuresLost.push(e.name);
  if (e.onDeath) deathHooks.get(e.onDeath)?.(s, e, ev);
}

export function heal(e: Entity, amount: number, ev: EventSink): void {
  const before = e.hp;
  e.hp = Math.min(e.maxHp, e.hp + amount);
  if (e.hp > before) ev.push({ t: 'heal', id: e.id, amount: e.hp - before, hp: e.hp });
}

// --- forced movement ---------------------------------------------------------

export function isImmovable(e: Entity): boolean {
  return hasTag(e, 'massive') || hasTag(e, 'structure');
}

/**
 * Push an entity one tile. Blocked pushes "bump": the pushed unit (and whatever
 * blocked it) take bump damage. Pushes into the abyss drown anything that
 * cannot swim or fly. Demons forced onto hallowed ground burn.
 */
export function pushEntity(s: GameState, e: Entity, dir: Dir, ev: EventSink): void {
  if (!s.entities.includes(e)) return;
  if (isImmovable(e)) {
    ev.push({ t: 'resist', id: e.id, dir });
    return;
  }
  const from = { ...e.pos };
  const dest = step(from, dir);
  const tile = tileAt(s, dest);
  if (!tile || tile.terrain === 'wall') {
    ev.push({ t: 'bump', id: e.id, at: dest, dir, into: null });
    dealDamage(s, e, RULES.bumpDamage, 'bump', ev);
    return;
  }
  const other = entityAt(s, dest);
  if (other && other !== e) {
    ev.push({ t: 'bump', id: e.id, at: dest, dir, into: other.id });
    dealDamage(s, e, RULES.bumpDamage, 'bump', ev);
    dealDamage(s, other, RULES.bumpDamage, 'bump', ev);
    return;
  }
  e.pos = dest;
  ev.push({ t: 'push', id: e.id, from, to: { ...dest }, dir });
  arriveOnTile(s, e, ev);
}

/** Consequences of being forced onto a tile. */
export function arriveOnTile(s: GameState, e: Entity, ev: EventSink): void {
  const tile = tileAt(s, e.pos);
  if (!tile) return;
  if (tile.terrain === 'abyss' && !hasTag(e, 'flying') && !hasTag(e, 'aquatic')) {
    kill(s, e, 'drown', ev);
    return;
  }
  if (tile.consecrated && hasTag(e, 'demon')) dealDamage(s, e, RULES.hallowBurn, 'hallowed', ev);
}

/** Teleport-free relocation used by voluntary moves and charges. */
export function relocate(e: Entity, to: Vec): void {
  e.pos = { ...to };
}

// --- terrain -----------------------------------------------------------------

export function corruptTile(s: GameState, p: Vec, cause: string, ev: EventSink): boolean {
  const t = tileAt(s, p);
  if (!t || t.terrain !== 'floor' || t.consecrated || t.corrupted) return false;
  t.corrupted = true;
  ev.push({ t: 'tile', at: { ...p }, corrupted: true, consecrated: false, cause });
  return true;
}

export function cleanseTile(s: GameState, p: Vec, cause: string, ev: EventSink): boolean {
  const t = tileAt(s, p);
  if (!t || !t.corrupted) return false;
  t.corrupted = false;
  s.stats.tilesCleansed++;
  ev.push({ t: 'tile', at: { ...p }, corrupted: false, consecrated: t.consecrated, cause });
  return true;
}

export function consecrateTile(s: GameState, p: Vec, cause: string, ev: EventSink): boolean {
  const t = tileAt(s, p);
  if (!t || t.terrain !== 'floor' || t.consecrated) return false;
  if (t.corrupted) s.stats.tilesCleansed++;
  t.corrupted = false;
  t.consecrated = true;
  ev.push({ t: 'tile', at: { ...p }, corrupted: false, consecrated: true, cause });
  return true;
}

export function desecrateTile(s: GameState, p: Vec, cause: string, ev: EventSink): void {
  const t = tileAt(s, p);
  if (!t || t.terrain !== 'floor') return;
  if (t.consecrated || !t.corrupted) {
    t.consecrated = false;
    t.corrupted = true;
    ev.push({ t: 'tile', at: { ...p }, corrupted: true, consecrated: false, cause });
  }
}

export function unhallowTile(s: GameState, p: Vec, cause: string, ev: EventSink): void {
  const t = tileAt(s, p);
  if (!t || !t.consecrated) return;
  t.consecrated = false;
  ev.push({ t: 'tile', at: { ...p }, corrupted: t.corrupted, consecrated: false, cause });
}

export function taintCount(s: GameState): number {
  let n = 0;
  for (const t of s.tiles) if (t.corrupted) n++;
  return n;
}

export function tilesWithin(s: GameState, c: Vec, r: number): Vec[] {
  const out: Vec[] = [];
  for (let y = c.y - r; y <= c.y + r; y++)
    for (let x = c.x - r; x <= c.x + r; x++) {
      const p = { x, y };
      if (inBounds(s, p) && Math.abs(x - c.x) + Math.abs(y - c.y) <= r) out.push(p);
    }
  return out;
}

export const onFootprint = (e: Entity, p: Vec): boolean => footprint(e).some((q) => eq(q, p));
