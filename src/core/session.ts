// A battle session wraps the rules engine with the conveniences a player
// expects: undoing a move that has not been followed by an action, and one
// full "turn reset" per battle. Snapshots are cheap clones of plain data.
import { cloneState } from './clone';
import { endTurn, moveUnit, startBattle, useAbility } from './turn';
import type { GameEvent } from './events';
import type { AbilityUse, GameState, Vec } from './types';

export const TURN_RESETS_PER_BATTLE = 1;

export class BattleSession {
  state: GameState;
  readonly encounterId: string;
  private turnStart: GameState;
  /** snapshots taken before each move, cleared when anything else happens */
  private moveStack: { unitId: string; before: GameState }[] = [];
  resetsLeft = TURN_RESETS_PER_BATTLE;
  /** events produced by the opening demon phase */
  readonly openingEvents: GameEvent[];

  constructor(encounterId: string) {
    this.encounterId = encounterId;
    const { state, events } = startBattle(encounterId);
    this.state = state;
    this.openingEvents = events;
    this.turnStart = cloneState(state);
  }

  move(unitId: string, to: Vec): GameEvent[] {
    const before = cloneState(this.state);
    const ev = moveUnit(this.state, unitId, to);
    this.moveStack.push({ unitId, before });
    return ev;
  }

  act(use: AbilityUse): GameEvent[] {
    const ev = useAbility(this.state, use);
    this.moveStack = [];
    return ev;
  }

  /** The most recent move can be taken back while nothing else has happened since. */
  get undoableUnit(): string | null {
    return this.moveStack.length ? this.moveStack[this.moveStack.length - 1].unitId : null;
  }

  undoMove(): boolean {
    const last = this.moveStack.pop();
    if (!last) return false;
    this.state = last.before;
    return true;
  }

  get canResetTurn(): boolean {
    return this.resetsLeft > 0 && this.state.phase === 'player' && JSON.stringify(this.state) !== JSON.stringify(this.turnStart);
  }

  resetTurn(): boolean {
    if (!this.canResetTurn) return false;
    this.resetsLeft--;
    this.state = cloneState(this.turnStart);
    this.moveStack = [];
    return true;
  }

  endTurn(): GameEvent[] {
    const ev = endTurn(this.state);
    this.moveStack = [];
    this.turnStart = cloneState(this.state);
    return ev;
  }
}
