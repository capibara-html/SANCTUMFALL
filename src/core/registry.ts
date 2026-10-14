// Content registries. Content modules register definitions at start-up; the
// rules engine only ever looks things up by id, so new units, abilities and
// encounters never require touching the engine.
import type { AbilityDef, EncounterDef, UnitDef } from './types';

const abilities = new Map<string, AbilityDef>();
const units = new Map<string, UnitDef>();
const encounters = new Map<string, EncounterDef>();

export function registerAbility(def: AbilityDef): void {
  abilities.set(def.id, def);
}
export function registerUnit(def: UnitDef): void {
  units.set(def.id, def);
}
export function registerEncounter(def: EncounterDef): void {
  encounters.set(def.id, def);
}

function must<T>(map: Map<string, T>, id: string, kind: string): T {
  const v = map.get(id);
  if (!v) throw new Error(`Unknown ${kind}: ${id}`);
  return v;
}

export const getAbility = (id: string): AbilityDef => must(abilities, id, 'ability');
export const getUnitDef = (id: string): UnitDef => must(units, id, 'unit');
export const getEncounter = (id: string): EncounterDef => must(encounters, id, 'encounter');
export const listEncounters = (): EncounterDef[] => [...encounters.values()];
export const hasUnitDef = (id: string): boolean => units.has(id);
