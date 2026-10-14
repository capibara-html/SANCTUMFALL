import { describe, expect, it } from 'vitest';
import { board, byDef } from './helpers';
import { BattleSession, checkOutcome, endTurn, getEncounter, listEncounters, taintCount, tileAt, useAbility } from '../src/core';
import type { GameEvent } from '../src/core';

describe('victory and defeat', () => {
  it('sealing the last wound wins immediately', () => {
    const s = board(['.W1..'], { objectives: [{ kind: 'sealWounds', label: 'Seal' }] });
    byDef(s, 'wound').hp = 2;
    const ev = useAbility(s, { abilityId: 'censer_flail', sourceId: byDef(s, 'penitent').id, dir: 3 });
    expect(s.phase).toBe('victory');
    expect(ev.at(-1)).toMatchObject({ t: 'outcome', victory: true });
  });

  it('losing the whole Vigil is a defeat', () => {
    const s = board(['W.1', '...'], { objectives: [{ kind: 'sealWounds', label: 'Seal' }] });
    s.entities = s.entities.filter((e) => e.faction !== 'vigil');
    const ev: GameEvent[] = [];
    checkOutcome(s, ev);
    expect(s.phase).toBe('defeat');
  });

  it('the Taint reaching its limit at the end of a round is a defeat', () => {
    const s = board([',,,,', ',W,,', '...1'], { objectives: [{ kind: 'sealWounds', label: 'Seal' }], taintLimit: 9, spreadPerWound: 1 });
    expect(taintCount(s)).toBe(8);
    s.pendingSpread = [{ at: { x: 0, y: 2 }, sourceId: byDef(s, 'wound').id }];
    endTurn(s);
    expect(s.phase).toBe('defeat');
    expect(s.outcome?.reason).toMatch(/Taint/);
  });

  it('a destroyed protected structure fails a primary protect objective', () => {
    const s = board(['WS1'], { objectives: [{ kind: 'sealWounds', label: 'Seal' }, { kind: 'protect', label: 'Keep the shrine', target: 'shrine' }] });
    byDef(s, 'shrine').hp = 1;
    useAbility(s, { abilityId: 'censer_flail', sourceId: byDef(s, 'penitent').id, dir: 3 });
    expect(s.phase).toBe('defeat');
  });

  it('nothing can act after the battle ends', () => {
    const s = board(['.W1..'], { objectives: [{ kind: 'sealWounds', label: 'Seal' }] });
    byDef(s, 'wound').hp = 1;
    useAbility(s, { abilityId: 'censer_flail', sourceId: byDef(s, 'penitent').id, dir: 3 });
    expect(endTurn(s)).toEqual([]);
  });
});

describe('battle session: undo, reset and restart', () => {
  it('undoes the last move while the unit has not acted', () => {
    const b = new BattleSession('ashen_parish');
    const p = b.state.entities.find((e) => e.defId === 'penitent')!;
    const start = { ...p.pos };
    b.move(p.id, { x: start.x - 1, y: start.y });
    expect(b.undoableUnit).toBe(p.id);
    b.undoMove();
    expect(b.state.entities.find((e) => e.id === p.id)!.pos).toEqual(start);
    expect(b.state.entities.find((e) => e.id === p.id)!.moved).toBe(false);
  });

  it('acting clears the undo stack', () => {
    const b = new BattleSession('ashen_parish');
    const c = b.state.entities.find((e) => e.defId === 'consecrator')!;
    b.move(c.id, { x: c.pos.x, y: c.pos.y - 1 });
    b.act({ abilityId: 'sanctuary', sourceId: c.id, offset: { x: 0, y: 0 } });
    expect(b.undoableUnit).toBeNull();
    expect(b.undoMove()).toBe(false);
  });

  it('resets the turn once per battle', () => {
    const b = new BattleSession('ashen_parish');
    const before = JSON.stringify(b.state);
    const c = b.state.entities.find((e) => e.defId === 'consecrator')!;
    b.act({ abilityId: 'sanctuary', sourceId: c.id, offset: { x: 0, y: 0 } });
    expect(b.canResetTurn).toBe(true);
    b.resetTurn();
    expect(JSON.stringify(b.state)).toBe(before);
    b.act({ abilityId: 'sanctuary', sourceId: c.id, offset: { x: 0, y: 0 } });
    expect(b.canResetTurn).toBe(false);
  });

  it('a fresh session restarts the encounter from identical state', () => {
    const a = new BattleSession('drowned_nave');
    a.endTurn();
    const b = new BattleSession('drowned_nave');
    const c = new BattleSession('drowned_nave');
    expect(JSON.stringify(b.state)).toBe(JSON.stringify(c.state));
    expect(JSON.stringify(a.state)).not.toBe(JSON.stringify(b.state));
  });

  it('ending a turn advances the round and refreshes the Vigil', () => {
    const b = new BattleSession('ashen_parish');
    const c = b.state.entities.find((e) => e.defId === 'consecrator')!;
    b.act({ abilityId: 'sanctuary', sourceId: c.id, offset: { x: 0, y: 0 } });
    b.endTurn();
    expect(b.state.round).toBe(2);
    const c2 = b.state.entities.find((e) => e.id === c.id);
    if (c2) {
      expect(c2.acted).toBe(false);
      expect(c2.cooldowns.sanctuary).toBe(1);
    }
  });
});

describe('content integrity', () => {
  it('every encounter builds and survives ten passive rounds without errors', () => {
    for (const enc of listEncounters().filter((e) => !e.id.startsWith('test_'))) {
      const b = new BattleSession(enc.id);
      for (let i = 0; i < 10 && b.state.phase === 'player'; i++) b.endTurn();
      expect(['player', 'victory', 'defeat']).toContain(b.state.phase);
      expect(getEncounter(enc.id).objectives.some((o) => !o.bonus)).toBe(true);
    }
  });

  it('hallowed tiles stay uncorrupted', () => {
    const b = new BattleSession('ashen_parish');
    for (let i = 0; i < 4 && b.state.phase === 'player'; i++) b.endTurn();
    for (const t of b.state.tiles) expect(t.corrupted && t.consecrated).toBe(false);
    void tileAt;
  });
});
