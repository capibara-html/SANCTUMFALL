// Procedural tile art. Each tile is generated once per (region, variant) from
// a deterministic hash: flagstones with bevelled edges, mortar, cracks, ash
// or moss. Overlays for Taint and hallowed ground are drawn on top.
import { REGIONS, PAL, type RegionStyle } from './palette';
import { ctx2d, hash2, makeCanvas, px, rect, type Canvas } from './pixel';

export const TILE = 24;
const VARIANTS = 6;
const cache = new Map<string, Canvas>();

function stone(g: CanvasRenderingContext2D, r: RegionStyle, x0: number, y0: number, w: number, h: number, seed: number): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const n = hash2(x0 + x, y0 + y, seed);
      let col = r.stone;
      if (n < 0.14) col = r.stoneDark;
      else if (n > 0.93) col = r.stoneLight;
      if (x === 0 || y === 0) col = r.stoneLight;
      if (x === w - 1 || y === h - 1) col = r.stoneDark;
      px(g, x0 + x, y0 + y, col);
    }
  // a few pits and a crack
  if (hash2(x0, y0, seed + 3) > 0.55) {
    let cx = x0 + 2 + Math.floor(hash2(x0, y0, seed + 4) * (w - 4));
    let cy = y0 + 1;
    for (let i = 0; i < h - 2; i++) {
      px(g, cx, cy, r.mortar);
      cy++;
      if (hash2(cx, cy, seed) > 0.6) cx += hash2(cy, cx, seed) > 0.5 ? 1 : -1;
      cx = Math.max(x0 + 1, Math.min(x0 + w - 2, cx));
    }
  }
}

function floorTile(region: 'ash' | 'drowned', v: number): Canvas {
  const r = REGIONS[region];
  const c = makeCanvas(TILE, TILE);
  const g = ctx2d(c);
  rect(g, 0, 0, TILE, TILE, r.mortar);
  const seed = v * 97 + (region === 'ash' ? 1 : 2);
  switch (v % 3) {
    case 0: // four slabs
      stone(g, r, 1, 1, 11, 11, seed);
      stone(g, r, 13, 1, 10, 11, seed + 1);
      stone(g, r, 1, 13, 7, 10, seed + 2);
      stone(g, r, 9, 13, 14, 10, seed + 3);
      break;
    case 1: // running bond
      stone(g, r, 1, 1, 14, 7, seed);
      stone(g, r, 16, 1, 7, 7, seed + 1);
      stone(g, r, 1, 9, 6, 6, seed + 2);
      stone(g, r, 8, 9, 15, 6, seed + 3);
      stone(g, r, 1, 16, 10, 7, seed + 4);
      stone(g, r, 12, 16, 11, 7, seed + 5);
      break;
    default: // a great slab with an engraved border (old tomb lid)
      stone(g, r, 1, 1, 22, 22, seed);
      for (let i = 4; i < 20; i++) {
        px(g, i, 4, r.stoneDark);
        px(g, i, 19, r.stoneDark);
        px(g, 4, i, r.stoneDark);
        px(g, 19, i, r.stoneDark);
      }
      break;
  }
  // ground detail: ash drifts or wet moss and puddles
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(hash2(i, v, seed + 9) * TILE);
    const y = Math.floor(hash2(v, i, seed + 11) * TILE);
    if (region === 'ash') {
      px(g, x, y, hash2(x, y, 5) > 0.5 ? '#6f665c' : r.moss);
    } else {
      px(g, x, y, r.moss);
      if (i < 2) {
        px(g, x + 1, y, PAL.t);
        px(g, x + 2, y, PAL.T);
      }
    }
  }
  return c;
}

export function floor(region: 'ash' | 'drowned', variant: number): Canvas {
  const v = variant % VARIANTS;
  const k = `${region}:${v}`;
  let c = cache.get(k);
  if (!c) cache.set(k, (c = floorTile(region, v)));
  return c;
}

/** The inner south-facing wall of a pit, seen under the tile above it. */
export function pitLip(region: 'ash' | 'drowned'): Canvas {
  const k = `lip:${region}`;
  let c = cache.get(k);
  if (c) return c;
  const r = REGIONS[region];
  c = makeCanvas(TILE, 9);
  const g = ctx2d(c);
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < TILE; x++) {
      let col = y < 2 ? r.stoneDark : (x + (y >> 2) * 3) % 8 === 0 || y % 4 === 1 ? r.mortar : r.stoneDark;
      if (y >= 5 && (x + y) % 2 === 0) col = r.abyssTop;
      if (y >= 7) col = r.abyssTop;
      px(g, x, y, col);
    }
  cache.set(k, c);
  return c;
}

/** Cliff face below the platform's south edge. */
export function cliff(region: 'ash' | 'drowned', x: number): Canvas {
  const k = `cliff:${region}:${x % 2}`;
  let c = cache.get(k);
  if (c) return c;
  const r = REGIONS[region];
  c = makeCanvas(TILE, 14);
  const g = ctx2d(c);
  for (let yy = 0; yy < 14; yy++)
    for (let xx = 0; xx < TILE; xx++) {
      const row = Math.floor(yy / 5);
      const brickEdge = yy % 5 === 4 || (xx + (row % 2) * 6 + (x % 2) * 3) % 12 === 0;
      let col = brickEdge ? r.mortar : hash2(xx, yy, x) > 0.85 ? r.stone : r.stoneDark;
      if (yy === 0) col = r.stoneLight;
      if (yy > 9 && (xx + yy) % 2 === 0) col = r.void;
      if (yy > 11) col = r.void;
      px(g, xx, yy, col);
    }
  cache.set(k, c);
  return c;
}

/** Violet veins of the Taint. Two frames for a slow pulse. */
export function taintOverlay(variant: number, frame: number): Canvas {
  const k = `taint:${variant % VARIANTS}:${frame}`;
  let c = cache.get(k);
  if (c) return c;
  c = makeCanvas(TILE, TILE);
  const g = ctx2d(c);
  // darken with a dither
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) if ((x + y) % 2 === 0) px(g, x, y, 'rgba(38,10,30,0.55)');
  // veins: random walks from the edges toward the centre
  const seed = variant * 13 + 5;
  for (let v = 0; v < 4; v++) {
    let x = v % 2 === 0 ? Math.floor(hash2(v, 1, seed) * TILE) : v === 1 ? 0 : TILE - 1;
    let y = v % 2 === 1 ? Math.floor(hash2(v, 2, seed) * TILE) : v === 0 ? 0 : TILE - 1;
    for (let i = 0; i < 18; i++) {
      const bright = (i + frame * 3) % 9 < 2;
      px(g, x, y, bright ? PAL.V : i % 3 === 0 ? PAL.v : PAL.P);
      const h = hash2(x, y, seed + i);
      if (h < 0.4) x += x < 12 ? 1 : -1;
      else if (h < 0.8) y += y < 12 ? 1 : -1;
      else x += h > 0.9 ? 1 : -1;
      x = Math.max(0, Math.min(TILE - 1, x));
      y = Math.max(0, Math.min(TILE - 1, y));
    }
  }
  // blisters
  for (let i = 0; i < 3; i++) {
    const x = 3 + Math.floor(hash2(i, 9, seed) * 18);
    const y = 3 + Math.floor(hash2(9, i, seed) * 18);
    px(g, x, y, PAL.p);
    px(g, x + 1, y, frame ? PAL.V : PAL.v);
  }
  cache.set(k, c);
  return c;
}

/** The Seal of the Vigil engraved in gold: hallowed ground. */
export function hallowOverlay(frame: number): Canvas {
  const k = `hallow:${frame}`;
  let c = cache.get(k);
  if (c) return c;
  c = makeCanvas(TILE, TILE);
  const g = ctx2d(c);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) if ((x * 3 + y) % 4 === 0) px(g, x, y, 'rgba(232,200,106,0.16)');
  const gold = PAL.O;
  const glint = PAL.Y;
  // ring
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    const x = Math.round(12 + Math.cos(t) * 8.5 - 0.5);
    const y = Math.round(12 + Math.sin(t) * 8.5 - 0.5);
    px(g, x, y, (a + frame * 8) % 32 < 3 ? glint : gold);
  }
  // vertical bar with two crossbars and a central eye
  for (let y = 5; y <= 18; y++) px(g, 11, y, gold);
  for (let x = 8; x <= 14; x++) px(g, x, 8, gold);
  for (let x = 9; x <= 13; x++) px(g, x, 15, gold);
  px(g, 11, 11, glint);
  px(g, 10, 11, PAL.y);
  px(g, 12, 11, PAL.y);
  // corner ticks
  for (const [x, y] of [[2, 2], [21, 2], [2, 21], [21, 21]]) px(g, x, y, PAL.o);
  cache.set(k, c);
  return c;
}
