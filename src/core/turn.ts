// Round structure:
//   Demon phase  — spawns emerge, demons move and telegraph, wounds announce
//                  spread and spawn sites for the coming round.
//   Vigil phase  — the player moves and acts with each unit.
//   Reckoning    — Taint burns those standing in it, intents resolve in order,
//                  corruption spreads. Then the next round begins.
import { getAbility } from './registry';
import { RULES } from './rules';
import { dealDamage } from './effects';
import { planEnemies } from './ai';
import { applySpread, declareSpawns, declareSpread, emergeSpawns } from './corruption';
import { checkOutcome } from './objectives';
import { buildState } from './battle';
import { reachable } from './movement';
import { resolveUse, targetOptions } from './abilities';
import { eq, getEntity, key, tileAt } from './grid';
import type { EventSink, GameEvent } from './events';
import type { AbilityUse, GameState, Vec } from './types';
import './hooks';

export function startBattle(encounterId: string): { state: GameState; events: GameEvent[] } {
  const state = buildState(encounterId);
  const events: GameEvent[] = [];
  beginRound(state, events);
  return { state, events };
}

function beginRound(s: GameState, ev: EventSink): void {
  s.round++;
  ev.push({ t: 'banner', text: `Round ${s.round}`, sub: 'The demons stir' });
  emergeSpawns(s, ev);
  checkOutcome(s, ev);
  if (s.phase !== 'player') return;
  planEnemies(s, ev);
  declareSpread(s);
  declareSpawns(s);
  for (const e of s.entities) {
    if (e.faction !== 'vigil') continue;
    e.moved = false;
    e.acted = false;
    for (const k of Object.keys(e.cooldowns)) if (e.cooldowns[k] > 0) e.cooldowns[k]--;
  }
  ev.push({ t: 'banner', text: 'Your Vigil', sub: `Round ${s.round}` });
}

/** Ordered list of demons whose declared intents will resolve this round. */
export function intentQueue(s: GameState) {
  return s.entities.filter((e) => e.intent).sort((a, b) => a.intentOrder - b.intentOrder);
}

export function endTurn(s: GameState): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.phase !== 'player') return ev;
  ev.push({ t: 'banner', text: 'The Reckoning', sub: 'Declared rites resolve' });

  // 1. The Taint gnaws at the living.
  for (const e of s.entities.slice()) {
    if (e.faction === 'vigil' && tileAt(s, e.pos)?.corrupted) dealDamage(s, e, RULES.taintDamage, 'taint', ev);
  }
  checkOutcome(s, ev);
  if (s.phase !== 'player') return ev;

  // 2. Declared intents resolve in order. Dead or silenced demons do nothing.
  for (const e of intentQueue(s)) {
    if (!s.entities.includes(e) || !e.intent) continue;
    const use = e.intent;
    e.intent = null;
    resolveUse(s, use, ev);
    checkOutcome(s, ev);
    if (s.phase !== 'player') return ev;
  }

  // 3. The Taint creeps.
  applySpread(s, ev);
  checkOutcome(s, ev, true);
  if (s.phase !== 'player') return ev;

  beginRound(s, ev);
  return ev;
}

// --- player actions ------------------------------------------------------------

export function canMove(s: GameState, id: string): boolean {
  const e = getEntity(s, id);
  return !!e && s.phase === 'player' && e.faction === 'vigil' && !e.moved && !e.acted;
}

export function canAct(s: GameState, id: string, abilityId: string): boolean {
  const e = getEntity(s, id);
  return !!e && s.phase === 'player' && e.faction === 'vigil' && !e.acted && e.abilities.includes(abilityId) && (e.cooldowns[abilityId] ?? 0) <= 0;
}

export function moveUnit(s: GameState, id: string, to: Vec): GameEvent[] {
  if (!canMove(s, id)) throw new Error(`Unit ${id} cannot move`);
  const e = getEntity(s, id)!;
  const path = reachable(s, e).get(key(to));
  if (!path) throw new Error(`Tile ${key(to)} is not reachable for ${id}`);
  e.pos = { ...to };
  e.moved = true;
  return [{ t: 'move', id, path: path.map((p) => ({ ...p })) }];
}

/** Is `use` one of the legal options for this unit right now? */
export function isLegalUse(s: GameState, use: AbilityUse): boolean {
  const e = getEntity(s, use.sourceId);
  if (!e || !canAct(s, e.id, use.abilityId)) return false;
  return targetOptions(s, e, use.abilityId).some(
    (o) => o.use.dir === use.dir && o.use.dist === use.dist && eq(o.use.offset ?? { x: 0, y: 0 }, use.offset ?? { x: 0, y: 0 }),
  );
}

export function useAbility(s: GameState, use: AbilityUse): GameEvent[] {
  if (!isLegalUse(s, use)) throw new Error(`Illegal use of ${use.abilityId} by ${use.sourceId}`);
  const e = getEntity(s, use.sourceId)!;
  const ab = getAbility(use.abilityId);
  e.acted = true;
  e.moved = true;
  if (ab.cooldown) e.cooldowns[ab.id] = ab.cooldown;
  const ev: GameEvent[] = [];
  resolveUse(s, use, ev);
  checkOutcome(s, ev);
  return ev;
}

