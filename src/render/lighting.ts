// Pixel lighting: an ordered-dither darkness mask with a handful of point
// lights, plus additive glow sprites. The board itself is never darkened
// past ~35% so the tactical information stays readable.
import { BAYER4, ctx2d, makeCanvas, type Canvas } from './pixel';
import { BOARD, OX, OY, VIEW_H, VIEW_W } from './layout';
import { TILE } from './tiles';

export interface Light {
  x: number;
  y: number;
  r: number;
  i: number; // 0..1
  color?: string;
}

const mask = makeCanvas(VIEW_W, VIEW_H);
const mg = ctx2d(mask);
const img = mg.createImageData(VIEW_W, VIEW_H);

export function renderDarkness(lights: Light[], ambient: [number, number, number], boardMax = 0.36, outsideMax = 0.82): Canvas {
  const d = img.data;
  const bx0 = OX, by0 = OY, bx1 = OX + BOARD * TILE, by1 = OY + BOARD * TILE;
  for (let y = 0; y < VIEW_H; y++)
    for (let x = 0; x < VIEW_W; x++) {
      const inside = x >= bx0 && x < bx1 && y >= by0 - 10 && y < by1 + 10;
      // distance outside the board increases darkness smoothly
      const ox = Math.max(bx0 - x, 0, x - bx1 + 1);
      const oy = Math.max(by0 - y, 0, y - by1 + 1);
      let dark = inside ? boardMax : Math.min(outsideMax, boardMax + (ox + oy) * 0.03);
      // gentle vignette inside the board
      const cx = (x - (bx0 + bx1) / 2) / ((bx1 - bx0) / 2);
      const cy = (y - (by0 + by1) / 2) / ((by1 - by0) / 2);
      dark *= 0.65 + 0.35 * Math.min(1, (cx * cx + cy * cy) * 0.6);
      for (const l of lights) {
        const dx = x - l.x, dy = (y - l.y) * 1.3;
        const r2 = dx * dx + dy * dy;
        if (r2 > l.r * l.r) continue;
        const f = 1 - Math.sqrt(r2) / l.r;
        dark -= l.i * f * f * 1.4;
      }
      dark = Math.max(0, dark);
      // quantise to 8 levels with Bayer dithering
      const q = dark * 7 + BAYER4[y & 3][x & 3] / 16 - 0.5;
      const level = Math.max(0, Math.min(7, Math.round(q)));
      const o = (y * VIEW_W + x) * 4;
      d[o] = ambient[0];
      d[o + 1] = ambient[1];
      d[o + 2] = ambient[2];
      d[o + 3] = Math.round((level / 7) * 255);
    }
  mg.putImageData(img, 0, 0);
  return mask;
}

const glowCache = new Map<string, Canvas>();
/** A dithered radial glow for additive blending. */
export function glow(color: string, r: number): Canvas {
  const k = `${color}:${r}`;
  let c = glowCache.get(k);
  if (c) return c;
  c = makeCanvas(r * 2 + 1, r * 2 + 1);
  const g = ctx2d(c);
  g.fillStyle = color;
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const f = 1 - Math.sqrt(x * x + (y * 1.3) ** 2) / r;
      if (f <= 0) continue;
      if (f * f * 16 > BAYER4[(y + r) & 3][(x + r) & 3] + 1) g.fillRect(x + r, y + r, 1, 1);
    }
  glowCache.set(k, c);
  return c;
}
