// Screen flow: title → the Reclamation (campaign map) → briefing → battle →
// result → back to the map.
import { getEncounter, getUnitDef } from '../core';
import { CAMPAIGN } from '../content';
import { audio } from '../audio/audio';
import { backdrop } from '../render/backdrop';
import { sprite } from '../render/sprites';
import { floor, TILE } from '../render/tiles';
import { ctx2d, flipX, makeCanvas, px, rect, shaded } from '../render/pixel';
import { PAL } from '../render/palette';
import { BattleScreen, portrait } from './battle';
import { clear, h, img } from './dom';
import { showHelp } from './help';
import { loadProgress, saveProgress, type Progress } from './progress';

interface Site {
  id: string | null;
  numeral: string;
  name: string;
  line: string;
  entity?: string;
  region: 'ash' | 'drowned' | 'coil' | 'heaven';
}

const SITES: Site[] = [
  { id: 'ashen_parish', numeral: 'I', name: 'The Ashen Parish', line: 'A churchyard torn open by two Taint Wounds. Learn the rites of the Vigil.', region: 'ash' },
  { id: 'drowned_nave', numeral: 'II', name: 'The Drowned Nave', line: 'The sea sings in the flooded crypt. An entity answers. Boss: the Leviathan.', entity: 'leviathan', region: 'drowned' },
  { id: null, numeral: 'III', name: 'The Coil Beneath', line: 'Something circles the roots of the world and tightens the board around itself.', region: 'coil' },
  { id: null, numeral: 'IV', name: 'The False Heaven', line: 'The Demiurge rewrites the rules of the field. Not yet.', region: 'heaven' },
];

export class App {
  private root: HTMLElement;
  private progress: Progress = loadProgress();
  private battle: BattleScreen | null = null;
  private stopAnim: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    audio.setMuted(this.progress.muted);
    this.title();
  }

  private reset(): void {
    this.stopAnim?.();
    this.stopAnim = null;
    this.battle?.destroy();
    this.battle = null;
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
    clear(this.root);
  }

  // --- title ------------------------------------------------------------------

  title(): void {
    this.reset();
    const bg = h('canvas', { class: 'bg' });
    const screen = h(
      'div',
      { class: 'screen' },
      bg,
      h(
        'div',
        { class: 'title-block' },
        h('div', { class: 'logo' }, 'Sanctumfall'),
        h('div', { class: 'tag' }, 'The Ninth Vigil · a tactics of purification'),
        h(
          'div',
          { class: 'menu' },
          h('button', { class: 'btn primary big', onclick: () => this.begin() }, 'Begin the Vigil'),
          h('button', { class: 'btn', onclick: () => this.map() }, 'The Reclamation'),
          h('button', { class: 'btn', onclick: () => showHelp() }, 'Rites & rules'),
          h('button', { class: 'btn', onclick: (e: Event) => this.toggleSound(e.currentTarget as HTMLButtonElement) }, audio.muted ? 'Sound: off' : 'Sound: on'),
        ),
      ),
      h('div', { class: 'title-foot' }, 'The old entities are reclaiming the world. Three of the Vigil remain.'),
    );
    this.root.append(screen);
    this.stopAnim = animateTitle(bg);
  }

  private toggleSound(btn: HTMLButtonElement): void {
    audio.setMuted(!audio.muted);
    this.progress.muted = audio.muted;
    saveProgress(this.progress);
    btn.textContent = audio.muted ? 'Sound: off' : 'Sound: on';
    if (!audio.muted) audio.startDrone('title');
  }

  private begin(): void {
    audio.ensure();
    audio.startDrone('title');
    audio.play('turn');
    this.map();
  }

  // --- the Reclamation map ---------------------------------------------------------

  map(): void {
    this.reset();
    audio.ensure();
    audio.startDrone('title');
    const sites = h('div', { class: 'sites' });
    SITES.forEach((site, i) => {
      const cleared = !!site.id && this.progress.cleared.includes(site.id);
      const locked = !site.id;
      const state = locked ? 'Not yet' : cleared ? 'Sealed' : i === 0 || this.progress.cleared.includes(SITES[i - 1].id ?? '') ? 'Awaits the Vigil' : 'Awaits — the Parish first is advised';
      sites.append(
        h(
          'div',
          { class: `frame site${locked ? ' locked' : ''}`, onclick: () => site.id && this.briefing(site.id) },
          h('div', { class: 'numeral' }, site.numeral),
          h('div', { class: 'vista' }, vista(site)),
          h('div', { class: 'sn' }, site.name),
          h('div', { class: 'ss' }, site.line),
          h('div', { class: `state ${locked ? 'locked' : cleared ? 'cleared' : 'open'}` }, state),
        ),
      );
    });
    const screen = h(
      'div',
      { class: 'screen' },
      h('canvas', { class: 'bg' }),
      h(
        'div',
        { class: 'map' },
        h('div', { class: 'head' }, h('div', { class: 't' }, 'The Reclamation'), h('div', { class: 's' }, 'Choose where the Vigil marches. Each land holds its own wound in the world.')),
        sites,
        h('div', { class: 'row', style: { display: 'flex', justifyContent: 'center', marginTop: '18px', gap: '8px' } }, h('button', { class: 'btn', onclick: () => this.title() }, 'Back'), h('button', { class: 'btn', onclick: () => showHelp() }, 'Rites & rules')),
      ),
    );
    this.root.append(screen);
    this.stopAnim = animateTitle(screen.querySelector('canvas')!, true);
  }

  private briefing(id: string): void {
    audio.play('select');
    const enc = getEncounter(id);
    const demons = new Set<string>();
    for (const row of enc.map) for (const ch of row) {
      const ent = enc.legend[ch]?.entity;
      if (ent && getUnitDef(ent).faction === 'demon') demons.add(ent);
    }
    for (const d of enc.spawnPool) demons.add(d);
    const overlay = h(
      'div',
      { class: 'overlay' },
      h(
        'div',
        { class: 'frame gilded briefing' },
        h('h1', {}, enc.name),
        h('p', { class: 'lead' }, enc.subtitle),
        ...enc.briefing.map((l) => h('p', {}, l)),
        h('div', { class: 'section-title', style: { marginTop: '14px' } }, 'Objectives'),
        ...enc.objectives.map((o) => h('div', { class: `obj${o.bonus ? ' bonus' : ''}` }, h('div', { class: 'box' }), h('div', {}, o.bonus ? h('span', { class: 'tag' }, 'Bonus ') : '', o.label))),
        h('div', { class: 'obj' }, h('div', { class: 'box', style: { borderColor: 'var(--taint)' } }), h('div', {}, `Defeat if the Taint covers ${enc.taintLimit} tiles, or the Vigil falls`)),
        h('div', { class: 'section-title', style: { marginTop: '14px' } }, 'Known horrors'),
        h('div', { class: 'roster' }, ...[...demons].map((d) => h('div', { class: 'r', title: getUnitDef(d).blurb }, img(portrait(d, 2)), getUnitDef(d).name))),
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => overlay.remove() }, 'Not yet'), h('button', { class: 'btn primary big', onclick: () => this.fight(id) }, 'Begin')),
      ),
    );
    document.body.append(overlay);
  }

  // --- battle ---------------------------------------------------------------------

  fight(id: string): void {
    this.reset();
    const idx = CAMPAIGN.indexOf(id as (typeof CAMPAIGN)[number]);
    const next = idx >= 0 && idx < CAMPAIGN.length - 1 ? CAMPAIGN[idx + 1] : null;
    this.battle = new BattleScreen(id, {
      exit: () => this.map(),
      restart: () => this.fight(id),
      victory: (encId) => {
        if (!this.progress.cleared.includes(encId)) this.progress.cleared.push(encId);
        saveProgress(this.progress);
      },
      next,
      goNext: () => next && this.fight(next),
    });
    this.root.append(this.battle.root);
  }
}

// --- decorative canvases ----------------------------------------------------------

function vista(site: Site): HTMLCanvasElement {
  const W = 96, H = 60;
  const c = makeCanvas(W, H);
  const g = ctx2d(c);
  if (site.region === 'ash' || site.region === 'drowned') {
    g.drawImage(backdrop(site.region), 0, -10);
    for (let x = 0; x < 4; x++) g.drawImage(floor(site.region, x + 1), x * TILE, H - 18);
    if (site.region === 'ash') {
      const w = sprite('wound').frames[0];
      g.drawImage(w, 8, H - 30);
      const h1 = sprite('hollow').frames[0];
      g.drawImage(h1, 40, H - 38);
      const sh = sprite('shrine').frames[0];
      g.drawImage(sh, 66, H - 46);
    } else {
      const lev = sprite('leviathan').frames[0];
      g.drawImage(lev, 22, H - 60, lev.width * 0.9, lev.height * 0.9);
      rect(g, 0, H - 10, W, 10, PAL.t);
      for (let x = 0; x < W; x += 3) px(g, x, H - 10, PAL.q);
    }
  } else if (site.region === 'coil') {
    rect(g, 0, 0, W, H, '#0b0a09');
    for (let a = 0; a < 360; a += 3) {
      const r = (a * Math.PI) / 180;
      const R = 18 + Math.sin(r * 3) * 4;
      px(g, Math.round(48 + Math.cos(r) * R * 1.6), Math.round(30 + Math.sin(r) * R), a % 9 === 0 ? '#5d6b3c' : '#2f3a22');
    }
    px(g, 76, 28, PAL.e);
  } else {
    rect(g, 0, 0, W, H, '#0d0b08');
    for (let i = 0; i < 4; i++)
      for (let a = 0; a < 360; a += 4) {
        const r = (a * Math.PI) / 180;
        if ((a + i * 40) % 90 < 20) continue;
        px(g, Math.round(48 + Math.cos(r) * (8 + i * 6)), Math.round(30 + Math.sin(r) * (5 + i * 4)), i % 2 ? PAL.o : PAL.O);
      }
    px(g, 47, 30, PAL.Y);
    px(g, 48, 30, PAL.Y);
  }
  return c;
}

/** Title / map background: a drowned cathedral in falling ash, a vast shape behind. */
function animateTitle(canvas: HTMLCanvasElement, dim = false): () => void {
  // integer pixel scale, sized to the window so pixels stay square
  const SCALE = 4;
  const W = Math.ceil(window.innerWidth / SCALE);
  const H = Math.ceil(window.innerHeight / SCALE);
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${W * SCALE}px`;
  canvas.style.height = `${H * SCALE}px`;
  const g = ctx2d(canvas);
  const ash = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 0.1 + Math.random() * 0.3, d: Math.random() * 6 }));
  const levSrc = flipX(shaded(sprite('leviathan').frames[0], '#06090a', 0.62));
  const lev = makeCanvas(levSrc.width * 2, levSrc.height * 2);
  ctx2d(lev).drawImage(levSrc, 0, 0, lev.width, lev.height);
  const vigil = ['penitent', 'consecrator', 'inquisitor'].map((id) => shaded(sprite(id).frames[0], '#050304', 0.55));
  let raf = 0;
  const bd = backdrop('ash');
  const ground = Math.round(H * 0.8);
  const lx = Math.round(W * 0.64);
  const frame = (t: number) => {
    rect(g, 0, 0, W, H, '#0a0708');
    for (let x = 0; x < W; x += bd.width) g.drawImage(bd, 0, 0, bd.width, 80, x, ground - 104, bd.width, 80);
    const rise = Math.round(Math.sin(t / 3000) * 2);
    const ly = ground - lev.height + 20 + rise;
    g.drawImage(lev, lx, ly);
    // ground and fog
    for (let y = ground; y < H; y++) for (let x = 0; x < W; x++) if ((x + y) % 2 === 0 || y > ground + 10) px(g, x, y, '#0d0909');
    // the last three of the Vigil, facing it
    vigil.forEach((v, i) => g.drawImage(v, Math.round(W * 0.3) + i * 16, ground - v.height + 2));
    const lantern = Math.round(W * 0.3) + 16 + 15;
    if (Math.floor(t / 130) % 7 !== 0) px(g, lantern, ground - 10, PAL.y);
    for (const a of ash) {
      a.y += a.v;
      a.x += Math.sin((t / 1000 + a.d) * 1.3) * 0.15;
      if (a.y > H) {
        a.y = -2;
        a.x = Math.random() * W;
      }
      px(g, Math.round(a.x), Math.round(a.y), a.d > 4 ? '#8a7f70' : '#4d453d');
    }
    if (dim) {
      g.fillStyle = 'rgba(10,7,8,0.55)';
      g.fillRect(0, 0, W, H);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
