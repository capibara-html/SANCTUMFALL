// Small toolkit for building pixel-art canvases at load time.
import { PAL } from './palette';

export type Canvas = HTMLCanvasElement;

export function makeCanvas(w: number, h: number): Canvas {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: Canvas): CanvasRenderingContext2D {
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return g;
}

/** Build a canvas from rows of palette keys. '.' and ' ' are transparent. */
export function fromMap(rows: string[], pal: Record<string, string> = PAL): Canvas {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) throw new Error(`palette key '${ch}' missing`);
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  return c;
}

/** Add a 1px outline around every opaque pixel (canvas grows by 2px). */
export function outlined(src: Canvas, color = PAL.K): Canvas {
  const w = src.width + 2;
  const h = src.height + 2;
  const out = makeCanvas(w, h);
  const g = ctx2d(out);
  const data = ctx2d(src).getImageData(0, 0, src.width, src.height).data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < src.width && y < src.height && data[(y * src.width + x) * 4 + 3] > 0;
  g.fillStyle = color;
  for (let y = -1; y <= src.height; y++)
    for (let x = -1; x <= src.width; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) g.fillRect(x + 1, y + 1, 1, 1);
    }
  g.drawImage(src, 1, 1);
  return out;
}

/** A flat-colour silhouette of a sprite (hit flashes, shadows, ghosts). */
export function silhouette(src: Canvas, color: string): Canvas {
  const out = makeCanvas(src.width, src.height);
  const g = ctx2d(out);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, out.width, out.height);
  return out;
}

/** Checkerboard-dithered copy: pixel-honest translucency for ghosts. */
export function dithered(src: Canvas, phase = 0): Canvas {
  const out = makeCanvas(src.width, src.height);
  const g = ctx2d(out);
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, out.width, out.height);
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) if ((x + y + phase) % 2 === 0) img.data[(y * out.width + x) * 4 + 3] = 0;
  g.putImageData(img, 0, 0);
  return out;
}

export function flipX(src: Canvas): Canvas {
  const out = makeCanvas(src.width, src.height);
  const g = ctx2d(out);
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return out;
}

/** Deterministic hash → [0,1) for procedural texture work. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function px(g: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(x | 0, y | 0, 1, 1);
}

export function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(x | 0, y | 0, w | 0, h | 0);
}

/** Bresenham line, pixel-exact. */
export function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, every = 1, offset = 0): void {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let i = 0;
  g.fillStyle = color;
  for (;;) {
    if ((i + offset) % every === 0) g.fillRect(x0, y0, 1, 1);
    i++;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function toDataURL(c: Canvas, scale = 1): string {
  if (scale === 1) return c.toDataURL();
  const out = makeCanvas(c.width * scale, c.height * scale);
  const g = ctx2d(out);
  g.drawImage(c, 0, 0, out.width, out.height);
  return out.toDataURL();
}

/** Darken a sprite while keeping its internal detail (shadowed figures). */
export function shaded(src: Canvas, color: string, alpha: number): Canvas {
  const out = makeCanvas(src.width, src.height);
  const g = ctx2d(out);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fillRect(0, 0, out.width, out.height);
  return out;
}
