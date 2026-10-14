// A tiny 3x5 bitmap font for numbers and short labels on the board.
import { PAL } from './palette';

const GLYPHS: Record<string, string> = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
  '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
  '8': '111101111101111', '9': '111101111001111', '-': '000000111000000', '+': '000010111010000',
  '!': '010010010000010', '?': '111001011000010', x: '000101010101000',
};

export function textWidth(s: string): number {
  return s.length * 4 - 1;
}

/** Draw text with a 1px dark outline so it reads on any background. */
export function drawText(g: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, outline: string | null = PAL.K): void {
  const draw = (ox: number, oy: number, col: string) => {
    g.fillStyle = col;
    for (let i = 0; i < s.length; i++) {
      const glyph = GLYPHS[s[i]];
      if (!glyph) continue;
      for (let p = 0; p < 15; p++) if (glyph[p] === '1') g.fillRect(x + ox + i * 4 + (p % 3), y + oy + Math.floor(p / 3), 1, 1);
    }
  };
  if (outline) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) draw(ox, oy, outline);
  draw(0, 0, color);
}
