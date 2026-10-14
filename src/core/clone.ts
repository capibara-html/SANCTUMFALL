import type { Entity, GameState } from './types';

function cloneEntity(e: Entity): Entity {
  return {
    ...e,
    pos: { ...e.pos },
    tags: e.tags.slice(),
    abilities: e.abilities.slice(),
    cooldowns: { ...e.cooldowns },
    intent: e.intent ? { ...e.intent, offset: e.intent.offset ? { ...e.intent.offset } : undefined } : null,
    memory: { ...e.memory },
  };
}

/** Fast deep clone used for previews, AI simulation and undo snapshots. */
export function cloneState(s: GameState): GameState {
  return {
    ...s,
    tiles: s.tiles.map((t) => ({ ...t })),
    entities: s.entities.map(cloneEntity),
    spawnMarkers: s.spawnMarkers.map((m) => ({ ...m, at: { ...m.at } })),
    pendingSpread: s.pendingSpread.map((p) => ({ ...p, at: { ...p.at } })),
    stats: { ...s.stats, vigilFallen: s.stats.vigilFallen.slice(), structuresLost: s.stats.structuresLost.slice() },
    outcome: s.outcome ? { ...s.outcome } : null,
  };
}
