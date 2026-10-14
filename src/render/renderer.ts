// Board renderer. Reads a display GameState (from the Animator) plus a
// "view" describing selection, previews and telegraphs, and draws one frame.
import { getAbility } from '../core/registry';
import { DIRS, eq, hasTag, tileAt } from '../core/grid';
import { useFootprint } from '../core/abilities';
import type { Forecast } from '../core/preview';
import type { Dir, Entity, GameState, Vec } from '../core/types';
import { Animator } from './animator';
import { backdrop } from './backdrop';
import { drawText, textWidth } from './font';
import { icon } from './icons';
import { OY, VIEW_H, VIEW_W, groundOf, tileX, tileY } from './layout';
import { glow, renderDarkness, type Light } from './lighting';
import { PAL, REGIONS, UI } from './palette';
import { ctx2d, hash2, line, px, rect, type Canvas } from './pixel';
import { sprite } from './sprites';
import { TILE, cliff, floor, hallowOverlay, pitLip, taintOverlay } from './tiles';

export interface BoardView {
  region: 'ash' | 'drowned';
  hover: Vec | null;
  selectedId: string | null;
  moveTiles: Vec[];
  targetTiles: Vec[];
  /** tiles touched by the hovered player action */
  previewTiles: Vec[];
  previewArrows: { at: Vec; dir: Dir }[];
  /** player action preview */
  forecast: Forecast | null;
  /** what the reckoning will do if the turn ends now */
  threat: Forecast | null;
  focusEnemyId: string | null;
  /** state from which enemy telegraphs are computed (after-preview if any) */
  intentState: GameState;
  showIntents: boolean;
  interactive: boolean;
}

const hexRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private frame = 0;
  private darkness: Canvas | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.g = ctx2d(canvas);
  }

  draw(anim: Animator, view: BoardView): void {
    const g = this.g;
    const s = anim.display;
    const now = anim.now;
    this.frame++;
    const shake = anim.fx.shake > 0.2 ? Math.round((Math.random() - 0.5) * anim.fx.shake * 2) : 0;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(backdrop(view.region), 0, 0);
    g.setTransform(1, 0, 0, 1, shake, Math.round(shake * 0.5));

    this.drawTiles(s, view.region, now);
    this.drawGroundUi(s, view, now);
    this.drawEntities(anim, view, now);
    anim.fx.draw(g, now);

    // lighting
    if (this.frame % 3 === 1 || !this.darkness) this.darkness = renderDarkness(this.lights(s, now), hexRgb(REGIONS[view.region].ambient));
    g.drawImage(this.darkness, 0, 0);
    g.globalCompositeOperation = 'lighter';
    for (const l of this.lights(s, now)) if (l.color) {
      const gl = glow(l.color, Math.round(l.r * 0.6));
      g.globalAlpha = 0.18;
      g.drawImage(gl, Math.round(l.x - gl.width / 2), Math.round(l.y - gl.height / 2));
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    this.drawFog(view.region, now);

    // readable overlays above the lighting
    this.drawTelegraphOutlines(s, view, now);
    this.drawBadges(anim, view, now);
    this.drawCursor(view, now);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // --- tiles -------------------------------------------------------------------

  private drawTiles(s: GameState, region: 'ash' | 'drowned', now: number): void {
    const g = this.g;
    const r = REGIONS[region];
    const pulse = Math.floor(now / 500) % 2;
    for (let y = 0; y < s.height; y++)
      for (let x = 0; x < s.width; x++) {
        const t = tileAt(s, { x, y })!;
        const X = tileX(x), Y = tileY(y);
        if (t.terrain === 'abyss') {
          rect(g, X, Y, TILE, TILE, r.abyssDeep);
          for (let yy = 0; yy < TILE; yy += 2) for (let xx = (yy >> 1) % 2; xx < TILE; xx += 2) px(g, X + xx, Y + yy, r.abyssTop);
          const above = tileAt(s, { x, y: y - 1 });
          if (!above || above.terrain !== 'abyss') g.drawImage(pitLip(region), X, Y);
          // moving glints
          for (let i = 0; i < 3; i++) {
            const gx = Math.floor((hash2(x, y, i) * TILE + now / (region === 'drowned' ? 90 : 160) + i * 7) % TILE);
            const gy = 10 + Math.floor(hash2(y, x, i) * 12);
            const col = region === 'drowned' ? (i === 0 ? PAL.q : PAL.T) : i === 0 ? r.abyssGlint : PAL.r;
            px(g, X + gx, Y + gy, col);
            if (region === 'drowned') px(g, X + ((gx + 1) % TILE), Y + gy, PAL.T);
          }
          continue;
        }
        if (t.terrain === 'wall') {
          rect(g, X, Y, TILE, TILE, r.stoneDark);
          continue;
        }
        g.drawImage(floor(region, t.variant), X, Y);
        if (t.corrupted) g.drawImage(taintOverlay(t.variant, pulse), X, Y);
        if (t.consecrated) g.drawImage(hallowOverlay(Math.floor(now / 700) % 4), X, Y);
      }
    // south cliff
    for (let x = 0; x < s.width; x++) {
      const t = tileAt(s, { x, y: s.height - 1 })!;
      if (t.terrain === 'abyss') {
        rect(g, tileX(x), tileY(s.height), TILE, 14, r.abyssDeep);
        continue;
      }
      g.drawImage(cliff(region, x), tileX(x), tileY(s.height));
    }
  }

  // --- ground-level UI (under the units) ------------------------------------------

  private fillTile(p: Vec, color: string, mode: 'checker' | 'hatch' | 'sparse', phase = 0): void {
    const g = this.g;
    const X = tileX(p.x), Y = tileY(p.y);
    g.fillStyle = color;
    for (let y = 1; y < TILE - 1; y++)
      for (let x = 1; x < TILE - 1; x++) {
        const on = mode === 'checker' ? (x + y) % 2 === 0 : mode === 'hatch' ? (x + y + phase) % 5 === 0 : (x + y * 2) % 6 === 0;
        if (on) g.fillRect(X + x, Y + y, 1, 1);
      }
  }

  private borderTile(p: Vec, color: string, dashed = false, phase = 0): void {
    const g = this.g;
    const X = tileX(p.x), Y = tileY(p.y);
    g.fillStyle = color;
    for (let i = 1; i < TILE - 1; i++) {
      if (dashed && (i + phase) % 4 >= 2) continue;
      g.fillRect(X + i, Y + 1, 1, 1);
      g.fillRect(X + i, Y + TILE - 2, 1, 1);
      g.fillRect(X + 1, Y + i, 1, 1);
      g.fillRect(X + TILE - 2, Y + i, 1, 1);
    }
  }

  private intentFootprints(view: BoardView) {
    const s = view.intentState;
    const out: { e: Entity; tiles: Vec[]; arrows: { at: Vec; dir: Dir }[]; path: Vec[]; anim: string; focus: boolean }[] = [];
    if (!view.showIntents) return out;
    for (const e of s.entities) {
      if (!e.intent) continue;
      const fp = useFootprint(s, e.intent);
      const anim = getAbility(e.intent.abilityId).animation;
      out.push({ e, tiles: fp.tiles, arrows: fp.arrows, path: fp.plan?.path ?? [], anim, focus: !view.focusEnemyId || view.focusEnemyId === e.id });
    }
    return out;
  }

  private drawGroundUi(s: GameState, view: BoardView, now: number): void {
    const phase = Math.floor(now / 120);
    for (const p of view.moveTiles) this.fillTile(p, UI.move, 'checker');
    for (const p of view.targetTiles) this.fillTile(p, UI.target, 'sparse');
    // telegraphed Taint spread and spawn sites
    for (const sp of view.intentState.pendingSpread) this.fillTile(sp.at, UI.taint, 'hatch', phase);
    for (const m of view.intentState.spawnMarkers) {
      const c = groundOf(m.at);
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + now / 600;
        px(this.g, Math.round(c.x + Math.cos(a) * 8), Math.round(c.y - 8 + Math.sin(a) * 5), i % 2 ? PAL.V : PAL.v);
      }
    }
    for (const f of this.intentFootprints(view)) for (const p of f.tiles) this.fillTile(p, f.focus ? UI.threat : UI.threatDim, 'hatch', phase);
    for (const p of view.previewTiles) this.fillTile(p, UI.target, 'checker');
    if (view.forecast) for (const t of view.forecast.tiles) if (t.consecrated) this.fillTile(t.at, UI.hallow, 'hatch', phase);
    // selection ring
    const sel = view.selectedId ? s.entities.find((e) => e.id === view.selectedId) : null;
    if (sel) {
      const c = groundOf(sel.pos);
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2 + now / 900;
        px(this.g, Math.round(c.x + Math.cos(a) * 9), Math.round(c.y + Math.sin(a) * 4), i % 5 === 0 ? PAL.Y : PAL.O);
      }
    }
  }

  // --- entities ---------------------------------------------------------------

  private drawEntities(anim: Animator, view: BoardView, now: number): void {
    const g = this.g;
    const s = anim.display;
    const list = s.entities.slice().sort((a, b) => a.pos.y + a.size - (b.pos.y + b.size) || a.pos.x - b.pos.x);
    // tethers from bells to the boss they ward
    const boss = s.entities.find((e) => hasTag(e, 'boss'));
    if (boss) {
      const bc = groundOf(boss.pos, boss.size);
      for (const b of s.entities.filter((e) => hasTag(e, 'bell'))) {
        const c = groundOf(b.pos);
        line(g, c.x, c.y - 14, bc.x + 8, bc.y - 40, PAL.T, 3, Math.floor(now / 100));
      }
    }
    for (const e of list) {
      const v = anim.visual(e.id);
      const sp = sprite(v.frame ?? e.defId);
      const gp = groundOf(e.pos, e.size);
      const x = gp.x + v.dx;
      const y = gp.y + v.dy;
      const living = !hasTag(e, 'structure');
      const isBoss = hasTag(e, 'boss');
      // shadow
      if (!isBoss) for (let i = -6; i <= 6; i++) for (let j = -1; j <= 1; j++) if ((i + j) % 2 === 0 && Math.abs(i) + Math.abs(j) * 4 < 8) px(g, x + i, y + j + 1, 'rgba(0,0,0,0.6)');
      const frameIdx = living && sp.frames.length > 1 ? Math.floor((now + hash2(e.pos.x, e.pos.y) * 1000) / 520) % sp.frames.length : 0;
      const img = v.flash ? sp.flash : sp.frames[frameIdx];
      let dx = Math.round(x - sp.ax);
      let dy = Math.round(y - sp.ay);
      if (isBoss) {
        dx = Math.round(gp.x - 30 + v.dx);
        dy = Math.round(gp.y + 4 - sp.ay - 4 + Math.sin(now / 700) * 1.5);
      }
      const sinkPx = Math.round(v.sink * img.height);
      const h = img.height - sinkPx;
      if (h > 0) g.drawImage(img, 0, 0, img.width, h, dx, dy + sinkPx, img.width, h);
      if (isBoss) {
        // water collar
        const wy = Math.round(gp.y + 2);
        for (let i = -26; i <= 18; i++) {
          const yy = wy + Math.round(Math.sin(i / 3 + now / 200) * 1);
          px(g, gp.x + i, yy, (i + Math.floor(now / 90)) % 5 === 0 ? PAL.Q : PAL.q);
          px(g, gp.x + i, yy + 1, PAL.T);
        }
      }
      // spent units are shown dimmed
      if (e.faction === 'vigil' && e.acted && view.interactive) {
        g.globalAlpha = 0.45;
        g.drawImage(sp.dark, 0, 0, img.width, h, dx, dy + sinkPx, img.width, h);
        g.globalAlpha = 1;
      }
      if (e.shield) {
        for (let i = 0; i < 24; i++) {
          if ((i + Math.floor(now / 80)) % 3 === 0) continue;
          const a = (i / 24) * Math.PI * 2;
          px(g, Math.round(x + Math.cos(a) * 11), Math.round(y - 10 + Math.sin(a) * 13), i % 4 ? PAL.Q : PAL.f);
        }
      }
    }
  }

  // --- overlays above lighting -------------------------------------------------

  private arrow(at: Vec, dir: Dir, color: string, ofs = 6): void {
    const c = groundOf(at);
    const d = DIRS[dir];
    const cx = c.x + d.x * ofs;
    const cy = c.y - 8 + d.y * ofs;
    const g = this.g;
    // shaft + head, outlined
    const pts: [number, number][] = [];
    for (let i = -3; i <= 2; i++) pts.push([i, 0]);
    pts.push([1, -1], [1, 1], [0, -2], [0, 2]);
    const tf = (p: [number, number]): [number, number] => (d.x !== 0 ? [cx + p[0] * d.x, cy + p[1]] : [cx + p[1], cy + p[0] * d.y]);
    g.fillStyle = PAL.K;
    for (const p of pts) {
      const [X, Y] = tf(p);
      g.fillRect(X - 1, Y, 3, 1);
      g.fillRect(X, Y - 1, 1, 3);
    }
    g.fillStyle = color;
    for (const p of pts) {
      const [X, Y] = tf(p);
      g.fillRect(X, Y, 1, 1);
    }
  }

  private drawTelegraphOutlines(_s: GameState, view: BoardView, now: number): void {
    const phase = Math.floor(now / 120);
    for (const p of view.moveTiles) this.borderTile(p, UI.moveDim);
    for (const p of view.targetTiles) this.borderTile(p, UI.targetDim, true, phase);
    for (const sp of view.intentState.pendingSpread) {
      this.borderTile(sp.at, UI.taint, true, phase);
      const ic = icon('taint');
      this.g.drawImage(ic, tileX(sp.at.x) + 1, tileY(sp.at.y) + 1);
    }
    for (const m of view.intentState.spawnMarkers) {
      const ic = icon('spawn');
      this.g.drawImage(ic, tileX(m.at.x) + 7, tileY(m.at.y) + 3 + (Math.floor(now / 300) % 2));
    }
    for (const f of this.intentFootprints(view)) {
      const col = f.focus ? UI.threat : UI.threatDim;
      for (const p of f.tiles) this.borderTile(p, col);
      const src = groundOf(f.e.pos, f.e.size);
      if (f.anim === 'artillery' && f.tiles.length) {
        const dst = groundOf(f.tiles[0]);
        for (let i = 0; i <= 16; i++) {
          const k = i / 16;
          if ((i + phase) % 2) continue;
          px(this.g, Math.round(src.x + (dst.x - src.x) * k), Math.round(src.y - 10 + (dst.y - src.y) * k - Math.sin(k * Math.PI) * 22), col);
        }
      }
      if ((f.anim === 'charge' || f.anim === 'projectile') && f.path.length) {
        const last = groundOf(f.path[f.path.length - 1]);
        line(this.g, src.x, src.y - 6, last.x, last.y - 6, col, 2, phase);
      }
      const rebuked = f.e.intent?.rebuked;
      for (const a of f.arrows) this.arrow(a.at, a.dir, rebuked ? UI.target : col);
      if (f.anim === 'melee' || f.anim === 'charge') {
        const dir = f.e.intent?.dir;
        if (dir !== undefined && f.tiles[0]) {
          const p = f.anim === 'charge' && f.path.length ? f.path[f.path.length - 1] : f.e.pos;
          this.arrow(p, dir, rebuked ? UI.target : col, 11);
        }
      }
    }
    for (const a of view.previewArrows) this.arrow(a.at, a.dir, UI.target);
    for (const p of view.previewTiles) this.borderTile(p, UI.target);
  }

  private badge(x: number, y: number, text: string, bg: string, fg: string): void {
    const w = textWidth(text) + 4;
    rect(this.g, x - Math.floor(w / 2) - 1, y - 1, w + 2, 9, PAL.K);
    rect(this.g, x - Math.floor(w / 2), y, w, 7, bg);
    drawText(this.g, text, x - Math.floor(w / 2) + 2, y + 1, fg, null);
  }

  private drawBadges(anim: Animator, view: BoardView, now: number): void {
    const s = anim.display;
    const g = this.g;
    const blink = Math.floor(now / 260) % 2 === 0;
    for (const e of s.entities) {
      const v = anim.visual(e.id);
      if (v.sink > 0.5) continue;
      const gp = groundOf(e.pos, e.size);
      const x = gp.x + v.dx;
      const y = gp.y + v.dy;
      const isBoss = hasTag(e, 'boss');
      // HP pips
      const threat = view.threat?.entities.get(e.id);
      const preview = view.forecast?.entities.get(e.id);
      const lose = Math.min(e.hp, (preview?.damage ?? 0) || (threat?.damage ?? 0));
      const pipW = 3;
      const totalW = e.maxHp * (pipW + 1) + 1;
      const px0 = Math.round(x - totalW / 2);
      const py0 = isBoss ? y + 3 : y + 4;
      if (!hasTag(e, 'pillar') || e.hp < e.maxHp) {
        rect(g, px0 - 1, py0 - 1, totalW + 2, 5, PAL.K);
        const col = e.faction === 'vigil' ? '#9fd36a' : isBoss ? PAL.q : e.faction === 'demon' ? (hasTag(e, 'structure') ? PAL.V : PAL.e) : PAL.S;
        for (let i = 0; i < e.maxHp; i++) {
          const filled = i < e.hp;
          const losing = filled && i >= e.hp - lose;
          const c = !filled ? PAL.d : losing ? (blink ? PAL.f : PAL.d) : col;
          rect(g, px0 + 1 + i * (pipW + 1), py0, pipW, 3, c);
        }
      }
      // intent order badge
      if (e.intent && view.showIntents) {
        const sp = sprite(e.defId);
        const top = isBoss ? y - 58 : y - sp.ay + 2;
        this.badge(x - (isBoss ? 18 : 8), top, String(e.intentOrder), e.intent.rebuked ? PAL.O : PAL.R, PAL.W);
      }
      // warded boss
      if (isBoss && s.entities.some((o) => hasTag(o, 'bell'))) g.drawImage(icon('bell'), x - 6, y - 70 + (blink ? 0 : 1));
      // forecasts: preview (gold) takes precedence over the threat (red)
      const f = preview && (preview.damage || preview.dies || preview.shieldLost || preview.warded) ? preview : threat && (threat.damage || threat.dies || threat.shieldLost) ? threat : null;
      if (f) {
        // sits on the unit's own health bar so it can never be read as a neighbour's
        const top = isBoss ? y - 52 : py0 - 10;
        const isPreview = f === preview;
        if (f.dies) g.drawImage(icon(f.drowns ? 'drown' : 'skull'), x - 5, top - 4);
        else if (f.warded && !f.damage) g.drawImage(icon('bell'), x - 5, top - 4);
        else if (f.shieldLost && !f.damage) g.drawImage(icon('shield'), x - 5, top - 4);
        else this.badge(x, top, `-${f.damage}`, isPreview ? PAL.O : PAL.R, PAL.W);
      }
      // ghost at predicted destination
      if (preview && !eq(preview.from, preview.to) && !preview.dies) {
        const sp = sprite(e.defId);
        const to = groundOf(preview.to, e.size);
        g.globalAlpha = 0.85;
        g.drawImage(sp.ghost, Math.round(to.x - sp.ax), Math.round(to.y - sp.ay));
        g.globalAlpha = 1;
        line(g, x, y - 6, to.x, to.y - 6, PAL.Y, 2, Math.floor(now / 100));
      }
    }
  }

  private drawCursor(view: BoardView, now: number): void {
    if (!view.hover || !view.interactive) return;
    const X = tileX(view.hover.x), Y = tileY(view.hover.y);
    const o = Math.floor(now / 300) % 2;
    const g = this.g;
    const col = PAL.W;
    for (const [cx, cy, sx, sy] of [[X - o, Y - o, 1, 1], [X + TILE - 1 + o, Y - o, -1, 1], [X - o, Y + TILE - 1 + o, 1, -1], [X + TILE - 1 + o, Y + TILE - 1 + o, -1, -1]]) {
      for (let i = 0; i < 5; i++) {
        px(g, cx + i * sx, cy, col);
        px(g, cx, cy + i * sy, col);
      }
    }
  }

  // --- atmosphere -----------------------------------------------------------------

  private lights(s: GameState, now: number): Light[] {
    const out: Light[] = [];
    const flicker = 0.92 + Math.sin(now / 90) * 0.04 + Math.sin(now / 37) * 0.03;
    for (const e of s.entities) {
      const gp = groundOf(e.pos, e.size);
      if (e.defId === 'consecrator') out.push({ x: gp.x + 6, y: gp.y - 12, r: 46, i: 0.55 * flicker, color: PAL.y });
      else if (e.defId === 'penitent') out.push({ x: gp.x + 7, y: gp.y - 6, r: 30, i: 0.42 * flicker, color: PAL.E });
      else if (e.faction === 'vigil') out.push({ x: gp.x, y: gp.y - 8, r: 30, i: 0.4 });
      else if (e.defId === 'shrine') out.push({ x: gp.x, y: gp.y - 12, r: 44, i: 0.5 * flicker, color: PAL.y });
      else if (hasTag(e, 'wound')) out.push({ x: gp.x, y: gp.y - 6, r: 34, i: 0.4 + Math.sin(now / 300) * 0.06, color: hasTag(e, 'bell') ? PAL.q : PAL.v });
      else if (hasTag(e, 'boss')) out.push({ x: gp.x + 4, y: gp.y - 46, r: 50, i: 0.4, color: PAL.q });
      else if (e.defId === 'chanter') out.push({ x: gp.x, y: gp.y - 22, r: 26, i: 0.35 * flicker, color: PAL.E });
      else if (e.faction === 'demon') out.push({ x: gp.x, y: gp.y - 8, r: 20, i: 0.25 });
    }
    return out;
  }

  private drawFog(region: 'ash' | 'drowned', now: number): void {
    const g = this.g;
    const col = REGIONS[region].fog;
    g.fillStyle = col;
    g.globalAlpha = 0.07;
    for (let band = 0; band < 3; band++) {
      const by = OY + 30 + band * 64;
      const off = Math.floor(now / (120 + band * 40)) % VIEW_W;
      for (let y = 0; y < 18; y++)
        for (let x = 0; x < VIEW_W; x += 2) {
          const xx = (x + off + (y % 2)) % VIEW_W;
          const n = Math.sin((xx + band * 50) / 23) + Math.sin((xx + y * 3) / 9);
          if (n > 0.6 - Math.abs(y - 9) * 0.12) g.fillRect(x, by + y, 1, 1);
        }
    }
    g.globalAlpha = 1;
  }
}
