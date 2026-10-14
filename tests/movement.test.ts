import { describe, expect, it } from 'vitest';
import { board, byDef } from './helpers';
import { key, moveUnit, reachable } from '../src/core';

describe('movement and occupancy', () => {
  it('reaches tiles within move range by orthogonal steps', () => {
    const s = board(['.......', '.......', '.......', '...1...', '.......', '.......', '.......']);
    const r = reachable(s, byDef(s, 'penitent'));
    expect(r.has(key({ x: 3, y: 0 }))).toBe(true); // 3 north
    expect(r.has(key({ x: 5, y: 2 }))).toBe(true); // 2 east + 1 north
    expect(r.has(key({ x: 6, y: 2 }))).toBe(false); // 4 steps away
    expect(r.has(key({ x: 3, y: 3 }))).toBe(false); // start tile is not a destination
  });

  it('cannot end on or pass through enemies, structures, walls or the abyss', () => {
    const s = board(['.....', '.#H..', '.~1P.', '.....', '.....']);
    const r = reachable(s, byDef(s, 'penitent'));
    for (const p of [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 3, y: 2 }]) expect(r.has(key(p))).toBe(false);
    // the only way out is south, so the north side is out of reach
    expect(r.has(key({ x: 2, y: 0 }))).toBe(false);
    expect(r.has(key({ x: 4, y: 3 }))).toBe(true); // 3 steps: S, E, E
    expect(r.has(key({ x: 4, y: 2 }))).toBe(false); // 4 steps
  });

  it('allies can pass through each other but not stop on each other', () => {
    const s = board(['.....', '..2..', '..1..', '.....']);
    const r = reachable(s, byDef(s, 'penitent'));
    expect(r.has(key({ x: 2, y: 0 }))).toBe(true);
    expect(r.has(key({ x: 2, y: 1 }))).toBe(false);
  });

  it('demons will not walk onto hallowed ground', () => {
    const s = board(['.....', '.+++.', '.+H+.', '.+++.', '.....']);
    expect(reachable(s, byDef(s, 'hollow')).size).toBe(0);
  });

  it('moving marks the unit and rejects illegal destinations', () => {
    const s = board(['....', '.1..', '....']);
    const p = byDef(s, 'penitent');
    expect(() => moveUnit(s, p.id, { x: 3, y: 3 })).toThrow();
    moveUnit(s, p.id, { x: 3, y: 0 });
    expect(p.pos).toEqual({ x: 3, y: 0 });
    expect(() => moveUnit(s, p.id, { x: 2, y: 0 })).toThrow();
  });
});
