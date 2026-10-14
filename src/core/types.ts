// Core data model. Everything in GameState is plain JSON so it can be cloned,
// snapshotted for undo, simulated for previews and serialized later.

export interface Vec {
  x: number;
  y: number;
}

/** 0 = North, 1 = East, 2 = South, 3 = West */
export type Dir = 0 | 1 | 2 | 3;

export type TerrainId = 'floor' | 'abyss' | 'wall';

export interface Tile {
  terrain: TerrainId;
  corrupted: boolean;
  consecrated: boolean;
  /** cosmetic variant picked at creation, used by the renderer only */
  variant: number;
}

export type Faction = 'vigil' | 'demon' | 'neutral';

export type Tag =
  | 'human'
  | 'demon'
  | 'structure'
  | 'wound'
  | 'bell'
  | 'shrine'
  | 'pillar'
  | 'boss'
  | 'massive'
  | 'aquatic'
  | 'flying';

/**
 * A concrete use of an ability. Directional uses store `dir` (+ `dist` for
 * artillery) instead of an absolute tile, so an enemy that is pushed carries
 * its declared attack along with it — the core "interrupt by displacement" rule.
 */
export interface AbilityUse {
  abilityId: string;
  sourceId: string;
  dir?: Dir;
  dist?: number;
  /** used by free-target abilities (relative to the source position) */
  offset?: Vec;
  /** set when an Inquisitor's Rebuke has turned this intent around */
  rebuked?: boolean;
}

export interface Entity {
  id: string;
  defId: string;
  name: string;
  faction: Faction;
  pos: Vec;
  size: number;
  hp: number;
  maxHp: number;
  move: number;
  tags: Tag[];
  abilities: string[];
  shield: boolean;
  moved: boolean;
  acted: boolean;
  cooldowns: Record<string, number>;
  intent: AbilityUse | null;
  intentOrder: number;
  behavior: string;
  /** free-form per-entity memory for behaviours (e.g. a boss litany step) */
  memory: Record<string, number>;
  onDeath?: string;
}

export interface SpawnMarker {
  at: Vec;
  defId: string;
  sourceId: string;
}

export interface PendingSpread {
  at: Vec;
  sourceId: string;
}

export type Phase = 'player' | 'victory' | 'defeat';

export interface BattleStats {
  demonsSlain: number;
  drownedDemons: number;
  tilesCleansed: number;
  woundsSealed: number;
  vigilFallen: string[];
  structuresLost: string[];
}

export interface Outcome {
  victory: boolean;
  reason: string;
}

export interface GameState {
  encounterId: string;
  width: number;
  height: number;
  tiles: Tile[];
  entities: Entity[];
  round: number;
  phase: Phase;
  rng: number;
  nextId: number;
  taintLimit: number;
  spawnMarkers: SpawnMarker[];
  pendingSpread: PendingSpread[];
  spawnCursor: number;
  stats: BattleStats;
  outcome: Outcome | null;
}

// ---------------------------------------------------------------------------
// Content definitions (data, registered at start-up)
// ---------------------------------------------------------------------------

export type TargetingKind =
  | 'melee' // one adjacent tile
  | 'projectile' // first thing in a straight line
  | 'charge' // source dashes in a line, hits what stops it
  | 'artillery' // arcs to a tile at dir*dist
  | 'tile' // any tile within a manhattan range
  | 'self'; // centred on the source

export interface Targeting {
  kind: TargetingKind;
  minRange?: number;
  maxRange?: number;
  /** restricts valid targets for 'tile' abilities */
  requires?: 'any' | 'ally' | 'enemyWithIntent';
}

export type EffectArea = 'target' | 'plus' | 'adjacent';

export type Effect =
  | { op: 'damage'; amount: number; area?: EffectArea; only?: Tag }
  | { op: 'push'; dir: 'forward' | 'back' | 'outward'; area?: EffectArea }
  | { op: 'corrupt'; area?: EffectArea }
  | { op: 'cleanse'; area?: EffectArea }
  | { op: 'consecrate'; area?: EffectArea }
  | { op: 'shield' }
  | { op: 'heal'; amount: number }
  | { op: 'rebuke' };

export type AnimationKind =
  | 'melee'
  | 'projectile'
  | 'chain'
  | 'artillery'
  | 'charge'
  | 'hallow'
  | 'ward'
  | 'rebuke'
  | 'chant'
  | 'tide'
  | 'maw'
  | 'surface';

export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  targeting: Targeting;
  effects: Effect[];
  cooldown?: number;
  /** name of a special resolver (see specials.ts) for bespoke mechanics */
  special?: string;
  icon: string;
  animation: AnimationKind;
}

export interface UnitDef {
  id: string;
  name: string;
  title: string;
  faction: Faction;
  hp: number;
  move: number;
  size?: number;
  tags: Tag[];
  abilities: string[];
  behavior?: string;
  onDeath?: string;
  /** for 'litany' behaviour: the cycle of rites a boss performs, in order */
  litany?: string[];
  blurb: string;
  sprite: string;
}

export type ObjectiveKind = 'sealWounds' | 'banishBoss' | 'protect' | 'noLosses' | 'drownDemons';

export interface ObjectiveDef {
  kind: ObjectiveKind;
  label: string;
  bonus?: boolean;
  /** entity defId for 'protect', count for 'drownDemons' */
  target?: string;
  count?: number;
}

export interface LegendEntry {
  terrain?: TerrainId;
  corrupted?: boolean;
  consecrated?: boolean;
  entity?: string;
}

export interface EncounterDef {
  id: string;
  name: string;
  subtitle: string;
  region: 'ash' | 'drowned';
  map: string[];
  legend: Record<string, LegendEntry>;
  taintLimit: number;
  /** demon types emerging from wounds, cycled in order */
  spawnPool: string[];
  maxEnemies: number;
  /** wounds open spawn markers from this round on */
  spawnFromRound: number;
  spreadPerWound: number;
  objectives: ObjectiveDef[];
  briefing: string[];
  seed: number;
}
