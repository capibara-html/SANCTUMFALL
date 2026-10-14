import { describe, expect, it } from 'vitest';
import '../src/content';
import { BattleSession, cloneState, footprint, forecastUse, key, reachable, targetOptions } from '../src/core';
import type { AbilityUse, GameState } from '../src/core';

/** Small deterministic PRNG so the fuzz run is reproducible. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function checkInvariants(s: GameState): void {
  const seen = new Set<string>();
  for (const e of s.entities) {
    expect(e.hp).toBeGreaterThan(0);
    expect(e.hp).toBeLessThanOrEqual(e.maxHp);
    for (const p of footprint(e)) {
      const k = key(p);
      expect(seen.has(k), `two entities on ${k}`).toBe(false);
      seen.add(k);
      expect(p.x >= 0 && p.y >= 0 && p.x < s.width && p.y < s.height).toBe(true);
    }
  }
  for (const t of s.tiles) expect(t.corrupted && t.consecrated).toBe(false);
}

describe('rules hold under random play', () => {
  for (const enc of ['ashen_parish', 'drowned_nave']) {
    it(`${enc}: random legal turns never break invariants, and previews always match outcomes`, () => {
      const rand = rng(enc.length * 7919);
      for (let game = 0; game < 6; game++) {
        const b = new BattleSession(enc);
        for (let round = 0; round < 12 && b.state.phase === 'player'; round++) {
          for (const u of b.state.entities.filter((e) => e.faction === 'vigil')) {
            if (b.state.phase !== 'player' || !b.state.entities.includes(u)) continue;
            const dests = [...reachable(b.state, u).values()];
            if (dests.length && rand() < 0.7) b.move(u.id, dests[Math.floor(rand() * dests.length)].at(-1)!);
            const uses: AbilityUse[] = [];
            for (const ab of u.abilities) if ((u.cooldowns[ab] ?? 0) <= 0) for (const o of targetOptions(b.state, u, ab)) uses.push(o.use);
            if (!uses.length || rand() < 0.15) continue;
            const use = uses[Math.floor(rand() * uses.length)];
            const predicted = forecastUse(b.state, use).after;
            b.act(use);
            // the forecast is the same rules engine: apart from the actor's
            // turn flags and the outcome check, the states must agree exactly
            const actual = cloneState(b.state);
            for (const st of [predicted, actual]) {
              st.phase = 'player';
              st.outcome = null;
              const me = st.entities.find((e) => e.id === u.id);
              if (me) {
                me.acted = me.moved = true;
                me.cooldowns = {};
              }
            }
            expect(JSON.stringify(predicted)).toBe(JSON.stringify(actual));
            checkInvariants(b.state);
          }
          b.endTurn();
          checkInvariants(b.state);
        }
      }
    });
  }
});
