import { describe, expect, it } from 'vitest';
import { alive, board, byDef } from './helpers';
import { endTurn, forecastIntent, forecastReckoning, planEnemies, useAbility, useFootprint } from '../src/core';
import type { GameEvent } from '../src/core';

describe('enemy intent prediction', () => {
  it('a demon in reach moves next to a Vigil unit and telegraphs a strike on it', () => {
    const s = board(['.....', '1...H', '.....']);
    const ev: GameEvent[] = [];
    planEnemies(s, ev);
    const h = byDef(s, 'hollow');
    expect(h.intent?.abilityId).toBe('rend');
    const f = forecastIntent(s, h.id)!;
    expect(f.entities.get(byDef(s, 'penitent').id)?.damage).toBe(1);
  });

  it('planning is deterministic', () => {
    const a = board(['..h..', '1...g', '..2..']);
    const b = board(['..h..', '1...g', '..2..']);
    planEnemies(a, []);
    planEnemies(b, []);
    expect(a.entities.map((e) => [e.pos, e.intent])).toEqual(b.entities.map((e) => [e.pos, e.intent]));
  });

  it('demons never telegraph an attack that would only hurt their own', () => {
    const s = board(['H.h..', '.....']);
    planEnemies(s, []);
    expect(s.entities.every((e) => e.intent === null)).toBe(true);
  });

  it('the forecast of the whole reckoning matches what endTurn actually does', () => {
    const s = board(['.g...', '.....', '1..h.', '..2..']);
    planEnemies(s, []);
    const f = forecastReckoning(s);
    const p = byDef(s, 'penitent');
    const predicted = f.entities.get(p.id)?.damage ?? 0;
    const before = p.hp;
    endTurn(s);
    expect(before - (alive(s, p) ? p.hp : 0)).toBe(predicted);
  });
});

describe('resolution and interrupts', () => {
  it('a directional intent follows its demon when it is pushed (dodged)', () => {
    const s = board(['1h...', '.....']);
    const h = byDef(s, 'hollow');
    h.hp = h.maxHp = 5;
    h.intent = { abilityId: 'rend', sourceId: h.id, dir: 3 };
    h.intentOrder = 1;
    const p = byDef(s, 'penitent');
    useAbility(s, { abilityId: 'censer_flail', sourceId: p.id, dir: 1 });
    expect(h.pos).toEqual({ x: 2, y: 0 });
    // the claw still swipes west — at the now-empty tile beside it
    expect(useFootprint(s, h.intent).tiles).toEqual([{ x: 1, y: 0 }]);
    endTurn(s);
    expect(p.hp).toBe(4);
  });

  it('killing a demon cancels its declared attack', () => {
    const s = board(['1h...']);
    const h = byDef(s, 'hollow');
    h.intent = { abilityId: 'rend', sourceId: h.id, dir: 3 };
    useAbility(s, { abilityId: 'censer_flail', sourceId: byDef(s, 'penitent').id, dir: 1 });
    expect(alive(s, h)).toBe(false);
    const p = byDef(s, 'penitent');
    endTurn(s);
    expect(p.hp).toBe(4);
  });

  it('a charge telegraphed through an open lane hits whatever is placed in it', () => {
    const s = board(['g...1', '..H..']);
    const g = byDef(s, 'gorehound');
    g.intent = { abilityId: 'gore_rush', sourceId: g.id, dir: 1 };
    g.intentOrder = 1;
    const h = byDef(s, 'hollow');
    h.pos = { x: 2, y: 0 }; // something steps into the lane
    const f = forecastIntent(s, g.id)!;
    expect(f.entities.get(h.id)?.dies).toBe(true);
    expect(f.entities.has(byDef(s, 'penitent').id)).toBe(false);
  });

  it('Rebuke reverses a directional attack', () => {
    const s = board(['.1h.3']);
    const h = byDef(s, 'hollow');
    h.intent = { abilityId: 'rend', sourceId: h.id, dir: 3 };
    useAbility(s, { abilityId: 'rebuke', sourceId: byDef(s, 'inquisitor').id, offset: { x: -2, y: 0 } });
    expect(h.intent?.dir).toBe(1);
    expect(h.intent?.rebuked).toBe(true);
  });

  it('Rebuke silences a rite with no direction', () => {
    const s = board(['1x.3.']);
    const x = byDef(s, 'chanter');
    x.intent = { abilityId: 'profane_rite', sourceId: x.id };
    useAbility(s, { abilityId: 'rebuke', sourceId: byDef(s, 'inquisitor').id, offset: { x: -2, y: 0 } });
    expect(x.intent).toBeNull();
  });

  it('intents resolve in their declared order', () => {
    const s = board(['1h..', 'g...']);
    const h = byDef(s, 'hollow');
    const g = byDef(s, 'gorehound');
    // gore rush first knocks the penitent north... off the board (bump), then the hollow claws
    g.intent = { abilityId: 'gore_rush', sourceId: g.id, dir: 0 };
    g.intentOrder = 1;
    h.intent = { abilityId: 'rend', sourceId: h.id, dir: 3 };
    h.intentOrder = 2;
    const ev = endTurn(s);
    const attacks = ev.filter((e) => e.t === 'attack').map((e) => (e as { sourceId: string }).sourceId);
    expect(attacks.slice(0, 2)).toEqual([g.id, h.id]);
  });
});
