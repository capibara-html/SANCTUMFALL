// Enemy planning. Each demon picks a destination and declares an intent by
// simulating every (destination, ability use) pair on a cloned state and
// scoring the resulting events. Deterministic: ties break on board order.
import { getAbility, getUnitDef } from './registry';
import { cloneState } from './clone';
import { getEntity, hasTag, manhattan, tileAt } from './grid';
import { reachable } from './movement';
import { getSpecial, resolveUse, targetOptions } from './abilities';
import type { EventSink, GameEvent } from './events';
import type { AbilityUse, Entity, GameState, Vec } from './types';

export interface PlanContext {
  order: number;
}
export type Behavior = (s: GameState, e: Entity, ev: EventSink, ctx: PlanContext) => void;
const behaviors = new Map<string, Behavior>();
export function registerBehavior(id: string, b: Behavior): void {
  behaviors.set(id, b);
}

/** Weights for judging an imagined outcome. Positive is good for the demons. */
export const AI_WEIGHTS = {
  damageVigil: 10,
  killVigil: 30,
  damageShrine: 6,
  killShrine: 14,
  damageDemon: -7,
  killDemon: -14,
  damageWound: -15,
  killWound: -60,
  corruptTile: 3,
  shieldPop: 3,
  standOnTaint: 2,
  approach: -0.6,
} as const;

export function scoreEvents(before: GameState, events: GameEvent[]): number {
  let score = 0;
  const lookup = (id: string) => getEntity(before, id);
  for (const ev of events) {
    switch (ev.t) {
      case 'damage': {
        const e = lookup(ev.id);
        if (!e) break;
        if (e.faction === 'vigil') score += AI_WEIGHTS.damageVigil * ev.amount;
        else if (hasTag(e, 'shrine')) score += AI_WEIGHTS.damageShrine * ev.amount;
        else if (hasTag(e, 'wound') || hasTag(e, 'bell')) score += AI_WEIGHTS.damageWound * ev.amount;
        else if (e.faction === 'demon') score += AI_WEIGHTS.damageDemon * ev.amount;
        break;
      }
      case 'death': {
        const e = lookup(ev.id);
        if (!e) break;
        if (e.faction === 'vigil') score += AI_WEIGHTS.killVigil;
        else if (hasTag(e, 'shrine')) score += AI_WEIGHTS.killShrine;
        else if (hasTag(e, 'wound') || hasTag(e, 'bell')) score += AI_WEIGHTS.killWound;
        else if (e.faction === 'demon') score += AI_WEIGHTS.killDemon;
        break;
      }
      case 'shieldBlock': {
        const e = lookup(ev.id);
        if (e?.faction === 'vigil') score += AI_WEIGHTS.shieldPop;
        break;
      }
      case 'tile':
        if (ev.corrupted) score += AI_WEIGHTS.corruptTile;
        break;
    }
  }
  return score;
}

function targetsOf(s: GameState): Vec[] {
  return s.entities.filter((e) => e.faction === 'vigil' || hasTag(e, 'shrine')).map((e) => e.pos);
}

/** Default demon behaviour: search every move + attack pair, keep the best. */
export const standardBehavior: Behavior = (s, e, ev, ctx) => {
  const dests: { to: Vec; path: Vec[] }[] = [{ to: e.pos, path: [] }];
  for (const [, path] of reachable(s, e)) dests.push({ to: path[path.length - 1], path });
  const targets = targetsOf(s);
  let best: { score: number; dest: (typeof dests)[number]; use: AbilityUse | null } | null = null;

  for (const dest of dests) {
    const moved = cloneState(s);
    const me = getEntity(moved, e.id)!;
    me.pos = { ...dest.to };
    const nearest = targets.length ? Math.min(...targets.map((t) => manhattan(t, dest.to))) : 0;
    const positional = (tileAt(moved, dest.to)!.corrupted ? AI_WEIGHTS.standOnTaint : 0) + AI_WEIGHTS.approach * nearest - dest.path.length * 0.01;
    const consider = (score: number, use: AbilityUse | null) => {
      if (!best || score > best.score + 1e-9) best = { score, dest, use };
    };
    consider(positional - 1, null);
    for (const abilityId of e.abilities) {
      if ((e.cooldowns[abilityId] ?? 0) > 0) continue;
      for (const opt of targetOptions(moved, me, abilityId)) {
        const sim = cloneState(moved);
        const evs: GameEvent[] = [];
        resolveUse(sim, opt.use, evs);
        const value = scoreEvents(moved, evs);
        if (value <= 0) continue; // never telegraph an attack that achieves nothing
        consider(value + positional, opt.use);
      }
    }
  }
  const choice = best as { score: number; dest: (typeof dests)[number]; use: AbilityUse | null } | null;
  if (!choice) return;
  if (choice.dest.path.length) {
    e.pos = { ...choice.dest.to };
    ev.push({ t: 'move', id: e.id, path: choice.dest.path.map((p) => ({ ...p })) });
  }
  if (choice.use) {
    e.intent = choice.use;
    e.intentOrder = ctx.order++;
    const ab = getAbility(choice.use.abilityId);
    if (ab.cooldown) e.cooldowns[ab.id] = ab.cooldown;
  }
};
registerBehavior('standard', standardBehavior);
registerBehavior('none', () => {});

/**
 * Scripted bosses perform a fixed, visible cycle of rites (their litany).
 * Reading the litany is how the player learns to counter the entity.
 */
export const litanyBehavior: Behavior = (s, e, _ev, ctx) => {
  const lit = getUnitDef(e.defId).litany;
  if (!lit?.length) return;
  const step = e.memory.step ?? 0;
  const abilityId = lit[step % lit.length];
  const ab = getAbility(abilityId);
  const params = ab.special ? (getSpecial(ab.special).choose?.(s, e) ?? {}) : {};
  e.intent = { ...params, abilityId, sourceId: e.id };
  e.intentOrder = ctx.order++;
  e.memory.step = step + 1;
};
registerBehavior('litany', litanyBehavior);

/** The rites a litany boss will perform: the declared one, then the next n-1. */
export function upcomingLitany(e: Entity, n = 3): string[] {
  const lit = getUnitDef(e.defId).litany ?? [];
  if (!lit.length) return [];
  const declared = (e.memory.step ?? 1) - 1;
  return Array.from({ length: n }, (_, i) => lit[(declared + i) % lit.length]);
}

/** Every demon (in board order) moves and declares its intent. */
export function planEnemies(s: GameState, ev: EventSink): void {
  const ctx: PlanContext = { order: 1 };
  for (const e of s.entities.slice()) {
    if (e.faction !== 'demon' || !s.entities.includes(e)) continue;
    for (const k of Object.keys(e.cooldowns)) if (e.cooldowns[k] > 0) e.cooldowns[k]--;
    e.intent = null;
    const b = behaviors.get(e.behavior);
    if (!b) throw new Error(`Unknown behaviour ${e.behavior}`);
    b(s, e, ev, ctx);
  }
}

