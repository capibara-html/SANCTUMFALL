import '../src/content';
import { buildState, getEntity, registerEncounter } from '../src/core';
import { BASE_LEGEND } from '../src/content/encounters/legend';
import type { EncounterDef, Entity, GameState } from '../src/core';

let n = 0;
/** Register a throwaway encounter from an ASCII map and build its state. */
export function board(map: string[], extra: Partial<EncounterDef> = {}): GameState {
  const id = `test_${n++}`;
  registerEncounter({
    id,
    name: 'Test Ground',
    subtitle: '',
    region: 'ash',
    seed: 7,
    map,
    legend: BASE_LEGEND,
    taintLimit: 99,
    spawnPool: ['hollow'],
    maxEnemies: 0,
    spawnFromRound: 99,
    spreadPerWound: 0,
    objectives: [],
    briefing: [],
    ...extra,
  });
  const s = buildState(id);
  s.round = 1;
  return s;
}

export function byDef(s: GameState, defId: string, i = 0): Entity {
  const e = s.entities.filter((x) => x.defId === defId)[i];
  if (!e) throw new Error(`no ${defId}`);
  return e;
}

export const alive = (s: GameState, e: Entity) => !!getEntity(s, e.id);
