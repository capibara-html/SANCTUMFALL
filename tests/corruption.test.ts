import { describe, expect, it } from 'vitest';
import { alive, board, byDef } from './helpers';
import { applySpread, declareSpawns, declareSpread, emergeSpawns, endTurn, taintCount, tileAt, useAbility } from '../src/core';
import type { GameEvent } from '../src/core';

describe('corruption and purification', () => {
  it('wounds announce spread tiles next to existing Taint and apply them at the reckoning', () => {
    const s = board(['.....', '.,W..', '.....'], { spreadPerWound: 2 });
    declareSpread(s);
    expect(s.pendingSpread).toHaveLength(2);
    const before = taintCount(s);
    applySpread(s, []);
    expect(taintCount(s)).toBe(before + 2);
  });

  it('announced spread onto a tile that is hallowed in the meantime fails', () => {
    const s = board(['.+...', '+W...', '.+...'], { spreadPerWound: 3 });
    declareSpread(s);
    for (const p of s.pendingSpread) tileAt(s, p.at)!.consecrated = true;
    const before = taintCount(s);
    applySpread(s, []);
    expect(taintCount(s)).toBe(before);
  });

  it('spawn markers appear on Taint near a wound and become demons', () => {
    const s = board([',,,..', ',W,..', ',,,..'], { maxEnemies: 3, spawnFromRound: 1 });
    declareSpawns(s);
    expect(s.spawnMarkers).toHaveLength(1);
    const ev: GameEvent[] = [];
    emergeSpawns(s, ev);
    expect(ev.some((e) => e.t === 'spawn')).toBe(true);
    expect(s.entities.filter((e) => e.defId === 'hollow')).toHaveLength(1);
  });

  it('standing on a spawn site blocks it at the cost of 1 health', () => {
    const s = board([',,,..', ',W,..', ',,,.1'], { maxEnemies: 3, spawnFromRound: 1 });
    s.spawnMarkers = [{ at: { x: 4, y: 2 }, defId: 'hollow', sourceId: byDef(s, 'wound').id }];
    const p = byDef(s, 'penitent');
    emergeSpawns(s, []);
    expect(p.hp).toBe(3);
    expect(s.entities.some((e) => e.defId === 'hollow')).toBe(false);
  });

  it('hallowed spawn sites stay empty', () => {
    const s = board([',,,..', ',W,..', ',,+..']);
    s.spawnMarkers = [{ at: { x: 2, y: 2 }, defId: 'hollow', sourceId: byDef(s, 'wound').id }];
    const ev: GameEvent[] = [];
    emergeSpawns(s, ev);
    expect(ev[0]).toMatchObject({ t: 'spawnBlocked', reason: 'hallowed' });
  });

  it('sealing a wound removes its pending spawns and spread', () => {
    const s = board([',,,..', ',W1..', ',,,..'], { maxEnemies: 3, spawnFromRound: 1, spreadPerWound: 1 });
    declareSpread(s);
    declareSpawns(s);
    expect(s.spawnMarkers.length + s.pendingSpread.length).toBeGreaterThan(0);
    const w = byDef(s, 'wound');
    w.hp = 1;
    useAbility(s, { abilityId: 'censer_flail', sourceId: byDef(s, 'penitent').id, dir: 3 });
    expect(alive(s, w)).toBe(false);
    expect(s.spawnMarkers).toHaveLength(0);
    expect(s.pendingSpread).toHaveLength(0);
  });

  it('Vigil units standing on Taint are hurt at the reckoning', () => {
    const s = board(['....', '.H..', '....', '...1']);
    tileAt(s, { x: 3, y: 3 })!.corrupted = true;
    const p = byDef(s, 'penitent');
    endTurn(s);
    expect(p.hp).toBeLessThan(4);
  });
});
