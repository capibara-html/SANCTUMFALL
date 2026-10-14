// LEVIATHAN, the Drowned Choir.
// A boss is ordinary content plus a few bespoke rites. Everything it does is
// built from the shared primitives (push, damage, relocation) and announced a
// round ahead through its litany:
//   1. Tidal Surge   — the two rows it faces are dragged 1 tile toward the deep.
//                      Rebuke turns the tide: everything is shoved away instead.
//   2. Abyssal Maw   — the 2x2 tiles in front of it take 3 damage.
//   3. The Deep Stirs— it sinks and resurfaces at announced rows; the bank there
//                      erupts (2 damage, knocked away).
// While any Drowned Bell tolls it is warded; each bell silenced sears it for 2.
import { registerAbility, registerUnit } from '../../core/registry';
import { registerSpecial } from '../../core/abilities';
import { dealDamage, pushEntity } from '../../core/effects';
import { entityAt, inBounds } from '../../core/grid';
import type { Dir, Entity, GameState, Vec } from '../../core/types';

const DEEP: Dir = 3; // the abyss lies west
const SHORE: Dir = 1;

function rowsOf(e: Entity): number[] {
  return [e.pos.y, e.pos.y + 1];
}
/** first dry column in front of the beast */
const bankX = (e: Entity) => e.pos.x + e.size;

function rowTiles(s: GameState, e: Entity): Vec[] {
  const out: Vec[] = [];
  for (const y of rowsOf(e)) for (let x = bankX(e); x < s.width; x++) out.push({ x, y });
  return out.filter((p) => inBounds(s, p));
}

registerSpecial('tidal_surge', {
  choose: () => ({ dir: DEEP }),
  footprint: (s, e, use) => {
    const tiles = rowTiles(s, e);
    return { tiles, arrows: tiles.map((at) => ({ at, dir: use.dir ?? DEEP })) };
  },
  resolve: (s, plan, use, ev) => {
    const e = plan.source;
    const dir = use.dir ?? DEEP;
    const tiles = rowTiles(s, e);
    ev.push({ t: 'attack', sourceId: e.id, abilityId: 'tidal_surge', anim: 'tide', from: { ...e.pos }, impact: null, dir, tiles });
    for (const y of rowsOf(e)) {
      // units nearest the destination move first so a row slides together
      const xs = [];
      for (let x = bankX(e); x < s.width; x++) xs.push(x);
      if (dir === SHORE) xs.reverse();
      for (const x of xs) {
        const target = entityAt(s, { x, y });
        if (target && target !== e && target.pos.x === x && target.pos.y === y) pushEntity(s, target, dir, ev);
      }
    }
  },
});

function mawTiles(s: GameState, e: Entity, dir: Dir): Vec[] {
  const out: Vec[] = [];
  const xs = dir === SHORE ? [bankX(e), bankX(e) + 1] : [e.pos.x - 1, e.pos.x - 2];
  for (const y of rowsOf(e)) for (const x of xs) out.push({ x, y });
  return out.filter((p) => inBounds(s, p));
}

registerSpecial('abyssal_maw', {
  choose: () => ({ dir: SHORE }),
  footprint: (s, e, use) => ({ tiles: mawTiles(s, e, use.dir ?? SHORE), arrows: [] }),
  resolve: (s, plan, use, ev) => {
    const e = plan.source;
    const tiles = mawTiles(s, e, use.dir ?? SHORE);
    ev.push({ t: 'attack', sourceId: e.id, abilityId: 'abyssal_maw', anim: 'maw', from: { ...e.pos }, impact: tiles[0] ?? null, dir: use.dir ?? SHORE, tiles });
    const hit: Entity[] = [];
    for (const p of tiles) {
      const t = entityAt(s, p);
      if (t && t !== e && !hit.includes(t)) hit.push(t);
    }
    for (const t of hit) dealDamage(s, t, 3, 'abyssal_maw', ev);
  },
});

function surfaceTiles(s: GameState, e: Entity, newY: number): Vec[] {
  return [newY, newY + 1].map((y) => ({ x: bankX(e), y })).filter((p) => inBounds(s, p));
}

registerSpecial('deep_stirs', {
  choose: (s, e) => {
    // Resurface where the most of the living stand near the bank.
    let best = e.pos.y;
    let bestScore = -Infinity;
    for (let y = 0; y <= s.height - e.size; y++) {
      let score = -Math.abs(y - (s.height - e.size) / 2) * 0.1 - (y === e.pos.y ? 2 : 0);
      for (const o of s.entities) {
        if (o.faction !== 'vigil') continue;
        if (o.pos.y === y || o.pos.y === y + 1) score += o.pos.x === bankX(e) ? 4 : o.pos.x <= bankX(e) + 2 ? 2 : 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = y;
      }
    }
    return { offset: { x: 0, y: best - e.pos.y } };
  },
  footprint: (s, e, use) => {
    const newY = e.pos.y + (use.offset?.y ?? 0);
    const bank = surfaceTiles(s, e, newY);
    const body: Vec[] = [];
    for (let dy = 0; dy < e.size; dy++) for (let dx = 0; dx < e.size; dx++) body.push({ x: e.pos.x + dx, y: newY + dy });
    return { tiles: [...body, ...bank], arrows: bank.map((at) => ({ at, dir: SHORE })) };
  },
  resolve: (s, plan, use, ev) => {
    const e = plan.source;
    const from = { ...e.pos };
    const newY = e.pos.y + (use.offset?.y ?? 0);
    e.pos = { x: e.pos.x, y: newY };
    ev.push({ t: 'surface', id: e.id, from, to: { ...e.pos } });
    const tiles = surfaceTiles(s, e, newY);
    ev.push({ t: 'attack', sourceId: e.id, abilityId: 'deep_stirs', anim: 'surface', from: { ...e.pos }, impact: tiles[0] ?? null, dir: SHORE, tiles });
    for (const p of tiles) {
      const t = entityAt(s, p);
      if (!t || t === e) continue;
      dealDamage(s, t, 2, 'deep_stirs', ev);
      if (s.entities.includes(t)) pushEntity(s, t, SHORE, ev);
    }
  },
});

registerAbility({
  id: 'tidal_surge',
  name: 'Tidal Surge',
  description: 'Everything in the two rows the Leviathan faces is dragged 1 tile toward the deep. Units dragged into water drown. Rebuke turns the tide outward.',
  targeting: { kind: 'self' },
  effects: [],
  special: 'tidal_surge',
  icon: 'wave',
  animation: 'tide',
});
registerAbility({
  id: 'abyssal_maw',
  name: 'Abyssal Maw',
  description: 'Bites the 2×2 tiles directly in front of it for 3 damage. Rebuke turns its jaws back toward the deep, where nothing stands.',
  targeting: { kind: 'self' },
  effects: [],
  special: 'abyssal_maw',
  icon: 'maw',
  animation: 'maw',
});
registerAbility({
  id: 'deep_stirs',
  name: 'The Deep Stirs',
  description: 'Sinks and resurfaces at the marked rows. The bank there erupts: 2 damage and knocked 1 tile away. Cannot be rebuked.',
  targeting: { kind: 'self' },
  effects: [],
  special: 'deep_stirs',
  icon: 'stir',
  animation: 'surface',
});

registerUnit({
  id: 'leviathan',
  name: 'Leviathan',
  title: 'The Drowned Choir',
  faction: 'demon',
  hp: 6,
  move: 0,
  size: 2,
  tags: ['demon', 'boss', 'massive', 'aquatic'],
  abilities: ['tidal_surge', 'abyssal_maw', 'deep_stirs'],
  behavior: 'litany',
  litany: ['tidal_surge', 'abyssal_maw', 'deep_stirs'],
  blurb: 'It sang the old sea into the nave. While its bells toll it cannot be harmed — silence them, then drive it back into the dark.',
  sprite: 'leviathan',
});

