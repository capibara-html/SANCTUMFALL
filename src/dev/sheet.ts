// Developer sprite sheet: renders every generated sprite, tile and icon.
import { allSpriteIds, sprite } from '../render/sprites';
import { ctx2d } from '../render/pixel';

const ids = allSpriteIds();
const cell = 64;
const cols = 8;
const sheet = document.getElementById('sheet') as HTMLCanvasElement;
sheet.width = cols * cell;
sheet.height = Math.ceil((ids.length * 2) / cols) * cell + cell;
const g = ctx2d(sheet);
g.fillStyle = '#2a2124';
g.fillRect(0, 0, sheet.width, sheet.height);
let i = 0;
for (const id of ids) {
  const sp = sprite(id);
  for (const f of [sp.frames[0], sp.flash]) {
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * cell;
    g.fillStyle = i % 2 ? '#3a2f30' : '#4a3d38';
    g.fillRect(x, y, cell, cell);
    g.drawImage(f, x + Math.floor((cell - f.width) / 2), y + cell - f.height - 2);
    i++;
  }
}
const extra = (window as unknown as { __extra?: (g: CanvasRenderingContext2D, y: number) => void }).__extra;
extra?.(g, Math.ceil(i / cols) * cell);
sheet.style.width = `${sheet.width * 4}px`;
