import { TILE } from './tiles';
import type { Vec } from '../core/types';

/** Logical (unscaled) canvas layout. Everything is drawn at this resolution
 *  and scaled up by an integer factor with nearest-neighbour sampling. */
export const OX = 20;
export const OY = 34;
export const BOARD = 8;
export const VIEW_W = OX * 2 + BOARD * TILE;
export const VIEW_H = OY + BOARD * TILE + 22;

export const tileX = (x: number) => OX + x * TILE;
export const tileY = (y: number) => OY + y * TILE;
/** ground point (where feet stand) of a tile-sized entity */
export const groundOf = (p: Vec, size = 1): Vec => ({ x: OX + p.x * TILE + (size * TILE) / 2, y: OY + p.y * TILE + size * TILE - 4 });

export function tileFromPoint(lx: number, ly: number): Vec | null {
  const x = Math.floor((lx - OX) / TILE);
  const y = Math.floor((ly - OY) / TILE);
  if (x < 0 || y < 0 || x >= BOARD || y >= BOARD) return null;
  return { x, y };
}
