// Sprite cache: outlines, idle frames, hit-flash silhouettes and dithered
// ghosts are generated once at start-up from the source maps.
import { SPRITES } from './sprites-data';
import { paintLeviathan } from './leviathan-art';
import { dithered, fromMap, outlined, silhouette, type Canvas } from './pixel';
import { PAL } from './palette';

export interface Sprite {
  frames: Canvas[];
  flash: Canvas;
  ghost: Canvas;
  dark: Canvas;
  /** anchor in the outlined canvas */
  ax: number;
  ay: number;
}

const cache = new Map<string, Sprite>();

function breatheFrame(src: Canvas, keepBottom: number): Canvas {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d')!;
  const split = src.height - keepBottom;
  g.drawImage(src, 0, 0, src.width, split, 0, 1, src.width, split);
  g.drawImage(src, 0, split, src.width, keepBottom, 0, split, src.width, keepBottom);
  return c;
}

function build(): void {
  for (const [id, def] of Object.entries(SPRITES)) {
    const base = outlined(fromMap(def.rows));
    const frames = [base];
    if (def.breathe) frames.push(breatheFrame(base, 7));
    cache.set(id, { frames, flash: silhouette(base, PAL.f), ghost: dithered(base), dark: silhouette(base, PAL.K), ax: def.ax + 1, ay: def.ay + 1 });
  }
  const lev = [outlined(paintLeviathan(2)), outlined(paintLeviathan(3)), outlined(paintLeviathan(7))];
  cache.set('leviathan', { frames: [lev[0], lev[1]], flash: silhouette(lev[0], PAL.f), ghost: dithered(lev[0]), dark: silhouette(lev[0], PAL.K), ax: 20, ay: 64 });
  cache.set('leviathan_maw', { frames: [lev[2]], flash: silhouette(lev[2], PAL.f), ghost: dithered(lev[2]), dark: silhouette(lev[2], PAL.K), ax: 20, ay: 64 });
}

export function sprite(id: string): Sprite {
  if (!cache.size) build();
  const s = cache.get(id);
  if (!s) throw new Error(`no sprite ${id}`);
  return s;
}

export function allSpriteIds(): string[] {
  if (!cache.size) build();
  return [...cache.keys()];
}
