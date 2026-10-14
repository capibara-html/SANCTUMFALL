// Ability resolution. One interpreter serves player skills, enemy intents and
// boss rites: targeting produces a plan (origin, impact, path), then the
// ability's effect list is applied in order at the impact.
import { getAbility } from './registry';
import { RULES } from './rules';
import {
  ALL_DIRS,
  DIRS,
  add,
  dirTo,
  entityAt,
  getEntity,
  hasTag,
  inBounds,
  manhattan,
  opposite,
  step,
  tileAt,
} from './grid';
import {
  cleanseTile,
  consecrateTile,
  corruptTile,
  dealDamage,
  heal,
  pushEntity,
  relocate,
} from './effects';
import type { EventSink } from './events';
import type { AbilityDef, AbilityUse, Dir, Effect, EffectArea, Entity, GameState, Vec } from './types';

export interface UsePlan {
  ability: AbilityDef;
  source: Entity;
  /** direction of the attack, used by forward/back pushes */
  dir: Dir | null;
  /** where the attack originates (charge end point for charges) */
  origin: Vec;
  impact: Vec | null;
  /** tiles travelled by a projectile or charge, for display */
  path: Vec[];
  chargeTo: Vec | null;
  empowered: boolean;
}

// --- specials ---------------------------------------------------------------

export type SpecialResolver = (s: GameState, plan: UsePlan, use: AbilityUse, ev: EventSink) => void;
export type SpecialPlanner = (s: GameState, source: Entity, use: AbilityUse) => SpecialFootprint;
export interface SpecialFootprint {
  tiles: Vec[];
  arrows: { at: Vec; dir: Dir }[];
}
/** Picks parameters for a scripted (litany) rite when a boss declares it. */
export type SpecialChooser = (s: GameState, source: Entity) => Omit<AbilityUse, 'abilityId' | 'sourceId'>;
interface SpecialDef {
  resolve: SpecialResolver;
  footprint: SpecialPlanner;
  choose?: SpecialChooser;
}
const specials = new Map<string, SpecialDef>();
export function registerSpecial(id: string, def: SpecialDef): void {
  specials.set(id, def);
}
export function getSpecial(id: string): SpecialDef {
  const sp = specials.get(id);
  if (!sp) throw new Error(`Unknown special: ${id}`);
  return sp;
}

// --- planning ---------------------------------------------------------------

/** Blocks a dash: anything that is not open floor, or hallowed ground for demons. */
function blocksCharge(s: GameState, src: Entity, p: Vec): boolean {
  const t = tileAt(s, p);
  if (!t || t.terrain !== 'floor') return true;
  if (entityAt(s, p)) return true;
  if (t.consecrated && hasTag(src, 'demon')) return true;
  return false;
}

export function planUse(s: GameState, use: AbilityUse): UsePlan | null {
  const source = getEntity(s, use.sourceId);
  if (!source) return null;
  const ability = getAbility(use.abilityId);
  const pos = source.pos;
  const dir = use.dir ?? null;
  const plan: UsePlan = { ability, source, dir, origin: { ...pos }, impact: null, path: [], chargeTo: null, empowered: false };
  const t = ability.targeting;

  switch (t.kind) {
    case 'melee': {
      if (dir === null) return null;
      const p = step(pos, dir);
      plan.impact = inBounds(s, p) ? p : null;
      break;
    }
    case 'projectile': {
      if (dir === null) return null;
      const max = t.maxRange ?? 99;
      let p = step(pos, dir);
      for (let i = 0; i < max && inBounds(s, p); i++) {
        plan.path.push(p);
        if (entityAt(s, p) || tileAt(s, p)!.terrain === 'wall') break;
        p = step(p, dir);
      }
      plan.impact = plan.path.length ? plan.path[plan.path.length - 1] : null;
      break;
    }
    case 'charge': {
      if (dir === null) return null;
      let p = { ...pos };
      for (;;) {
        const next = step(p, dir);
        if (!inBounds(s, next)) {
          plan.impact = null;
          break;
        }
        if (blocksCharge(s, source, next)) {
          plan.impact = next;
          break;
        }
        p = next;
        plan.path.push(p);
      }
      if (p.x !== pos.x || p.y !== pos.y) plan.chargeTo = p;
      plan.origin = { ...p };
      break;
    }
    case 'artillery': {
      if (dir === null) return null;
      const p = step(pos, dir, use.dist ?? 2);
      plan.impact = inBounds(s, p) ? p : null;
      break;
    }
    case 'tile': {
      const p = add(pos, use.offset ?? { x: 0, y: 0 });
      plan.impact = inBounds(s, p) ? p : null;
      break;
    }
    case 'self':
      plan.impact = { ...pos };
      break;
  }
  const originTile = tileAt(s, plan.origin);
  plan.empowered = source.faction === 'demon' && !!originTile?.corrupted;
  return plan;
}

export function areaTiles(s: GameState, impact: Vec, area: EffectArea = 'target'): Vec[] {
  const out: Vec[] = [];
  if (area !== 'adjacent') out.push(impact);
  if (area === 'plus' || area === 'adjacent') for (const d of ALL_DIRS) out.push(step(impact, d));
  return out.filter((p) => inBounds(s, p));
}

/** Every tile an ability use will touch — used for intent telegraphs. */
export function useFootprint(s: GameState, use: AbilityUse): SpecialFootprint & { plan: UsePlan | null } {
  const plan = planUse(s, use);
  if (!plan) return { tiles: [], arrows: [], plan };
  if (plan.ability.special) return { ...getSpecial(plan.ability.special).footprint(s, plan.source, use), plan };
  if (!plan.impact) return { tiles: [], arrows: [], plan };
  const set = new Map<string, Vec>();
  const arrows: { at: Vec; dir: Dir }[] = [];
  for (const eff of plan.ability.effects) {
    const tiles = areaTiles(s, plan.impact, 'area' in eff ? eff.area : 'target');
    for (const p of tiles) set.set(`${p.x},${p.y}`, p);
    if (eff.op === 'push') {
      for (const p of tiles) {
        const d = pushDir(eff.dir, plan, p);
        if (d !== null) arrows.push({ at: p, dir: d });
      }
    }
  }
  return { tiles: [...set.values()], arrows, plan };
}

function pushDir(kind: 'forward' | 'back' | 'outward', plan: UsePlan, p: Vec): Dir | null {
  if (kind === 'outward') return plan.impact ? dirTo(plan.impact, p) : null;
  if (plan.dir === null) return null;
  return kind === 'forward' ? plan.dir : opposite(plan.dir);
}

// --- resolution -------------------------------------------------------------

export function resolveUse(s: GameState, use: AbilityUse, ev: EventSink): void {
  const plan = planUse(s, use);
  if (!plan) return;
  const { ability, source } = plan;
  if (ability.special) {
    getSpecial(ability.special).resolve(s, plan, use, ev);
    return;
  }
  const tiles = plan.impact
    ? [...new Map(ability.effects.flatMap((e) => areaTiles(s, plan.impact!, 'area' in e ? e.area : 'target')).map((p) => [`${p.x},${p.y}`, p])).values()]
    : [];
  ev.push({ t: 'attack', sourceId: source.id, abilityId: ability.id, anim: ability.animation, from: { ...source.pos }, impact: plan.impact, dir: plan.dir, tiles });
  if (plan.chargeTo) {
    const from = { ...source.pos };
    relocate(source, plan.chargeTo);
    ev.push({ t: 'charge', id: source.id, from, to: { ...plan.chargeTo } });
  }
  if (!plan.impact) return;
  for (const eff of ability.effects) applyEffect(s, plan, eff, ev);
}

function entitiesOn(s: GameState, tiles: Vec[]): Entity[] {
  const out: Entity[] = [];
  for (const p of tiles) {
    const e = entityAt(s, p);
    if (e && !out.includes(e)) out.push(e);
  }
  return out;
}

export function applyEffect(s: GameState, plan: UsePlan, eff: Effect, ev: EventSink): void {
  const impact = plan.impact!;
  const tiles = areaTiles(s, impact, 'area' in eff ? eff.area : 'target');
  switch (eff.op) {
    case 'damage': {
      const bonus = plan.empowered ? RULES.taintEmpower : 0;
      for (const e of entitiesOn(s, tiles)) {
        if (eff.only && !hasTag(e, eff.only)) continue;
        dealDamage(s, e, eff.amount + bonus, plan.ability.id, ev);
      }
      break;
    }
    case 'push': {
      // Resolve the entity furthest along the push first so lines of units
      // slide coherently instead of bumping into each other.
      const targets = tiles
        .map((p) => ({ p, e: entityAt(s, p), d: pushDir(eff.dir, plan, p) }))
        .filter((x): x is { p: Vec; e: Entity; d: Dir } => !!x.e && x.d !== null);
      targets.sort((a, b) => {
        const v = DIRS[a.d];
        return b.p.x * v.x + b.p.y * v.y - (a.p.x * v.x + a.p.y * v.y);
      });
      const done = new Set<Entity>();
      for (const { e, d } of targets) {
        if (done.has(e)) continue;
        done.add(e);
        pushEntity(s, e, d, ev);
      }
      break;
    }
    case 'corrupt':
      for (const p of tiles) corruptTile(s, p, plan.ability.id, ev);
      break;
    case 'cleanse':
      for (const p of tiles) cleanseTile(s, p, plan.ability.id, ev);
      break;
    case 'consecrate':
      for (const p of tiles) consecrateTile(s, p, plan.ability.id, ev);
      break;
    case 'shield': {
      const e = entityAt(s, impact);
      if (e) {
        e.shield = true;
        ev.push({ t: 'shield', id: e.id });
      }
      break;
    }
    case 'heal': {
      const e = entityAt(s, impact);
      if (e) heal(e, eff.amount, ev);
      break;
    }
    case 'rebuke': {
      const e = entityAt(s, impact);
      if (e) rebuke(e, ev);
      break;
    }
  }
}

/** Turn a declared attack around; non-directional rites are silenced instead. */
export function rebuke(e: Entity, ev: EventSink): void {
  if (!e.intent) return;
  if (e.intent.dir !== undefined) {
    e.intent.dir = opposite(e.intent.dir);
    e.intent.rebuked = true;
    ev.push({ t: 'rebuke', id: e.id, silenced: false });
  } else if (!hasTag(e, 'massive')) {
    e.intent = null;
    ev.push({ t: 'rebuke', id: e.id, silenced: true });
  }
}

export function canBeRebuked(e: Entity): boolean {
  return !!e.intent && (e.intent.dir !== undefined || !hasTag(e, 'massive'));
}

// --- target options (player UI and AI share these) ---------------------------

export interface TargetOption {
  use: AbilityUse;
  /** tiles the player can click to choose this option */
  tiles: Vec[];
}

export function targetOptions(s: GameState, source: Entity, abilityId: string): TargetOption[] {
  const ability = getAbility(abilityId);
  const t = ability.targeting;
  const base = { abilityId, sourceId: source.id };
  const out: TargetOption[] = [];
  const pos = source.pos;
  switch (t.kind) {
    case 'melee':
      for (const d of ALL_DIRS) {
        const p = step(pos, d);
        if (inBounds(s, p)) out.push({ use: { ...base, dir: d }, tiles: [p] });
      }
      break;
    case 'projectile':
    case 'charge':
      for (const d of ALL_DIRS) {
        const line: Vec[] = [];
        for (let p = step(pos, d); inBounds(s, p); p = step(p, d)) line.push(p);
        if (line.length) out.push({ use: { ...base, dir: d }, tiles: line });
      }
      break;
    case 'artillery':
      for (const d of ALL_DIRS)
        for (let n = t.minRange ?? 2; n <= (t.maxRange ?? 4); n++) {
          const p = step(pos, d, n);
          if (inBounds(s, p)) out.push({ use: { ...base, dir: d, dist: n }, tiles: [p] });
        }
      break;
    case 'tile':
      for (let y = 0; y < s.height; y++)
        for (let x = 0; x < s.width; x++) {
          const p = { x, y };
          const r = manhattan(pos, p);
          if (r < (t.minRange ?? 0) || r > (t.maxRange ?? 99)) continue;
          if (tileAt(s, p)!.terrain === 'wall') continue;
          const occ = entityAt(s, p);
          if (t.requires === 'ally' && !(occ && occ.faction !== 'demon')) continue;
          if (t.requires === 'enemyWithIntent' && !(occ && occ.faction === 'demon' && canBeRebuked(occ))) continue;
          out.push({ use: { ...base, offset: { x: x - pos.x, y: y - pos.y } }, tiles: [p] });
        }
      break;
    case 'self':
      out.push({ use: { ...base }, tiles: [{ ...pos }] });
      break;
  }
  return out;
}
