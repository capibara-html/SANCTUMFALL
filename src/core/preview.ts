// Forecasts: run the real rules on a clone and summarise the outcome per
// entity. The UI never re-implements rules to draw previews.
import { cloneState } from './clone';
import { resolveUse } from './abilities';
import { resolveReckoning } from './turn';
import { getEntity } from './grid';
import type { GameEvent } from './events';
import type { AbilityUse, GameState, Vec } from './types';

export interface EntityForecast {
  id: string;
  damage: number;
  dies: boolean;
  drowns: boolean;
  shieldLost: boolean;
  shieldGained: boolean;
  warded: boolean;
  from: Vec;
  to: Vec;
  bumped: boolean;
}

export interface Forecast {
  events: GameEvent[];
  after: GameState;
  entities: Map<string, EntityForecast>;
  tiles: { at: Vec; corrupted: boolean; consecrated: boolean }[];
}

export function summarise(before: GameState, after: GameState, events: GameEvent[]): Forecast {
  const entities = new Map<string, EntityForecast>();
  const get = (id: string): EntityForecast | null => {
    let f = entities.get(id);
    if (!f) {
      const e = getEntity(before, id);
      if (!e) return null;
      f = { id, damage: 0, dies: false, drowns: false, shieldLost: false, shieldGained: false, warded: false, from: { ...e.pos }, to: { ...e.pos }, bumped: false };
      entities.set(id, f);
    }
    return f;
  };
  const tiles: Forecast['tiles'] = [];
  for (const ev of events) {
    switch (ev.t) {
      case 'damage': { const f = get(ev.id); if (f) f.damage += ev.amount; break; }
      case 'death': { const f = get(ev.id); if (f) { f.dies = true; f.drowns = ev.cause === 'drown'; } break; }
      case 'shieldBlock': { const f = get(ev.id); if (f) f.shieldLost = true; break; }
      case 'shield': { const f = get(ev.id); if (f) f.shieldGained = true; break; }
      case 'warded': { const f = get(ev.id); if (f) f.warded = true; break; }
      case 'push': { const f = get(ev.id); if (f) f.to = { ...ev.to }; break; }
      case 'charge': { const f = get(ev.id); if (f) f.to = { ...ev.to }; break; }
      case 'move': { const f = get(ev.id); if (f && ev.path.length) f.to = { ...ev.path[ev.path.length - 1] }; break; }
      case 'surface': { const f = get(ev.id); if (f) f.to = { ...ev.to }; break; }
      case 'bump': { const f = get(ev.id); if (f) f.bumped = true; break; }
      case 'tile': tiles.push({ at: ev.at, corrupted: ev.corrupted, consecrated: ev.consecrated }); break;
    }
  }
  return { events, after, entities, tiles };
}

/** What happens if this ability is used right now. */
export function forecastUse(s: GameState, use: AbilityUse): Forecast {
  const after = cloneState(s);
  const events: GameEvent[] = [];
  resolveUse(after, use, events);
  return summarise(s, after, events);
}

/** What a single demon's declared intent would do if it resolved right now. */
export function forecastIntent(s: GameState, enemyId: string): Forecast | null {
  const e = getEntity(s, enemyId);
  if (!e?.intent) return null;
  return forecastUse(s, e.intent);
}

/**
 * What the whole Reckoning would do if the turn ended right now: Taint burns,
 * every intent in order, spread. Stops before the next round begins.
 */
export function forecastReckoning(s: GameState): Forecast {
  const after = cloneState(s);
  const events: GameEvent[] = [];
  resolveReckoning(after, events);
  return summarise(s, after, events);
}
