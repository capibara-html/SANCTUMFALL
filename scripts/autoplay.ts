// Balance probe: a greedy bot plays an encounter with the real rules.
// For each unit it tries every (destination, ability use) pair, imagines the
// Reckoning that would follow, and keeps the best-scoring plan.
// Usage: npx tsx scripts/autoplay.ts [encounter] [games]
import '../src/content';
import {
  BattleSession, cloneState, forecastReckoning, getEntity, hasTag, moveUnit, reachable, taintCount, targetOptions, useAbility,
} from '../src/core';
import type { AbilityUse, GameState, Vec } from '../src/core';

function evaluate(s: GameState): number {
  if (s.phase === 'victory') return 1e6;
  if (s.phase === 'defeat') return -1e6;
  const f = forecastReckoning(s);
  const a = f.after;
  if (a.phase === 'defeat') return -5e5;
  let v = 0;
  for (const e of a.entities) {
    if (e.faction === 'vigil') v += 30 + e.hp * 12;
    else if (hasTag(e, 'boss')) v -= e.hp * 30;
    else if (hasTag(e, 'wound')) v -= 60 + e.hp * 22;
    else if (hasTag(e, 'shrine')) v += 10 + e.hp * 5;
    else if (e.faction === 'demon') v -= 14 + e.hp * 6 + (e.intent ? 4 : 0);
  }
  v -= taintCount(a) * 5;
  v -= a.spawnMarkers.length * 6;
  return v;
}

function bestPlan(s: GameState, id: string): { to: Vec | null; use: AbilityUse | null; score: number } {
  const u = getEntity(s, id)!;
  const dests: (Vec | null)[] = [null, ...[...reachable(s, u).values()].map((p) => p[p.length - 1])];
  let best = { to: null as Vec | null, use: null as AbilityUse | null, score: -Infinity };
  for (const to of dests) {
    const moved = cloneState(s);
    if (to) moveUnit(moved, id, to);
    const me = getEntity(moved, id)!;
    const uses: (AbilityUse | null)[] = [null];
    for (const ab of me.abilities) if ((me.cooldowns[ab] ?? 0) <= 0) for (const o of targetOptions(moved, me, ab)) uses.push(o.use);
    for (const use of uses) {
      const sim = cloneState(moved);
      if (use) useAbility(sim, use);
      const score = evaluate(sim) + (use ? 0 : -1);
      if (score > best.score) best = { to, use, score };
    }
  }
  return best;
}

function play(encId: string, verbose: boolean): { won: boolean; rounds: number; reason: string; fallen: number } {
  const b = new BattleSession(encId);
  for (let r = 0; r < 25 && b.state.phase === 'player'; r++) {
    // try units in every order, keep the best sequence
    const ids = b.state.entities.filter((e) => e.faction === 'vigil').map((e) => e.id);
    const orders = permutations(ids);
    let bestState: GameState | null = null;
    let bestScore = -Infinity;
    for (const order of orders) {
      let s = cloneState(b.state);
      for (const id of order) {
        if (s.phase !== 'player' || !getEntity(s, id)) continue;
        const p = bestPlan(s, id);
        if (p.to) moveUnit(s, id, p.to);
        if (p.use) useAbility(s, p.use);
      }
      const sc = evaluate(s);
      if (sc > bestScore) { bestScore = sc; bestState = s; }
    }
    b.state = bestState!;
    if (b.state.phase !== 'player') break;
    b.endTurn();
    if (verbose) console.log(`  round ${b.state.round} taint ${taintCount(b.state)}/${b.state.taintLimit} vigil ${b.state.entities.filter((e) => e.faction === 'vigil').map((e) => e.hp).join(',')} demons ${b.state.entities.filter((e) => e.faction === 'demon' && hasTag(e, 'demon')).length} wounds ${b.state.entities.filter((e) => hasTag(e, 'wound')).map((e) => e.hp).join(',')}`);
  }
  return { won: b.state.phase === 'victory', rounds: b.state.round, reason: b.state.outcome?.reason ?? 'timeout', fallen: b.state.stats.vigilFallen.length };
}

function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
}

const enc = process.argv[2] ?? 'ashen_parish';
const r = play(enc, true);
console.log(enc, r);
