import { describe, expect, it } from 'vitest';
import { alive, board, byDef } from './helpers';
import { BattleSession, RULES, endTurn, forecastIntent, planEnemies, upcomingLitany, useAbility, useFootprint } from '../src/core';

const NAVE = [
  'L~......',
  '~~......',
  '~~......',
  '~~.~....',
];

describe('Leviathan', () => {
  it('follows its litany: surge, maw, deep stirs, repeat', () => {
    const s = board(NAVE.map((r, i) => (i === 3 ? '~~.~..1.' : r)));
    const lev = byDef(s, 'leviathan');
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      planEnemies(s, []);
      seen.push(lev.intent!.abilityId);
      lev.intent = null;
    }
    expect(seen).toEqual(['tidal_surge', 'abyssal_maw', 'deep_stirs', 'tidal_surge']);
  });

  it('shows the declared rite and the two that follow', () => {
    const s = board(NAVE.map((r, i) => (i === 3 ? '~~.~..1.' : r)));
    const lev = byDef(s, 'leviathan');
    planEnemies(s, []);
    expect(upcomingLitany(lev)).toEqual(['tidal_surge', 'abyssal_maw', 'deep_stirs']);
  });

  it('Tidal Surge drags its rows toward the deep, drowning what falls in', () => {
    const s = board(['L~.H..', '~~..1.', '~~....']);
    const lev = byDef(s, 'leviathan');
    const h = byDef(s, 'hollow');
    h.pos = { x: 2, y: 0 };
    h.hp = 5;
    lev.intent = { abilityId: 'tidal_surge', sourceId: lev.id, dir: 3 };
    const p = byDef(s, 'penitent');
    const f = forecastIntent(s, lev.id)!;
    expect(f.entities.get(p.id)?.to).toEqual({ x: 3, y: 1 });
    // the hollow at the bank is crushed against the beast (bump), not drowned
    expect(f.entities.get(h.id)?.bumped).toBe(true);
  });

  it('Tidal Surge drowns units dragged into a flooded pit', () => {
    const s = board(['L~.~1.', '~~....']);
    const lev = byDef(s, 'leviathan');
    lev.intent = { abilityId: 'tidal_surge', sourceId: lev.id, dir: 3 };
    lev.intentOrder = 1;
    const p = byDef(s, 'penitent');
    endTurn(s);
    expect(alive(s, p)).toBe(false);
  });

  it('a rebuked surge pushes away from the deep instead', () => {
    const s = board(['L~..1.', '~~....', '~~3...']);
    const lev = byDef(s, 'leviathan');
    lev.intent = { abilityId: 'tidal_surge', sourceId: lev.id, dir: 3 };
    useAbility(s, { abilityId: 'rebuke', sourceId: byDef(s, 'inquisitor').id, offset: { x: -1, y: -1 } });
    expect(lev.intent.dir).toBe(1);
    const f = forecastIntent(s, lev.id)!;
    expect(f.entities.get(byDef(s, 'penitent').id)?.to).toEqual({ x: 5, y: 0 });
  });

  it('The Deep Stirs cannot be rebuked', () => {
    const s = board(['L~....', '~~....', '~~3...']);
    const lev = byDef(s, 'leviathan');
    lev.intent = { abilityId: 'deep_stirs', sourceId: lev.id, offset: { x: 0, y: 1 } };
    expect(() => useAbility(s, { abilityId: 'rebuke', sourceId: byDef(s, 'inquisitor').id, offset: { x: -1, y: -1 } })).toThrow();
  });

  it('Abyssal Maw bites the 2x2 bank in front of it', () => {
    const s = board(['L~1...', '~~....']);
    const lev = byDef(s, 'leviathan');
    lev.intent = { abilityId: 'abyssal_maw', sourceId: lev.id, dir: 1 };
    const tiles = useFootprint(s, lev.intent).tiles;
    expect(tiles).toHaveLength(4);
    expect(forecastIntent(s, lev.id)!.entities.get(byDef(s, 'penitent').id)?.damage).toBe(3);
  });

  it('is warded while a bell stands; sealing a bell sears it', () => {
    const s = board(['L~1B..', '~~....'], { objectives: [{ kind: 'banishBoss', label: 'Banish' }] });
    const lev = byDef(s, 'leviathan');
    const p = byDef(s, 'penitent');
    const full = lev.maxHp;
    useAbility(s, { abilityId: 'censer_flail', sourceId: p.id, dir: 3 });
    expect(lev.hp).toBe(full);
    const bell = byDef(s, 'bell');
    bell.hp = 1;
    p.acted = false;
    useAbility(s, { abilityId: 'censer_flail', sourceId: p.id, dir: 1 });
    expect(alive(s, bell)).toBe(false);
    expect(lev.hp).toBe(full - RULES.bellSealDamage);
    p.acted = false;
    useAbility(s, { abilityId: 'censer_flail', sourceId: p.id, dir: 3 });
    expect(lev.hp).toBe(full - RULES.bellSealDamage - 2);
  });

  it('banishing the Leviathan wins the Drowned Nave', () => {
    const b = new BattleSession('drowned_nave');
    const s = b.state;
    s.entities = s.entities.filter((e) => e.defId !== 'bell');
    const lev = s.entities.find((e) => e.defId === 'leviathan')!;
    lev.hp = 1;
    const inq = s.entities.find((e) => e.defId === 'inquisitor')!;
    inq.pos = { x: 7, y: lev.pos.y };
    // clear the lane
    s.entities = s.entities.filter((e) => e === inq || e === lev || e.pos.y !== lev.pos.y || e.faction === 'vigil');
    b.act({ abilityId: 'chain_of_judgment', sourceId: inq.id, dir: 3 });
    expect(s.phase).toBe('victory');
  });
});
