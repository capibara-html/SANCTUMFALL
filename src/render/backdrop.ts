// The world beyond the board: a ruined nave of arches and lancet windows,
// drawn once per region.
import { REGIONS } from './palette';
import { ctx2d, hash2, makeCanvas, px, rect, type Canvas } from './pixel';
import { VIEW_H, VIEW_W } from './layout';

const cache = new Map<string, Canvas>();

export function backdrop(region: 'ash' | 'drowned'): Canvas {
  let c = cache.get(region);
  if (c) return c;
  const r = REGIONS[region];
  c = makeCanvas(VIEW_W, VIEW_H);
  const g = ctx2d(c);
  rect(g, 0, 0, VIEW_W, VIEW_H, r.void);
  const wall = region === 'ash' ? '#17110f' : '#0c1415';
  const wallHi = region === 'ash' ? '#231a16' : '#13201f';
  const glass = region === 'ash' ? ['#3a1410', '#5a2014', '#7a3018'] : ['#0f2a28', '#16403a', '#24605a'];
  // far wall with lancet windows
  for (let i = 0; i < 6; i++) {
    const x0 = 6 + i * 38;
    const w = 12;
    const top = 6 + (i % 2) * 3;
    for (let y = top; y < 70; y++)
      for (let x = x0; x < x0 + w; x++) {
        const arch = y - top < 6 ? Math.abs(x - (x0 + w / 2 - 0.5)) <= (y - top) * 1.1 : true;
        if (!arch) continue;
        const edge = x === x0 || x === x0 + w - 1;
        let col = edge ? wallHi : glass[(Math.floor((x - x0) / 3) + Math.floor(y / 5)) % 3];
        if (!edge && (x - x0) % 4 === 1 && y % 6 === 0) col = wall;
        if (hash2(x, y, 3) < 0.25) col = wall; // broken panes
        if (y > 46 && (x + y) % 2 === 0) col = r.void;
        if (y > 56) col = r.void;
        px(g, x, y, col);
      }
  }
  // pillars between windows
  for (let i = 0; i <= 6; i++) {
    const x0 = i * 38 - 6;
    rect(g, x0, 0, 8, 80, wall);
    rect(g, x0 + 1, 0, 1, 80, wallHi);
  }
  // ground haze dither near the board edge
  for (let y = 70; y < VIEW_H; y++)
    for (let x = 0; x < VIEW_W; x++) if ((x + y * 3) % 7 === 0 && hash2(x, y, 9) < 0.35) px(g, x, y, wall);
  cache.set(region, c);
  return c;
}
