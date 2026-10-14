// Events describe what happened, in order. The engine mutates state and emits
// events; the presentation layer replays them as animations. Previews run the
// same code on a cloned state and read the events, so what the player sees in
// a preview is exactly what will happen.
import type { AnimationKind, Dir, Vec } from './types';

export type DeathCause = 'damage' | 'drown';

export type GameEvent =
  | { t: 'move'; id: string; path: Vec[] }
  | { t: 'push'; id: string; from: Vec; to: Vec; dir: Dir }
  | { t: 'bump'; id: string; at: Vec; dir: Dir; into: string | null }
  | { t: 'resist'; id: string; dir: Dir }
  | { t: 'damage'; id: string; amount: number; hp: number; cause: string }
  | { t: 'shieldBlock'; id: string }
  | { t: 'shield'; id: string }
  | { t: 'heal'; id: string; amount: number; hp: number }
  | { t: 'death'; id: string; cause: DeathCause; at: Vec; defId: string }
  | { t: 'tile'; at: Vec; corrupted: boolean; consecrated: boolean; cause: string }
  | { t: 'attack'; sourceId: string; abilityId: string; anim: AnimationKind; from: Vec; impact: Vec | null; dir: Dir | null; tiles: Vec[] }
  | { t: 'charge'; id: string; from: Vec; to: Vec }
  | { t: 'spawn'; id: string; defId: string; at: Vec }
  | { t: 'spawnBlocked'; at: Vec; reason: 'occupied' | 'hallowed' }
  | { t: 'sealed'; id: string; at: Vec }
  | { t: 'desecrated'; id: string; at: Vec }
  | { t: 'rebuke'; id: string; silenced: boolean }
  | { t: 'surface'; id: string; from: Vec; to: Vec }
  | { t: 'warded'; id: string }
  | { t: 'banner'; text: string; sub?: string }
  | { t: 'outcome'; victory: boolean; reason: string };

export type EventSink = GameEvent[];
