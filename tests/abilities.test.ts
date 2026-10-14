import { describe, expect, it } from 'vitest';
import { alive, board, byDef } from './helpers';
import { isLegalUse, targetOptions, useAbility, forecastUse, tileAt, RULES } from '../src/core';

describe('ability ranges and restrictions', () => {
  it('melee abilities target the four adjacent tiles inside the board', () => {
    const s = board(['1...', '....']);
    const opts = targetOptions(s, byDef(s, 'penitent'), 'censer_flail');
    expect(opts.map((o) => o.use.dir).sort()).toEqual([1, 2]);
  });

  it('Hallow reaches any tile within 3 but not the caster or walls', () => {
    const s = board(['.......', '...#...', '...2...', '.......', '.......', '.......']);
    const opts = targetOptions(s, byDef(s, 'consecrator'), 'hallow');
    const tiles = opts.map((o) => `${o.tiles[0].x},${o.tiles[0].y}`);
    expect(tiles).not.toContain('3,2');
    expect(tiles).not.toContain('3,1');
    expect(tiles).toContain('3,5');
    expect(tiles).not.toContain('0,5'); // distance 6
  });

  it('Rebuke may only target demons that declared something', () => {
    const s = board(['3.H..']);
    expect(targetOptions(s, byDef(s, 'inquisitor'), 'rebuke')).toHaveLength(0);
    byDef(s, 'hollow').intent = { abilityId: 'rend', sourceId: byDef(s, 'hollow').id, dir: 3 };
    expect(targetOptions(s, byDef(s, 'inquisitor'), 'rebuke')).toHaveLength(1);
  });

  it('a unit acts once per round and cooldowns block reuse', () => {
    const s = board(['1H...']);
    const p = byDef(s, 'penitent');
    const charge = { abilityId: 'zealous_charge', sourceId: p.id, dir: 1 as const };
    expect(isLegalUse(s, charge)).toBe(true);
    useAbility(s, charge);
    expect(p.acted).toBe(true);
    expect(isLegalUse(s, { abilityId: 'censer_flail', sourceId: p.id, dir: 1 })).toBe(false);
    p.acted = false;
    expect(isLegalUse(s, charge)).toBe(false); // cooldown
  });
});

describe('damage and forced movement', () => {
  it('Censer Flail deals 2 and knocks the target back', () => {
    const s = board(['1h...']);
    const h = byDef(s, 'hollow');
    h.hp = 3;
    h.maxHp = 3;
    useAbility(s, { abilityId: 'censer_flail', sourceId: byDef(s, 'penitent').id, dir: 1 });
    expect(h.hp).toBe(1);
    expect(h.pos).toEqual({ x: 2, y: 0 });
  });

  it('pushing into an obstacle bumps both for 1 and nothing moves', () => {
    const s = board(['1gP..']);
    const g = byDef(s, 'gorehound');
    const pillar = byDef(s, 'pillar');
    useAbility(s, { abilityId: 'censer_flail', sourceId: byDef(s, 'penitent').id, dir: 1 });
    expect(g.pos).toEqual({ x: 1, y: 0 });
    expect(g.hp).toBe(3 - 2 - RULES.bumpDamage);
    expect(pillar.hp).toBe(2 - RULES.bumpDamage);
  });

  it('pushing into another demon hurts both (demons used against demons)', () => {
    const s = board(['1gH..']);
    const h = byDef(s, 'hollow');
    useAbility(s, { abilityId: 'censer_flail', sourceId: byDef(s, 'penitent').id, dir: 1 });
    expect(h.hp).toBe(1);
  });

  it('pushing off the board edge bumps', () => {
    const s = board(['..1g']);
    const g = byDef(s, 'gorehound');
    useAbility(s, { abilityId: 'censer_flail', sourceId: byDef(s, 'penitent').id, dir: 1 });
    expect(g.hp).toBe(0 + 3 - 3);
    expect(alive(s, g)).toBe(false);
  });

  it('pushing into the abyss drowns', () => {
    const s = board(['1g~.']);
    const g = byDef(s, 'gorehound');
    g.hp = 9;
    useAbility(s, { abilityId: 'censer_flail', sourceId: byDef(s, 'penitent').id, dir: 1 });
    expect(alive(s, g)).toBe(false);
    expect(s.stats.drownedDemons).toBe(1);
  });

  it('demons forced onto hallowed ground burn', () => {
    const s = board(['1g+.']);
    const g = byDef(s, 'gorehound');
    useAbility(s, { abilityId: 'censer_flail', sourceId: byDef(s, 'penitent').id, dir: 1 });
    expect(g.pos).toEqual({ x: 2, y: 0 });
    expect(g.hp).toBe(3 - 2 - RULES.hallowBurn);
  });

  it('Chain of Judgment hits the first thing in line and drags it closer', () => {
    const s = board(['3..H.g']);
    const h = byDef(s, 'hollow');
    const g = byDef(s, 'gorehound');
    useAbility(s, { abilityId: 'chain_of_judgment', sourceId: byDef(s, 'inquisitor').id, dir: 1 });
    expect(h.hp).toBe(1);
    expect(h.pos).toEqual({ x: 2, y: 0 });
    expect(g.hp).toBe(3);
  });

  it('Zealous Charge dashes until blocked and strikes the blocker', () => {
    const s = board(['1...H.']);
    const p = byDef(s, 'penitent');
    const h = byDef(s, 'hollow');
    useAbility(s, { abilityId: 'zealous_charge', sourceId: p.id, dir: 1 });
    expect(p.pos).toEqual({ x: 3, y: 0 });
    expect(h.hp).toBe(1);
    expect(h.pos).toEqual({ x: 5, y: 0 });
  });

  it('a ward absorbs exactly one instance of damage', () => {
    const s = board(['21h..']);
    const p = byDef(s, 'penitent');
    useAbility(s, { abilityId: 'sanctuary', sourceId: byDef(s, 'consecrator').id, offset: { x: 1, y: 0 } });
    expect(p.shield).toBe(true);
    const h = byDef(s, 'hollow');
    h.intent = { abilityId: 'rend', sourceId: h.id, dir: 3 };
    const f = forecastUse(s, h.intent);
    expect(f.entities.get(p.id)?.shieldLost).toBe(true);
    expect(f.entities.get(p.id)?.damage).toBe(0);
  });
});

describe('terrain effects', () => {
  it('Hallow cleanses Taint, consecrates and burns demons', () => {
    const s = board(['2.h..']);
    const h = byDef(s, 'hollow');
    useAbility(s, { abilityId: 'hallow', sourceId: byDef(s, 'consecrator').id, offset: { x: 2, y: 0 } });
    const t = tileAt(s, { x: 2, y: 0 })!;
    expect(t.corrupted).toBe(false);
    expect(t.consecrated).toBe(true);
    expect(h.hp).toBe(1);
  });

  it('Hallow sears wounds for 2 and sealing cleanses the area around them', () => {
    const s = board([',,,..', ',W,..', ',,,2.']);
    const w = byDef(s, 'wound');
    w.hp = 2;
    useAbility(s, { abilityId: 'hallow', sourceId: byDef(s, 'consecrator').id, offset: { x: -2, y: -1 } });
    expect(alive(s, w)).toBe(false);
    expect(s.stats.woundsSealed).toBe(1);
    for (const p of [{ x: 0, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 2 }]) expect(tileAt(s, p)!.corrupted).toBe(false);
    expect(tileAt(s, { x: 0, y: 0 })!.corrupted).toBe(true); // diagonal stays
    expect(tileAt(s, { x: 1, y: 1 })!.consecrated).toBe(true);
  });

  it('Taint cannot be laid on hallowed ground', () => {
    const s = board(['c..+.']);
    const c = byDef(s, 'cantor');
    const f = forecastUse(s, { abilityId: 'bile_hymn', sourceId: c.id, dir: 1, dist: 3 });
    expect(f.tiles.some((t) => t.at.x === 3 && t.corrupted)).toBe(false);
    const g = forecastUse(s, { abilityId: 'bile_hymn', sourceId: c.id, dir: 1, dist: 2 });
    expect(g.tiles.some((t) => t.at.x === 2 && t.corrupted)).toBe(true);
  });

  it('demons attacking from Taint strike harder', () => {
    const s = board(['h1', 'H2']);
    const f1 = forecastUse(s, { abilityId: 'rend', sourceId: byDef(s, 'hollow', 0).id, dir: 1 });
    expect(f1.entities.get(byDef(s, 'penitent').id)?.damage).toBe(1 + RULES.taintEmpower);
    const f2 = forecastUse(s, { abilityId: 'rend', sourceId: byDef(s, 'hollow', 1).id, dir: 1 });
    expect(f2.entities.get(byDef(s, 'consecrator').id)?.damage).toBe(1);
  });
});
