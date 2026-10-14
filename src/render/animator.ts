// Replays engine events as animations on a display copy of the state. When a
// sequence finishes, the display snaps to the authoritative state, so the
// picture can never drift from the rules.
import { cloneState } from '../core/clone';
import { getUnitDef } from '../core/registry';
import { DIRS, getEntity, tileAt } from '../core/grid';
import type { GameEvent } from '../core/events';
import type { Entity, GameState, Vec } from '../core/types';
import { Fx } from './effects';
import { groundOf } from './layout';
import { PAL } from './palette';
import { TILE } from './tiles';

export interface EntityVisual {
  dx: number;
  dy: number;
  flash: boolean;
  sink: number; // 0..1, sinking into the ground / water
  hidden: boolean;
  frame?: string; // sprite override (e.g. open maw)
}

export interface AnimatorHooks {
  sound(id: string): void;
  banner(text: string, sub?: string): Promise<void>;
}

export class Animator {
  display: GameState;
  fx = new Fx();
  now = 0;
  speed = 1;
  private visuals = new Map<string, EntityVisual>();
  private waiters: { until: number; resolve: () => void }[] = [];
  busy = false;

  constructor(state: GameState, private hooks: AnimatorHooks) {
    this.display = cloneState(state);
  }

  sync(state: GameState): void {
    this.display = cloneState(state);
    this.visuals.clear();
  }

  visual(id: string): EntityVisual {
    let v = this.visuals.get(id);
    if (!v) this.visuals.set(id, (v = { dx: 0, dy: 0, flash: false, sink: 0, hidden: false }));
    return v;
  }

  update(dtMs: number): void {
    this.now += dtMs * this.speed;
    this.fx.update();
    const ready = this.waiters.filter((w) => w.until <= this.now);
    this.waiters = this.waiters.filter((w) => w.until > this.now);
    for (const w of ready) w.resolve();
  }

  wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.waiters.push({ until: this.now + ms, resolve }));
  }

  private async tween(ms: number, f: (k: number) => void): Promise<void> {
    const t0 = this.now;
    for (;;) {
      const k = Math.min(1, (this.now - t0) / ms);
      f(k);
      if (k >= 1) return;
      await this.wait(16);
    }
  }

  private ent(id: string): Entity | null {
    return getEntity(this.display, id);
  }

  private center(e: Entity): Vec {
    const g = groundOf(e.pos, e.size);
    return { x: g.x, y: g.y - 8 };
  }

  async play(events: GameEvent[], final: GameState): Promise<void> {
    this.busy = true;
    try {
      for (const ev of events) await this.step(ev, final);
    } finally {
      this.sync(final);
      this.busy = false;
    }
  }

  private async slideTo(e: Entity, to: Vec, ms: number): Promise<void> {
    const v = this.visual(e.id);
    const fx = (to.x - e.pos.x) * TILE;
    const fy = (to.y - e.pos.y) * TILE;
    await this.tween(ms, (k) => {
      const kk = k * k * (3 - 2 * k);
      v.dx = Math.round(fx * kk);
      v.dy = Math.round(fy * kk);
    });
    e.pos = { ...to };
    v.dx = v.dy = 0;
  }

  private async step(ev: GameEvent, final: GameState): Promise<void> {
    const now = this.now;
    switch (ev.t) {
      case 'banner':
        await this.hooks.banner(ev.text, ev.sub);
        return;
      case 'move': {
        const e = this.ent(ev.id);
        if (!e) return;
        for (const p of ev.path) {
          this.hooks.sound('step');
          await this.slideTo(e, p, 85);
        }
        return;
      }
      case 'charge': {
        const e = this.ent(ev.id);
        if (!e) return;
        this.hooks.sound('charge');
        const c = this.center(e);
        this.fx.burst(c.x, c.y + 6, 6, [PAL.s, PAL.G], 0.6);
        await this.slideTo(e, ev.to, 60 * Math.max(1, Math.abs(ev.to.x - ev.from.x) + Math.abs(ev.to.y - ev.from.y)));
        return;
      }
      case 'push': {
        const e = this.ent(ev.id);
        if (!e) return;
        this.hooks.sound('push');
        await this.slideTo(e, ev.to, 120);
        const c = this.center(e);
        this.fx.burst(c.x, c.y + 8, 4, [PAL.s, PAL.G], 0.5);
        return;
      }
      case 'bump': {
        const e = this.ent(ev.id);
        if (!e) return;
        this.hooks.sound('bump');
        const v = this.visual(e.id);
        const d = DIRS[ev.dir];
        await this.tween(70, (k) => { v.dx = Math.round(d.x * 6 * k); v.dy = Math.round(d.y * 6 * k); });
        this.fx.shake = 2;
        const c = this.center(e);
        this.fx.burst(c.x + d.x * 10, c.y + d.y * 10, 8, [PAL.S, PAL.w, PAL.G], 1);
        await this.tween(90, (k) => { v.dx = Math.round(d.x * 6 * (1 - k)); v.dy = Math.round(d.y * 6 * (1 - k)); });
        return;
      }
      case 'resist': {
        const e = this.ent(ev.id);
        if (!e) return;
        const v = this.visual(e.id);
        await this.tween(160, (k) => { v.dx = Math.round(Math.sin(k * Math.PI * 4) * 1.5); });
        v.dx = 0;
        return;
      }
      case 'damage': {
        const e = this.ent(ev.id);
        if (!e) return;
        e.hp = ev.hp;
        const v = this.visual(e.id);
        const c = this.center(e);
        this.hooks.sound(e.faction === 'vigil' ? 'hurt' : 'hit');
        this.fx.text(now, c.x, c.y - 14, `-${ev.amount}`, ev.cause === 'taint' ? PAL.V : PAL.e);
        this.fx.burst(c.x, c.y, 6, e.tags.includes('demon') ? [PAL.R, PAL.r, PAL.v] : e.tags.includes('structure') ? [PAL.s, PAL.G] : [PAL.R, PAL.e]);
        this.fx.shake = Math.max(this.fx.shake, 1.5);
        v.flash = true;
        await this.wait(90);
        v.flash = false;
        await this.wait(60);
        return;
      }
      case 'shieldBlock': {
        const e = this.ent(ev.id);
        if (!e) return;
        e.shield = false;
        this.hooks.sound('ward');
        const c = this.center(e);
        this.fx.burst(c.x, c.y, 12, [PAL.Q, PAL.f, PAL.C], 1.2);
        this.fx.iconPop(now, c.x, c.y - 12, 'shield');
        await this.wait(200);
        return;
      }
      case 'shield': {
        const e = this.ent(ev.id);
        if (!e) return;
        e.shield = true;
        const c = this.center(e);
        this.fx.ring(now, c.x, c.y, PAL.Q, 2, 14, 400);
        await this.wait(250);
        return;
      }
      case 'heal': {
        const e = this.ent(ev.id);
        if (!e) return;
        e.hp = ev.hp;
        const c = this.center(e);
        this.fx.text(now, c.x, c.y - 14, `+${ev.amount}`, '#8fdc8a');
        await this.wait(200);
        return;
      }
      case 'warded': {
        const e = this.ent(ev.id);
        if (!e) return;
        this.hooks.sound('warded');
        const c = this.center(e);
        this.fx.ring(now, c.x, c.y - 10, PAL.q, 8, 24, 500);
        this.fx.iconPop(now, c.x, c.y - 26, 'bell', 800);
        await this.wait(300);
        return;
      }
      case 'death': {
        const e = this.ent(ev.id);
        if (!e) return;
        const v = this.visual(e.id);
        const c = this.center(e);
        if (ev.cause === 'drown') {
          this.hooks.sound('drown');
          await this.tween(380, (k) => (v.sink = k));
          this.fx.burst(c.x, c.y + 8, 14, [PAL.Q, PAL.q, PAL.T], 1.1);
        } else {
          this.hooks.sound(e.faction === 'vigil' ? 'fall' : e.tags.includes('structure') ? 'crumble' : 'death');
          v.flash = true;
          await this.wait(80);
          v.flash = false;
          const colors = e.faction === 'demon' ? [PAL.v, PAL.P, PAL.R, PAL.k] : e.faction === 'vigil' ? [PAL.y, PAL.w, PAL.R] : [PAL.s, PAL.G, PAL.g];
          this.fx.burst(c.x, c.y, 26, colors, 1.3, 0.05, 50);
          await this.tween(220, (k) => (v.sink = k));
        }
        this.display.entities = this.display.entities.filter((x) => x.id !== e.id);
        return;
      }
      case 'tile': {
        const t = tileAt(this.display, ev.at);
        if (!t) return;
        t.corrupted = ev.corrupted;
        t.consecrated = ev.consecrated;
        const g = groundOf(ev.at);
        if (ev.consecrated) this.fx.rise(g.x, g.y - 6, 8, [PAL.Y, PAL.y, PAL.O]);
        else if (ev.corrupted) {
          this.fx.rise(g.x, g.y - 6, 6, [PAL.V, PAL.v, PAL.P]);
          this.hooks.sound('taint');
        } else this.fx.rise(g.x, g.y - 6, 5, [PAL.w, PAL.W]);
        await this.wait(ev.cause === 'spread' ? 160 : 60);
        return;
      }
      case 'spawn': {
        const src = getEntity(final, ev.id);
        const def = getUnitDef(ev.defId);
        const e: Entity = src
          ? cloneState({ ...final, entities: [src] } as GameState).entities[0]
          : { id: ev.id, defId: ev.defId, name: def.name, faction: def.faction, pos: { ...ev.at }, size: 1, hp: def.hp, maxHp: def.hp, move: def.move, tags: def.tags.slice(), abilities: def.abilities.slice(), shield: false, moved: false, acted: false, cooldowns: {}, intent: null, intentOrder: 0, behavior: 'none', memory: {} };
        e.pos = { ...ev.at };
        e.intent = null;
        this.display.entities.push(e);
        const v = this.visual(e.id);
        this.hooks.sound('spawn');
        const g = groundOf(ev.at);
        this.fx.burst(g.x, g.y - 4, 16, [PAL.V, PAL.v, PAL.P, PAL.k], 1.1);
        await this.tween(420, (k) => (v.sink = 1 - k));
        return;
      }
      case 'spawnBlocked': {
        const g = groundOf(ev.at);
        this.fx.burst(g.x, g.y - 4, 10, ev.reason === 'hallowed' ? [PAL.Y, PAL.y] : [PAL.V, PAL.P], 0.9);
        this.hooks.sound('blocked');
        await this.wait(200);
        return;
      }
      case 'sealed': {
        this.hooks.sound('seal');
        const g = groundOf(ev.at);
        this.fx.beam(now, g.x, g.y - 4, PAL.O, PAL.Y, 900);
        this.fx.ring(now, g.x, g.y - 4, PAL.Y, 4, 40, 700);
        this.fx.burst(g.x, g.y - 10, 30, [PAL.Y, PAL.y, PAL.W], 1.6, 0.03, 60);
        this.fx.shake = 3;
        await this.wait(500);
        return;
      }
      case 'desecrated': {
        this.hooks.sound('desecrate');
        const g = groundOf(ev.at);
        this.fx.ring(now, g.x, g.y - 4, PAL.v, 4, 30, 600);
        await this.wait(300);
        return;
      }
      case 'rebuke': {
        const e = this.ent(ev.id);
        if (!e) return;
        const c = this.center(e);
        this.fx.iconPop(now, c.x, c.y - 14, ev.silenced ? 'skull' : 'rebuke', 800);
        await this.wait(200);
        return;
      }
      case 'surface': {
        const e = this.ent(ev.id);
        if (!e) return;
        const v = this.visual(e.id);
        this.hooks.sound('surface');
        await this.tween(420, (k) => (v.sink = k));
        e.pos = { ...ev.to };
        const g = groundOf(e.pos, e.size);
        this.fx.burst(g.x, g.y - 6, 26, [PAL.Q, PAL.q, PAL.T, PAL.W], 1.5);
        this.fx.shake = 3;
        await this.tween(420, (k) => (v.sink = 1 - k));
        return;
      }
      case 'attack':
        await this.attack(ev);
        return;
      case 'outcome':
        return;
    }
  }

  private async attack(ev: Extract<GameEvent, { t: 'attack' }>): Promise<void> {
    const e = this.ent(ev.sourceId);
    const now = this.now;
    const at = ev.impact ? groundOf(ev.impact) : null;
    const from = e ? this.center(e) : groundOf(ev.from);
    const v = e ? this.visual(e.id) : null;
    switch (ev.anim) {
      case 'melee': {
        if (!v || ev.dir === null) break;
        const d = DIRS[ev.dir];
        this.hooks.sound(e?.faction === 'vigil' ? 'flail' : 'claw');
        await this.tween(80, (k) => { v.dx = Math.round(d.x * 7 * k); v.dy = Math.round(d.y * 7 * k); });
        if (at) this.fx.slash(now, at.x, at.y - 8, ev.dir, e?.faction === 'vigil' ? PAL.E : PAL.V);
        await this.tween(110, (k) => { v.dx = Math.round(d.x * 7 * (1 - k)); v.dy = Math.round(d.y * 7 * (1 - k)); });
        break;
      }
      case 'projectile':
      case 'chain': {
        if (!at) break;
        this.hooks.sound('chain');
        const dist = Math.abs(at.x - from.x) + Math.abs(at.y - from.y);
        const dur = 60 + dist * 3;
        this.fx.projectile(now, [from, { x: at.x, y: at.y - 8 }], dur, PAL.C, PAL.c, ev.anim === 'chain');
        await this.wait(dur);
        break;
      }
      case 'artillery': {
        if (!at) break;
        this.hooks.sound('bile');
        this.fx.lob(now, { x: from.x, y: from.y - 6 }, { x: at.x, y: at.y - 6 }, 420, PAL.v);
        await this.wait(420);
        this.fx.burst(at.x, at.y - 6, 14, [PAL.V, PAL.v, PAL.P], 1.2);
        break;
      }
      case 'charge':
        this.hooks.sound('roar');
        break;
      case 'hallow': {
        if (!at) break;
        this.hooks.sound('hallow');
        this.fx.beam(now, at.x, at.y - 4, PAL.O, PAL.Y, 520);
        await this.wait(260);
        break;
      }
      case 'ward': {
        if (!at) break;
        this.hooks.sound('ward');
        this.fx.ring(now, at.x, at.y - 10, PAL.Q, 14, 3, 380);
        await this.wait(250);
        break;
      }
      case 'rebuke': {
        if (!at) break;
        this.hooks.sound('rebuke');
        this.fx.projectile(now, [from, { x: at.x, y: at.y - 10 }], 160, PAL.Y, PAL.y);
        await this.wait(160);
        this.fx.ring(now, at.x, at.y - 10, PAL.Y, 3, 16, 420);
        break;
      }
      case 'chant': {
        this.hooks.sound('chant');
        this.fx.ring(now, from.x, from.y + 4, PAL.V, 2, 26, 600);
        if (v) await this.tween(400, (k) => (v.dy = -Math.round(Math.sin(k * Math.PI) * 3)));
        break;
      }
      case 'tide': {
        this.hooks.sound('tide');
        this.fx.shake = 2;
        const tiles = ev.tiles.map((p) => groundOf(p));
        const dir = ev.dir === 1 ? 1 : -1;
        this.fx.add(now, 650, (g, k) => {
          for (const t of tiles) {
            const phase = dir < 0 ? 1 - k : k;
            const wx = Math.round(t.x - 12 + ((phase * 7 + t.x / 24) % 1) * 24);
            for (let i = -2; i <= 2; i++) {
              g.fillStyle = i === 0 ? PAL.Q : PAL.q;
              g.fillRect(wx + i * dir, t.y - 6 + Math.abs(i), 1, 3);
            }
          }
        });
        await this.wait(500);
        break;
      }
      case 'maw': {
        this.hooks.sound('maw');
        if (v) v.frame = 'leviathan_maw';
        if (v) await this.tween(160, (k) => (v.dx = Math.round(10 * k)));
        for (const p of ev.tiles) {
          const gpt = groundOf(p);
          this.fx.slash(now, gpt.x, gpt.y - 8, 0, PAL.W);
          this.fx.slash(now, gpt.x, gpt.y - 8, 1, PAL.W);
        }
        this.fx.shake = 4;
        if (v) await this.tween(240, (k) => (v.dx = Math.round(10 * (1 - k))));
        if (v) v.frame = undefined;
        break;
      }
      case 'surface': {
        for (const p of ev.tiles) {
          const gpt = groundOf(p);
          this.fx.burst(gpt.x, gpt.y - 4, 12, [PAL.Q, PAL.q, PAL.s], 1.4);
        }
        this.fx.shake = 3;
        await this.wait(200);
        break;
      }
    }
  }
}
