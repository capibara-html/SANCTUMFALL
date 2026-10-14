import type { Dir, Entity, GameState, Tile, Vec } from './types';

export const DIRS: readonly Vec[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];
export const ALL_DIRS: readonly Dir[] = [0, 1, 2, 3];
export const DIR_NAMES = ['north', 'east', 'south', 'west'] as const;

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const eq = (a: Vec, b: Vec): boolean => a.x === b.x && a.y === b.y;
export const manhattan = (a: Vec, b: Vec): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const step = (p: Vec, d: Dir, n = 1): Vec => add(p, scale(DIRS[d], n));
export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;
export const key = (p: Vec): string => `${p.x},${p.y}`;

/** Direction from a to b if they share a row/column, else null. */
export function dirTo(a: Vec, b: Vec): Dir | null {
  if (a.x === b.x && a.y === b.y) return null;
  if (a.x === b.x) return b.y < a.y ? 0 : 2;
  if (a.y === b.y) return b.x > a.x ? 1 : 3;
  return null;
}

export function inBounds(s: GameState, p: Vec): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < s.width && p.y < s.height;
}

export function tileAt(s: GameState, p: Vec): Tile | null {
  return inBounds(s, p) ? s.tiles[p.y * s.width + p.x] : null;
}

/** All tiles covered by an entity (multi-tile bosses occupy size x size). */
export function footprint(e: Entity): Vec[] {
  const out: Vec[] = [];
  for (let dy = 0; dy < e.size; dy++) for (let dx = 0; dx < e.size; dx++) out.push({ x: e.pos.x + dx, y: e.pos.y + dy });
  return out;
}

export function occupies(e: Entity, p: Vec): boolean {
  return p.x >= e.pos.x && p.y >= e.pos.y && p.x < e.pos.x + e.size && p.y < e.pos.y + e.size;
}

export function entityAt(s: GameState, p: Vec): Entity | null {
  for (const e of s.entities) if (occupies(e, p)) return e;
  return null;
}

export function getEntity(s: GameState, id: string): Entity | null {
  return s.entities.find((e) => e.id === id) ?? null;
}

export function neighbors(s: GameState, p: Vec): Vec[] {
  return ALL_DIRS.map((d) => step(p, d)).filter((q) => inBounds(s, q));
}

export function allTiles(s: GameState): Vec[] {
  const out: Vec[] = [];
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) out.push({ x, y });
  return out;
}

export const hasTag = (e: Entity, t: Entity['tags'][number]): boolean => e.tags.includes(t);
