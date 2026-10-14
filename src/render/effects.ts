// Transient visual effects: particles, projectiles, floating text, flashes.
// Positions are in logical pixels and always drawn on integer coordinates.
import { PAL } from './palette';
import { drawText, textWidth } from './font';
import { icon } from './icons';
import { line, px } from './pixel';

export interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; gravity?: number; size?: number;
}

export interface FxItem {
  t0: number;
  dur: number;
  draw(g: CanvasRenderingContext2D, k: number, now: number): void;
}

export class Fx {
  particles: Particle[] = [];
  items: FxItem[] = [];
  shake = 0;

  burst(x: number, y: number, n: number, colors: string[], speed = 1, gravity = 0.04, life = 40): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.3 + Math.random()) * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.6, life: life * (0.6 + Math.random() * 0.6), max: life, color: colors[i % colors.length], gravity });
    }
  }

  rise(x: number, y: number, n: number, colors: string[], spread = 8): void {
    for (let i = 0; i < n; i++)
      this.particles.push({ x: x + (Math.random() - 0.5) * spread * 2, y: y + Math.random() * 4, vx: (Math.random() - 0.5) * 0.15, vy: -0.25 - Math.random() * 0.5, life: 30 + Math.random() * 40, max: 70, color: colors[i % colors.length], gravity: 0 });
  }

  add(now: number, dur: number, draw: FxItem['draw']): void {
    this.items.push({ t0: now, dur, draw });
  }

  text(now: number, x: number, y: number, s: string, color: string): void {
    this.add(now, 900, (g, k) => {
      const yy = Math.round(y - 10 * Math.min(1, k * 2.5));
      if (k > 0.85 && Math.floor(now / 60) % 2) return;
      drawText(g, s, Math.round(x - textWidth(s) / 2), yy, color);
    });
  }

  iconPop(now: number, x: number, y: number, id: string, dur = 700): void {
    const ic = icon(id);
    this.add(now, dur, (g, k) => {
      const yy = Math.round(y - ic.height - 4 * Math.min(1, k * 3));
      g.drawImage(ic, Math.round(x - ic.width / 2), yy);
    });
  }

  ring(now: number, x: number, y: number, color: string, r0: number, r1: number, dur = 400): void {
    this.add(now, dur, (g, k) => {
      const r = r0 + (r1 - r0) * k;
      const n = Math.max(12, Math.round(r * 5));
      for (let i = 0; i < n; i++) {
        if ((i + Math.floor(k * 10)) % 3 === 0) continue;
        const a = (i / n) * Math.PI * 2;
        px(g, Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.6), color);
      }
    });
  }

  beam(now: number, x: number, y: number, color: string, glint: string, dur = 500): void {
    this.add(now, dur, (g, k) => {
      const w = Math.round(6 * (1 - k)) + 1;
      for (let yy = 0; yy < y; yy++) {
        if ((yy + Math.floor(now / 40)) % 3 === 0) continue;
        for (let xx = -w; xx <= w; xx++) if (Math.abs(xx) === w || (xx + yy) % 2 === 0) px(g, x + xx, yy, Math.abs(xx) < 2 ? glint : color);
      }
    });
  }

  slash(now: number, x: number, y: number, dir: number, color = PAL.W): void {
    this.add(now, 220, (g, k) => {
      const len = 10;
      const n = Math.floor(len * Math.min(1, k * 2));
      for (let i = 0; i < n; i++) {
        const t = i - len / 2;
        const ox = dir % 2 === 0 ? t : t * 0.4;
        const oy = dir % 2 === 0 ? t * 0.4 : t;
        px(g, Math.round(x + ox), Math.round(y + oy), i > n - 3 ? PAL.f : color);
        px(g, Math.round(x + ox + 1), Math.round(y + oy), PAL.K);
      }
    });
  }

  projectile(now: number, path: { x: number; y: number }[], dur: number, head: string, tail: string, chain = false): void {
    if (path.length < 2) return;
    this.add(now, dur, (g, k) => {
      const a = path[0];
      const b = path[path.length - 1];
      const hx = Math.round(a.x + (b.x - a.x) * k);
      const hy = Math.round(a.y + (b.y - a.y) * k);
      if (chain) line(g, a.x, a.y, hx, hy, tail, 2);
      else line(g, Math.round(a.x + (b.x - a.x) * Math.max(0, k - 0.2)), Math.round(a.y + (b.y - a.y) * Math.max(0, k - 0.2)), hx, hy, tail);
      px(g, hx, hy, head);
      px(g, hx + 1, hy, head);
      px(g, hx, hy + 1, head);
      px(g, hx + 1, hy + 1, PAL.f);
    });
  }

  lob(now: number, a: { x: number; y: number }, b: { x: number; y: number }, dur: number, color: string): void {
    this.add(now, dur, (g, k) => {
      const x = Math.round(a.x + (b.x - a.x) * k);
      const y = Math.round(a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * 26);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]]) px(g, x + dx, y + dy, dx + dy === 2 ? PAL.V : color);
    });
  }

  update(): void {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity ?? 0;
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    this.shake = Math.max(0, this.shake - 0.15);
  }

  draw(g: CanvasRenderingContext2D, now: number): void {
    for (const p of this.particles) {
      if (p.life < 8 && Math.floor(p.life) % 2) continue;
      px(g, Math.round(p.x), Math.round(p.y), p.color);
    }
    this.items = this.items.filter((it) => now - it.t0 < it.dur);
    for (const it of this.items) it.draw(g, Math.max(0, Math.min(1, (now - it.t0) / it.dur)), now);
  }
}
