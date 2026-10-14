// The Leviathan is painted procedurally with pixel primitives (no
// anti-aliasing): a scaled neck rising from the water, a long jawed skull
// facing the shore, three gold eyes and the broken halo of a drowned saint.
import { PAL } from './palette';
import { ctx2d, makeCanvas, px, type Canvas } from './pixel';

function fillPoly(g: CanvasRenderingContext2D, pts: [number, number][], color: string): void {
  const minY = Math.floor(Math.min(...pts.map((p) => p[1])));
  const maxY = Math.ceil(Math.max(...pts.map((p) => p[1])));
  g.fillStyle = color;
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) g.fillRect(Math.round(xs[i]), y, Math.round(xs[i + 1]) - Math.round(xs[i]), 1);
  }
}

export function paintLeviathan(open: number): Canvas {
  const W = 56;
  const H = 66;
  const c = makeCanvas(W, H);
  const g = ctx2d(c);

  // broken halo behind the head
  const hx = 20, hy = 18, hr = 17;
  for (let a = 0; a < 360; a += 1.5) {
    const deg = a;
    if ((deg > 40 && deg < 70) || (deg > 200 && deg < 222) || (deg > 300 && deg < 312)) continue;
    const r = (deg * Math.PI) / 180;
    const x = Math.round(hx + Math.cos(r) * hr);
    const y = Math.round(hy + Math.sin(r) * hr);
    px(g, x, y, PAL.O);
    px(g, Math.round(hx + Math.cos(r) * (hr - 1)), Math.round(hy + Math.sin(r) * (hr - 1)), deg % 30 < 15 ? PAL.o : PAL.y);
  }

  // neck: S-curve column of scales
  for (let y = H - 1; y >= 20; y--) {
    const t = (H - 1 - y) / (H - 20);
    const cx = 19 + Math.sin(t * 2.6) * 4;
    const half = 11 - t * 3;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const u = (x - (cx - half)) / (2 * half);
      let col = PAL.T;
      if (u < 0.18) col = PAL.t;
      else if (u > 0.78) col = PAL.w; // pale belly plates
      else if (u > 0.68) col = PAL.s;
      else if (u < 0.32) col = PAL.T;
      // scale pattern
      const sy = (y + (Math.floor(x / 3) % 2) * 2) % 4;
      if (u >= 0.18 && u <= 0.66 && sy === 0) col = PAL.t;
      if (u >= 0.2 && u <= 0.6 && sy === 1 && x % 3 === 1) col = PAL.q;
      if (u > 0.68 && y % 3 === 0) col = PAL.s;
      px(g, x, y, col);
    }
    // dorsal spines on the back (left)
    if (y % 5 === 0 && y < H - 8) {
      const bx = Math.round(cx - half);
      px(g, bx - 1, y, PAL.w);
      px(g, bx - 2, y - 1, PAL.w);
      px(g, bx - 3, y - 2, PAL.W);
    }
  }

  // skull: upper jaw wedge pointing east
  const jawDrop = open;
  fillPoly(g, [[9, 10], [20, 5], [34, 7], [50, 13], [54, 17], [50, 20], [30, 20], [12, 24]], PAL.T);
  // shading on the skull
  fillPoly(g, [[11, 10], [20, 6], [34, 8], [48, 13], [34, 11], [20, 9]], PAL.q);
  fillPoly(g, [[12, 22], [30, 19], [50, 19], [54, 17], [50, 21], [30, 21]], PAL.t);
  // lower jaw, opened by `open`
  fillPoly(g, [[13, 25], [30, 22 + jawDrop], [48, 23 + jawDrop], [51, 25 + jawDrop], [44, 28 + jawDrop], [26, 29 + jawDrop * 0.6], [15, 29]], PAL.T);
  fillPoly(g, [[16, 28], [26, 28 + jawDrop * 0.6], [44, 27 + jawDrop], [40, 29 + jawDrop], [24, 30 + jawDrop * 0.6]], PAL.w);
  // mouth interior
  fillPoly(g, [[18, 22], [30, 20], [50, 20], [48, 23 + jawDrop], [30, 22 + jawDrop], [16, 25]], PAL.k);
  fillPoly(g, [[22, 22], [32, 21], [44, 21], [42, 22 + jawDrop * 0.8], [30, 22 + jawDrop * 0.6]], PAL.r);
  // teeth
  for (let x = 22; x <= 49; x += 3) {
    px(g, x, 20, PAL.W);
    px(g, x, 21, PAL.W);
    if (x % 2) px(g, x, 22, PAL.w);
    const ly = Math.round(22 + jawDrop - (49 - x) * 0.02);
    px(g, x + 1, ly, PAL.W);
    px(g, x + 1, ly - 1, PAL.w);
  }
  // three eyes
  for (const [ex, ey] of [[24, 11], [30, 12], [36, 13]] as [number, number][]) {
    px(g, ex, ey, PAL.Y);
    px(g, ex + 1, ey, PAL.y);
    px(g, ex, ey + 1, PAL.E);
    px(g, ex + 1, ey + 1, PAL.Y);
    px(g, ex - 1, ey, PAL.k);
  }
  // bone crest along the skull
  for (let i = 0; i < 6; i++) {
    const x = 11 + i * 3;
    const y = 9 - Math.round(Math.sin(i / 2) * 2);
    px(g, x, y - 1, PAL.w);
    px(g, x - 1, y - 2, PAL.W);
    px(g, x - 2, y - 3 - (i % 2), PAL.W);
  }
  // nostril and brow
  px(g, 50, 15, PAL.k);
  px(g, 49, 15, PAL.k);
  for (let x = 22; x < 40; x++) if (x % 2 === 0) px(g, x, 10, PAL.t);
  // gill slits on the neck
  for (let i = 0; i < 3; i++) for (let y = 30 + i * 4; y < 33 + i * 4; y++) px(g, 22 + i, y, PAL.r);
  return c;
}
