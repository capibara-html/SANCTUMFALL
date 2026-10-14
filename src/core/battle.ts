// Building a GameState from an encounter definition.
import { getEncounter, getUnitDef } from './registry';
import type { Entity, GameState, Tile, Vec } from './types';

function variantFor(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 997;
}

export function createEntity(s: GameState, defId: string, pos: Vec): Entity {
  const def = getUnitDef(defId);
  const e: Entity = {
    id: `${def.faction[0]}${s.nextId++}`,
    defId,
    name: def.name,
    faction: def.faction,
    pos: { ...pos },
    size: def.size ?? 1,
    hp: def.hp,
    maxHp: def.hp,
    move: def.move,
    tags: def.tags.slice(),
    abilities: def.abilities.slice(),
    shield: false,
    moved: false,
    acted: false,
    cooldowns: {},
    intent: null,
    intentOrder: 0,
    behavior: def.behavior ?? (def.faction === 'demon' ? 'standard' : 'none'),
    memory: {},
    onDeath: def.onDeath,
  };
  return e;
}

/** Build the initial board. Does not run the first enemy phase (see turn.ts). */
export function buildState(encounterId: string): GameState {
  const enc = getEncounter(encounterId);
  const height = enc.map.length;
  const width = enc.map[0].length;
  const s: GameState = {
    encounterId,
    width,
    height,
    tiles: [],
    entities: [],
    round: 0,
    phase: 'player',
    rng: enc.seed | 0,
    nextId: 1,
    taintLimit: enc.taintLimit,
    spawnMarkers: [],
    pendingSpread: [],
    spawnCursor: 0,
    stats: { demonsSlain: 0, drownedDemons: 0, tilesCleansed: 0, woundsSealed: 0, vigilFallen: [], structuresLost: [] },
    outcome: null,
  };
  const placements: { defId: string; pos: Vec }[] = [];
  for (let y = 0; y < height; y++) {
    const row = enc.map[y];
    if (row.length !== width) throw new Error(`${encounterId}: row ${y} has width ${row.length}, expected ${width}`);
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      const entry = enc.legend[ch];
      if (!entry) throw new Error(`${encounterId}: no legend entry for '${ch}'`);
      const tile: Tile = {
        terrain: entry.terrain ?? 'floor',
        corrupted: !!entry.corrupted,
        consecrated: !!entry.consecrated,
        variant: variantFor(x, y, enc.seed),
      };
      s.tiles.push(tile);
      if (entry.entity) placements.push({ defId: entry.entity, pos: { x, y } });
    }
  }
  // Vigil first, then neutral structures, then demons (boss included): the
  // array order is also the default enemy resolution order.
  const rank = (id: string) => ({ vigil: 0, neutral: 1, demon: 2 })[getUnitDef(id).faction];
  placements.sort((a, b) => rank(a.defId) - rank(b.defId));
  for (const p of placements) s.entities.push(createEntity(s, p.defId, p.pos));
  return s;
}
