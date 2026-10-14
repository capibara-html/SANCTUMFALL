// Mission objectives and the victory / defeat rules.
import { getEncounter } from './registry';
import { hasTag } from './grid';
import { taintCount } from './effects';
import type { EventSink } from './events';
import type { GameState, ObjectiveDef } from './types';

export interface ObjectiveStatus {
  def: ObjectiveDef;
  done: boolean;
  failed: boolean;
  progress: string;
}

export function objectiveStatus(s: GameState, def: ObjectiveDef): ObjectiveStatus {
  switch (def.kind) {
    case 'sealWounds': {
      const open = s.entities.filter((e) => hasTag(e, 'wound')).length;
      const total = open + s.stats.woundsSealed;
      return { def, done: open === 0, failed: false, progress: `${s.stats.woundsSealed}/${total}` };
    }
    case 'banishBoss': {
      const boss = s.entities.find((e) => hasTag(e, 'boss'));
      return { def, done: !boss, failed: false, progress: boss ? `${boss.hp}/${boss.maxHp}` : 'banished' };
    }
    case 'protect': {
      const alive = s.entities.some((e) => e.defId === def.target);
      return { def, done: alive && s.phase === 'victory', failed: !alive, progress: alive ? 'standing' : 'lost' };
    }
    case 'noLosses': {
      const lost = s.stats.vigilFallen.length;
      return { def, done: lost === 0 && s.phase === 'victory', failed: lost > 0, progress: lost ? `${lost} fallen` : 'none fallen' };
    }
    case 'drownDemons': {
      const n = s.stats.drownedDemons;
      const need = def.count ?? 1;
      return { def, done: n >= need, failed: false, progress: `${Math.min(n, need)}/${need}` };
    }
  }
}

export function allObjectives(s: GameState): ObjectiveStatus[] {
  return getEncounter(s.encounterId).objectives.map((d) => objectiveStatus(s, d));
}

/** Evaluate defeat first, then victory. Safe to call at any point. */
export function checkOutcome(s: GameState, ev: EventSink, endOfRound = false): void {
  if (s.phase !== 'player') return;
  let outcome: { victory: boolean; reason: string } | null = null;
  const enc = getEncounter(s.encounterId);
  if (!s.entities.some((e) => e.faction === 'vigil')) outcome = { victory: false, reason: 'The Vigil has fallen. No one remains to hold the line.' };
  else if (endOfRound && taintCount(s) >= s.taintLimit) outcome = { victory: false, reason: `The Taint has swallowed ${enc.name}. The land is lost.` };
  else {
    const primary = enc.objectives.filter((o) => !o.bonus).map((o) => objectiveStatus(s, o));
    const lost = primary.find((o) => o.failed);
    if (lost) outcome = { victory: false, reason: `${lost.def.label} — failed.` };
    else if (primary.length && primary.every((o) => o.done)) outcome = { victory: true, reason: enc.objectives.some((o) => o.kind === 'banishBoss') ? 'The entity is banished. The waters fall still.' : 'Every wound is sealed. The land exhales.' };
  }
  if (!outcome) return;
  s.phase = outcome.victory ? 'victory' : 'defeat';
  s.outcome = outcome;
  ev.push({ t: 'outcome', ...outcome });
}
