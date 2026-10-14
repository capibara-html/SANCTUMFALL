// The battle screen: owns a BattleSession (rules), an Animator + Renderer
// (presentation) and the DOM HUD. All rule questions are answered by the
// core; this file only decides what to show and which action to send.
import {
  BattleSession,
  buildState,
  allObjectives,
  entityAt,
  eq,
  forecastIntent,
  forecastReckoning,
  forecastUse,
  getAbility,
  getEncounter,
  getEntity,
  getUnitDef,
  hasTag,
  intentQueue,
  isWarded,
  key,
  reachable,
  taintCount,
  targetOptions,
  tileAt,
  upcomingLitany,
  useFootprint,
  DIR_NAMES,
} from '../core';
import type { AbilityUse, Dir, Entity, Forecast, GameEvent, GameState, TargetOption, Vec } from '../core';
import { Animator } from '../render/animator';
import { Renderer, type BoardView } from '../render/renderer';
import { VIEW_H, VIEW_W, tileFromPoint } from '../render/layout';
import { iconURL } from '../render/icons';
import { sprite } from '../render/sprites';
import { toDataURL } from '../render/pixel';
import { audio } from '../audio/audio';
import { clear, h, img } from './dom';
import { showHelp } from './help';

export interface BattleCallbacks {
  exit(): void;
  victory(encounterId: string): void;
  restart(): void;
  next: string | null;
  goNext(): void;
}

interface Preview {
  key: string;
  forecast: Forecast;
  threat: Forecast;
  tiles: Vec[];
  arrows: { at: Vec; dir: Dir }[];
}

const portraitCache = new Map<string, string>();
export function portrait(defId: string, scale = 3): string {
  const k = `${defId}@${scale}`;
  let u = portraitCache.get(k);
  if (!u) portraitCache.set(k, (u = toDataURL(sprite(defId).frames[0], scale)));
  return u;
}

export class BattleScreen {
  readonly root: HTMLElement;
  private session: BattleSession;
  private anim: Animator;
  private renderer: Renderer;
  private selectedId: string | null = null;
  private abilityId: string | null = null;
  private hover: Vec | null = null;
  private focusEnemy: string | null = null;
  private confirmEnd = false;
  private busy = false;
  private showIntents = true;
  private threat: Forecast | null = null;
  private preview: Preview | null = null;
  private raf = 0;
  private last = 0;
  private resultShown = false;
  private els!: {
    canvas: HTMLCanvasElement;
    holder: HTMLElement;
    banner: HTMLElement;
    hint: HTMLElement;
    round: HTMLElement;
    phase: HTMLElement;
    taint: HTMLElement;
    squad: HTMLElement;
    abilities: HTMLElement;
    actions: HTMLElement;
    objectives: HTMLElement;
    litany: HTMLElement;
    threats: HTMLElement;
    inspector: HTMLElement;
  };
  private onKey = (e: KeyboardEvent) => this.key(e);
  private onResize = () => this.fit();

  constructor(private encounterId: string, private cb: BattleCallbacks) {
    this.session = new BattleSession(encounterId);
    const enc = getEncounter(encounterId);
    this.root = this.build();
    this.renderer = new Renderer(this.els.canvas);
    this.anim = new Animator(this.session.state, {
      sound: (id) => audio.play(id),
      banner: (t, s) => this.banner(t, s),
    });
    // show the board as it was before the demons' opening moves
    const before = this.preOpeningState();
    this.anim.sync(before);
    audio.startDrone(enc.region);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
    this.raf = requestAnimationFrame((t) => this.loop(t));
    void this.run(this.session.openingEvents, true);
  }

  /** The board before the demons' opening moves, so those can be animated. */
  private preOpeningState(): GameState {
    const s = buildState(this.encounterId);
    s.round = 1;
    return s;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    this.root.remove();
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
  }

  get state(): GameState {
    return this.session.state;
  }

  // --- DOM ----------------------------------------------------------------------

  private build(): HTMLElement {
    const enc = getEncounter(this.encounterId);
    const canvas = h('canvas', { 'aria-label': 'Battle board' });
    const banner = h('div', { class: 'banner' });
    const holder = h('div', { class: 'board-holder' }, canvas, banner);
    const hint = h('div', { class: 'hint' });
    const els = {
      canvas,
      holder,
      banner,
      hint,
      round: h('span', { class: 'sub' }),
      phase: h('span', { class: 'phase-chip' }),
      taint: h('div', { class: 'taint' }),
      squad: h('div', { class: 'squad', style: { display: 'flex', flexDirection: 'column', gap: '6px' } }),
      abilities: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }),
      actions: h('div', { class: 'actions' }),
      objectives: h('div'),
      litany: h('div', { class: 'frame', style: { display: 'none' } }),
      threats: h('div'),
      inspector: h('div', { class: 'inspector' }),
    };
    this.els = els;
    canvas.addEventListener('mousemove', (e) => this.mouseMove(e));
    canvas.addEventListener('mouseleave', () => this.setHover(null));
    canvas.addEventListener('click', (e) => this.click(e));
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cancel();
    });
    const top = h(
      'div',
      { class: 'frame topbar' },
      h('div', {}, h('div', { class: 'title' }, enc.name), els.round),
      els.phase,
      h('div', { class: 'spacer' }),
      els.taint,
      h('button', { class: 'btn', title: 'Rules and controls (H)', onclick: () => showHelp() }, 'Help'),
      h('button', { class: 'btn', title: 'Sound (M)', onclick: () => this.toggleMute() }, 'Sound'),
      h('button', { class: 'btn', onclick: () => this.abandon() }, 'Abandon'),
    );
    const left = h(
      'div',
      { class: 'col' },
      h('div', { class: 'frame' }, h('h2', {}, 'The Ninth Vigil'), els.squad),
      h('div', { class: 'frame' }, h('h2', {}, 'Rites'), els.abilities, h('div', { style: { height: '8px' } }), els.actions),
    );
    const right = h(
      'div',
      { class: 'col' },
      h('div', { class: 'frame' }, h('h2', {}, 'Objectives'), els.objectives),
      els.litany,
      h('div', { class: 'frame' }, h('h2', {}, 'The Reckoning'), els.threats),
      h('div', { class: 'frame' }, h('h2', {}, 'Inspect'), els.inspector),
    );
    const center = h('div', { class: 'board-wrap' }, holder, hint);
    const root = h('div', { class: 'battle' }, top, left, center, right);
    requestAnimationFrame(() => this.fit());
    return root;
  }

  private fit(): void {
    const wrap = this.els.holder.parentElement;
    if (!wrap) return;
    const w = wrap.clientWidth - 8;
    const hgt = wrap.clientHeight - 40;
    const scale = Math.max(1, Math.floor(Math.min(w / VIEW_W, hgt / VIEW_H)));
    this.els.canvas.style.width = `${VIEW_W * scale}px`;
    this.els.canvas.style.height = `${VIEW_H * scale}px`;
  }

  // --- main loop ------------------------------------------------------------------

  private loop(t: number): void {
    const dt = this.last ? Math.min(100, t - this.last) : 16;
    this.last = t;
    this.anim.update(dt);
    this.renderer.draw(this.anim, this.view());
    this.raf = requestAnimationFrame((tt) => this.loop(tt));
  }

  private view(): BoardView {
    const s = this.state;
    const interactive = !this.busy && s.phase === 'player';
    const unit = this.selected();
    let moveTiles: Vec[] = [];
    let targetTiles: Vec[] = [];
    if (interactive && unit) {
      if (this.abilityId) targetTiles = this.options().flatMap((o) => o.tiles);
      else if (!unit.moved && !unit.acted) moveTiles = [...reachable(s, unit).values()].map((p) => p[p.length - 1]);
    }
    const pv = interactive ? this.preview : null;
    let previewTiles: Vec[] = pv?.tiles ?? [];
    // a hovered move destination shows its path
    if (interactive && unit && !this.abilityId && this.hover && !pv) {
      const path = reachable(s, unit).get(key(this.hover));
      if (path && !unit.moved) previewTiles = path;
    }
    return {
      region: getEncounter(this.encounterId).region,
      hover: this.hover,
      selectedId: this.selectedId,
      moveTiles,
      targetTiles,
      previewTiles,
      previewArrows: pv?.arrows ?? [],
      forecast: pv?.forecast ?? null,
      threat: interactive ? (pv?.threat ?? this.threat) : null,
      focusEnemyId: this.focusEnemy,
      intentState: pv?.forecast.after ?? (this.busy ? this.anim.display : s),
      showIntents: this.showIntents,
      interactive,
    };
  }

  // --- event playback -------------------------------------------------------------

  private async run(events: GameEvent[], opening = false): Promise<void> {
    this.busy = true;
    this.preview = null;
    this.refresh();
    await this.anim.play(events, this.state);
    this.busy = false;
    this.threat = this.state.phase === 'player' ? forecastReckoning(this.state) : null;
    if (opening && this.state.round === 1) this.hintOnce();
    if (this.selectedId && !getEntity(this.state, this.selectedId)) this.selectedId = null;
    this.refresh();
    if (this.state.phase !== 'player' && !this.resultShown) {
      this.resultShown = true;
      audio.play(this.state.phase === 'victory' ? 'victory' : 'defeat');
      if (this.state.phase === 'victory') this.cb.victory(this.encounterId);
      window.setTimeout(() => this.showResult(), 700);
    }
  }

  private hintOnce(): void {
    try {
      if (localStorage.getItem('sanctumfall.helpSeen')) return;
      localStorage.setItem('sanctumfall.helpSeen', '1');
    } catch {
      return;
    }
    showHelp();
  }

  private banner(text: string, sub?: string): Promise<void> {
    const b = this.els.banner;
    clear(b);
    b.append(h('div', { class: 't' }, text), h('div', { class: 'rule' }), sub ? h('div', { class: 's' }, sub) : '');
    b.classList.toggle('enemy', text === 'The Reckoning' || text.startsWith('Round'));
    b.classList.add('show');
    audio.play(text === 'The Reckoning' ? 'reckoning' : 'turn');
    return this.anim.wait(text === 'Your Vigil' ? 650 : 800).then(() => {
      b.classList.remove('show');
      return this.anim.wait(120);
    });
  }

  // --- selection helpers ------------------------------------------------------------

  private selected(): Entity | null {
    return this.selectedId ? getEntity(this.state, this.selectedId) : null;
  }

  private options(): TargetOption[] {
    const u = this.selected();
    if (!u || !this.abilityId) return [];
    return targetOptions(this.state, u, this.abilityId);
  }

  private optionAt(p: Vec): TargetOption | null {
    return this.options().find((o) => o.tiles.some((t) => eq(t, p))) ?? null;
  }

  private select(id: string | null): void {
    if (id === this.selectedId) return;
    this.selectedId = id;
    this.abilityId = null;
    this.confirmEnd = false;
    this.preview = null;
    if (id) audio.play('select');
    this.refresh();
  }

  private chooseAbility(index: number): void {
    const u = this.selected();
    if (!u || this.busy) return;
    const id = u.abilities[index];
    if (!id || u.acted || (u.cooldowns[id] ?? 0) > 0) return;
    this.abilityId = this.abilityId === id ? null : id;
    this.preview = null;
    audio.play('ui');
    this.updatePreview();
    this.refresh();
  }

  private readyUnits(): Entity[] {
    return this.state.entities.filter((e) => e.faction === 'vigil' && !e.acted);
  }

  private cycle(): void {
    const ready = this.readyUnits();
    const all = ready.length ? ready : this.state.entities.filter((e) => e.faction === 'vigil');
    if (!all.length) return;
    const i = all.findIndex((e) => e.id === this.selectedId);
    this.select(all[(i + 1) % all.length].id);
  }

  private cancel(): void {
    if (this.busy) return;
    if (this.abilityId) {
      this.abilityId = null;
      this.preview = null;
      audio.play('cancel');
    } else if (this.selectedId) {
      this.selectedId = null;
      audio.play('cancel');
    }
    this.confirmEnd = false;
    this.refresh();
  }

  // --- input ------------------------------------------------------------------------

  private tileFromEvent(e: MouseEvent): Vec | null {
    const r = this.els.canvas.getBoundingClientRect();
    const lx = ((e.clientX - r.left) / r.width) * VIEW_W;
    const ly = ((e.clientY - r.top) / r.height) * VIEW_H;
    return tileFromPoint(lx, ly);
  }

  private mouseMove(e: MouseEvent): void {
    const p = this.tileFromEvent(e);
    if ((p && this.hover && eq(p, this.hover)) || (!p && !this.hover)) return;
    this.setHover(p);
  }

  private setHover(p: Vec | null): void {
    this.hover = p;
    // focus an enemy whose telegraph covers or who stands on the hovered tile
    this.focusEnemy = null;
    if (p) {
      const occ = entityAt(this.state, p);
      if (occ?.intent) this.focusEnemy = occ.id;
      else if (!this.abilityId)
        for (const en of intentQueue(this.state)) if (useFootprint(this.state, en.intent!).tiles.some((t) => eq(t, p))) this.focusEnemy = en.id;
    }
    this.updatePreview();
    this.renderInspector();
    this.renderThreats();
  }

  private updatePreview(): void {
    this.preview = null;
    if (!this.hover || !this.abilityId || this.busy) return;
    const opt = this.optionAt(this.hover);
    if (!opt) return;
    const k = JSON.stringify(opt.use);
    const forecast = forecastUse(this.state, opt.use);
    const fp = useFootprint(this.state, opt.use);
    const tiles = [...fp.tiles, ...(fp.plan?.path ?? [])];
    this.preview = { key: k, forecast, threat: forecastReckoning(forecast.after), tiles, arrows: fp.arrows };
  }

  private click(e: MouseEvent): void {
    audio.ensure();
    const p = this.tileFromEvent(e);
    if (!p || this.busy || this.state.phase !== 'player') return;
    const occ = entityAt(this.state, p);
    const unit = this.selected();
    if (this.abilityId && unit) {
      const opt = this.optionAt(p);
      if (opt) return void this.act(opt.use);
      if (occ?.faction === 'vigil') return this.select(occ.id);
      return this.cancel();
    }
    if (occ?.faction === 'vigil') {
      if (occ.id === this.selectedId) return this.cancel();
      return this.select(occ.id);
    }
    if (unit && !unit.moved && !unit.acted && reachable(this.state, unit).has(key(p))) return void this.move(unit, p);
    if (unit) this.cancel();
  }

  private key(e: KeyboardEvent): void {
    if (document.querySelector('.overlay')) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') this.cancel();
    else if (k === '1' || k === 'q') this.chooseAbility(0);
    else if (k === '2' || k === 'w') this.chooseAbility(1);
    else if (k === 'tab') {
      e.preventDefault();
      this.cycle();
    } else if (k === 'z' || (e.ctrlKey && k === 'z')) this.undo();
    else if (k === ' ' || k === 'enter') {
      e.preventDefault();
      this.endTurn();
    } else if (k === 'h' || k === '?') showHelp();
    else if (k === 'm') this.toggleMute();
    else if (k === 't') {
      this.showIntents = !this.showIntents;
      this.refresh();
    } else if (k === 'f') {
      this.anim.speed = this.anim.speed === 1 ? 2.5 : 1;
      this.refresh();
    } else return;
  }

  // --- actions ------------------------------------------------------------------------

  private async move(unit: Entity, to: Vec): Promise<void> {
    const ev = this.session.move(unit.id, to);
    this.confirmEnd = false;
    await this.run(ev);
    const u = this.selected();
    if (u && !u.acted) this.abilityId = u.abilities.find((a) => (u.cooldowns[a] ?? 0) <= 0) ?? null;
    this.updatePreview();
    this.refresh();
  }

  private async act(use: AbilityUse): Promise<void> {
    const ev = this.session.act(use);
    this.abilityId = null;
    this.confirmEnd = false;
    await this.run(ev);
    const next = this.readyUnits()[0];
    if (this.state.phase === 'player') {
      const cur = this.selected();
      if (!cur || cur.acted) this.selectedId = next?.id ?? null;
    }
    this.refresh();
  }

  private undo(): void {
    if (this.busy || !this.session.undoableUnit) return;
    const id = this.session.undoableUnit;
    this.session.undoMove();
    this.anim.sync(this.state);
    this.selectedId = id;
    this.abilityId = null;
    this.preview = null;
    this.threat = forecastReckoning(this.state);
    audio.play('cancel');
    this.refresh();
  }

  private resetTurn(): void {
    if (this.busy || !this.session.canResetTurn) return;
    this.session.resetTurn();
    this.anim.sync(this.state);
    this.selectedId = null;
    this.abilityId = null;
    this.preview = null;
    this.threat = forecastReckoning(this.state);
    audio.play('rebuke');
    this.refresh();
  }

  private async endTurn(): Promise<void> {
    if (this.busy || this.state.phase !== 'player') return;
    const idle = this.readyUnits().length;
    if (idle && !this.confirmEnd) {
      this.confirmEnd = true;
      audio.play('ui');
      this.refresh();
      return;
    }
    this.confirmEnd = false;
    this.selectedId = null;
    this.abilityId = null;
    const ev = this.session.endTurn();
    await this.run(ev);
  }

  private toggleMute(): void {
    audio.setMuted(!audio.muted);
    try {
      const raw = localStorage.getItem('sanctumfall.progress.v1');
      const p = raw ? JSON.parse(raw) : { cleared: [] };
      p.muted = audio.muted;
      localStorage.setItem('sanctumfall.progress.v1', JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }

  private abandon(): void {
    const overlay = h(
      'div',
      { class: 'overlay' },
      h(
        'div',
        { class: 'frame gilded', style: { maxWidth: '440px' } },
        h('h2', {}, 'Abandon the field?'),
        h('p', { class: 'lead', style: { textAlign: 'left' } }, 'The battle will be lost and the land left to the Taint.'),
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => overlay.remove() }, 'Stay'), h('button', { class: 'btn primary', onclick: () => { overlay.remove(); this.cb.exit(); } }, 'Abandon')),
      ),
    );
    document.body.append(overlay);
  }

  // --- HUD -----------------------------------------------------------------------------

  refresh(): void {
    this.renderTop();
    this.renderSquad();
    this.renderAbilities();
    this.renderActions();
    this.renderObjectives();
    this.renderLitany();
    this.renderThreats();
    this.renderInspector();
    this.renderHint();
  }

  private renderTop(): void {
    const s = this.state;
    const enc = getEncounter(this.encounterId);
    this.els.round.textContent = `${enc.subtitle} · Round ${s.round}`;
    const chip = this.els.phase;
    chip.className = 'phase-chip';
    if (s.phase === 'victory') chip.textContent = 'Victory';
    else if (s.phase === 'defeat') chip.textContent = 'Defeat';
    else if (this.busy) {
      chip.textContent = 'The demons act';
      chip.classList.add('enemy');
    } else chip.textContent = 'Your Vigil';
    const n = taintCount(s);
    const next = s.pendingSpread.length;
    const t = this.els.taint;
    clear(t);
    const bar = h('div', { class: 'bar', title: 'Taint: corrupted tiles. Reaching the limit loses the battle.' });
    for (let i = 0; i < s.taintLimit; i++) bar.append(h('div', { class: `cell${i < n ? ' on' : i < n + next ? ' next' : ''}` }));
    t.append(h('span', { class: 'label' }, 'Taint'), bar, h('span', { class: 'num' }, `${n}/${s.taintLimit}`));
    t.classList.toggle('danger', n + next >= s.taintLimit - 2);
  }

  private renderSquad(): void {
    const box = this.els.squad;
    clear(box);
    for (const defId of ['penitent', 'consecrator', 'inquisitor']) {
      const def = getUnitDef(defId);
      const e = this.state.entities.find((x) => x.defId === defId);
      const threat = e ? this.threat?.entities.get(e.id) : null;
      const pips = h('div', { class: 'pips' });
      const lose = Math.min(e?.hp ?? 0, threat?.damage ?? 0);
      for (let i = 0; i < def.hp; i++) {
        const filled = !!e && i < e.hp;
        pips.append(h('div', { class: `pip${!filled ? ' empty' : i >= e!.hp - lose ? ' lose' : ''}` }));
      }
      const status = h('div', { class: 'status' });
      if (!e) status.append(h('span', { class: 'chip warn' }, 'Fallen'));
      else {
        status.append(h('span', { class: `chip${e.acted ? '' : ' ready'}` }, e.acted ? 'Spent' : e.moved ? 'Moved' : 'Ready'));
        if (e.shield) status.append(h('span', { class: 'chip ward' }, 'Warded'));
        if (threat?.dies) status.append(h('span', { class: 'chip warn' }, threat.drowns ? 'Will drown' : 'Will fall'));
        else if (threat?.damage) status.append(h('span', { class: 'chip warn' }, `Threat -${threat.damage}`));
        if (tileAt(this.state, e.pos)?.corrupted) status.append(h('span', { class: 'chip warn' }, 'On Taint'));
      }
      const card = h(
        'div',
        { class: `unit-card${!e ? ' dead' : ''}${e?.id === this.selectedId ? ' selected' : ''}${e?.acted ? ' spent' : ''}`, onclick: () => e && !this.busy && this.select(e.id) },
        h('div', { class: 'portrait' }, img(portrait(defId), '', def.name)),
        h('div', {}, h('div', { class: 'name' }, def.name), h('div', { class: 'role' }, def.title), pips, status),
      );
      box.append(card);
    }
  }

  private renderAbilities(): void {
    const box = this.els.abilities;
    clear(box);
    const u = this.selected();
    if (!u) {
      box.append(h('div', { class: 'empty-note' }, 'Select a member of the Vigil to see their rites.'));
      return;
    }
    u.abilities.forEach((id, i) => {
      const ab = getAbility(id);
      const cd = u.cooldowns[id] ?? 0;
      const disabled = u.acted || cd > 0 || this.busy;
      box.append(
        h(
          'button',
          { class: `ability${this.abilityId === id ? ' active' : ''}${disabled ? ' disabled' : ''}`, onclick: () => this.chooseAbility(i) },
          img(iconURL(ab.icon, 3)),
          h(
            'div',
            {},
            h('div', { class: 'an' }, h('span', {}, ab.name), cd > 0 ? h('span', { class: 'cd' }, `Ready in ${cd}`) : h('span', { class: 'key' }, String(i + 1))),
            h('div', { class: 'ad' }, ab.description),
          ),
        ),
      );
    });
  }

  private renderActions(): void {
    const box = this.els.actions;
    clear(box);
    const s = this.state;
    const idle = this.readyUnits().length;
    const inPlay = s.phase === 'player' && !this.busy;
    box.append(
      h('button', { class: 'btn', disabled: !inPlay || !this.session.undoableUnit, onclick: () => this.undo(), title: 'Take back the last move (Z)' }, 'Undo move'),
      h('button', { class: 'btn', disabled: !inPlay || !this.session.canResetTurn, onclick: () => this.resetTurn(), title: 'Rewind this whole turn. Once per battle.' }, `Reset turn (${this.session.resetsLeft})`),
      h(
        'button',
        { class: `btn primary end${this.confirmEnd ? ' armed' : ''}`, disabled: !inPlay, onclick: () => this.endTurn() },
        this.confirmEnd ? `${idle} not acted — confirm` : 'End turn',
        h('span', { class: 'key' }, 'Space'),
      ),
    );
  }

  private renderObjectives(): void {
    const box = this.els.objectives;
    clear(box);
    for (const o of allObjectives(this.state)) {
      box.append(
        h(
          'div',
          { class: `obj${o.done ? ' done' : ''}${o.failed ? ' failed' : ''}${o.def.bonus ? ' bonus' : ''}` },
          h('div', { class: 'box' }),
          h('div', {}, o.def.bonus ? h('span', { class: 'tag' }, 'Bonus ') : '', o.def.label),
          h('span', { class: 'prog' }, o.progress),
        ),
      );
    }
    box.append(h('div', { class: 'obj' }, h('div', { class: 'box', style: { borderColor: 'var(--taint)' } }), h('div', { style: { color: 'var(--bone-dim)' } }, `Keep the Taint below ${this.state.taintLimit} tiles`)));
  }

  private renderLitany(): void {
    const box = this.els.litany;
    const boss = this.state.entities.find((e) => hasTag(e, 'boss'));
    if (!boss) {
      box.style.display = 'none';
      return;
    }
    box.style.display = '';
    clear(box);
    const warded = isWarded(this.state, boss);
    box.append(h('h2', {}, `Litany of the ${boss.name}`));
    box.append(
      h(
        'p',
        { style: { margin: '0 0 8px', fontSize: '13px', color: warded ? '#9fd3c0' : '#ffb3a0' } },
        warded ? `Warded by its bells — immune to harm. HP ${boss.hp}/${boss.maxHp}` : `Unwarded! HP ${boss.hp}/${boss.maxHp}`,
      ),
    );
    const list = h('div', { class: 'litany' });
    upcomingLitany(boss).forEach((id, i) => {
      const ab = getAbility(id);
      list.append(
        h(
          'div',
          { class: `rite${i === 0 ? ' now' : ''}`, title: ab.description },
          img(iconURL(ab.icon, 3)),
          h('div', {}, h('div', { class: 'rw' }, i === 0 ? 'This Reckoning' : i === 1 ? 'Next round' : 'After'), h('div', { class: 'rn' }, ab.name)),
        ),
      );
    });
    box.append(list);
  }

  private describeEffect(f: Forecast | null): string {
    if (!f) return '';
    const parts: string[] = [];
    for (const [id, x] of f.entities) {
      const e = getEntity(this.state, id);
      if (!e || hasTag(e, 'pillar')) continue;
      if (x.dies) parts.push(`${e.name} ${x.drowns ? 'drowns' : 'falls'}`);
      else if (x.damage) parts.push(`${e.name} -${x.damage}`);
      else if (x.shieldLost) parts.push(`${e.name}'s ward breaks`);
      else if (x.warded) parts.push(`${e.name} is warded`);
      else if (!eq(x.from, x.to)) parts.push(`${e.name} is moved`);
    }
    return parts.join(', ');
  }

  private renderThreats(): void {
    const box = this.els.threats;
    clear(box);
    const s = this.state;
    const q = intentQueue(s);
    const vigilOnTaint = s.entities.filter((e) => e.faction === 'vigil' && tileAt(s, e.pos)?.corrupted);
    if (vigilOnTaint.length) box.append(h('div', { class: 'threat' }, h('span', { class: 'ord' }, '0'), img(iconURL('taint', 2)), h('div', {}, h('span', { class: 'who' }, 'Taint '), h('span', { class: 'dmg' }, vigilOnTaint.map((e) => `${e.name} -1`).join(', ')))));
    if (!q.length && !vigilOnTaint.length) box.append(h('div', { class: 'empty-note' }, 'No rites declared.'));
    for (const e of q) {
      const ab = getAbility(e.intent!.abilityId);
      const f = forecastIntent(s, e.id);
      const dir = e.intent!.dir;
      const effect = this.describeEffect(f);
      const row = h(
        'div',
        { class: `threat${this.focusEnemy === e.id ? ' focus' : ''}` },
        h('span', { class: `ord${e.intent!.rebuked ? ' rebuked' : ''}` }, String(e.intentOrder)),
        img(iconURL(ab.icon, 2)),
        h(
          'div',
          {},
          h('span', { class: 'who' }, `${e.name} `),
          h('span', { class: 'what' }, `${ab.name}${dir !== undefined && ab.targeting.kind !== 'self' ? ` (${DIR_NAMES[dir]})` : ''}${e.intent!.rebuked ? ' — turned' : ''}`),
          effect ? h('div', { class: 'dmg' }, effect) : h('div', { class: 'what' }, 'strikes empty ground'),
        ),
      );
      row.addEventListener('mouseenter', () => {
        this.focusEnemy = e.id;
      });
      row.addEventListener('mouseleave', () => {
        this.focusEnemy = null;
      });
      box.append(row);
    }
    if (s.pendingSpread.length) box.append(h('div', { class: 'threat' }, h('span', { class: 'ord' }, '+'), img(iconURL('taint', 2)), h('div', {}, h('span', { class: 'who' }, 'Taint spreads '), h('span', { class: 'what' }, `to ${s.pendingSpread.length} tile${s.pendingSpread.length > 1 ? 's' : ''}`))));
    if (s.spawnMarkers.length) box.append(h('div', { class: 'threat' }, h('span', { class: 'ord' }, '!'), img(iconURL('spawn', 2)), h('div', {}, h('span', { class: 'who' }, 'Next round '), h('span', { class: 'what' }, s.spawnMarkers.map((m) => getUnitDef(m.defId).name).join(', ') + ' emerge'))));
  }

  private renderInspector(): void {
    const box = this.els.inspector;
    clear(box);
    const s = this.state;
    const p = this.hover;
    if (!p) {
      box.append(h('div', { class: 'empty-note' }, 'Hover any tile, unit or demon to read it.'));
      return;
    }
    const e = entityAt(s, p);
    const t = tileAt(s, p)!;
    if (e) {
      const def = getUnitDef(e.defId);
      box.append(h('div', { class: 'iname' }, `${e.name}  `, h('span', { style: { fontSize: '13px', color: 'var(--bone-dim)' } }, `HP ${e.hp}/${e.maxHp}${e.shield ? ' · warded' : ''}`)), h('div', { class: 'ititle' }, def.title), h('p', {}, def.blurb));
      if (e.faction === 'demon' && !hasTag(e, 'structure')) {
        for (const id of e.abilities) {
          const ab = getAbility(id);
          box.append(h('div', { class: 'rule', html: `<b>${ab.name}.</b> ${ab.description}` }));
        }
        if (e.move) box.append(h('div', { class: 'rule', html: `<b>Moves ${e.move}.</b> Will not enter hallowed ground.` }));
      }
    }
    const notes: string[] = [];
    if (t.terrain === 'abyss') notes.push('<b>Abyss.</b> Anything knocked in is lost. Projectiles pass over.');
    else if (t.consecrated) notes.push('<b>Hallowed ground.</b> Demons will not enter; forced in, they burn for 1. Blocks Taint and spawns.');
    else if (t.corrupted) notes.push('<b>Taint.</b> Vigil here suffer 1 at the Reckoning. Demons here strike for +1. Demons emerge from Taint.');
    else notes.push('<b>Flagstones.</b> Open ground.');
    if (s.pendingSpread.some((x) => eq(x.at, p))) notes.push('<b>Taint creeps here</b> at the end of this round — unless it is hallowed first.');
    const m = s.spawnMarkers.find((x) => eq(x.at, p));
    if (m) notes.push(`<b>A ${getUnitDef(m.defId).name} will emerge here</b> next round. Stand on it to block (1 damage), or hallow it.`);
    for (const n of notes) box.append(h('div', { class: 'rule', html: n }));
  }

  private renderHint(): void {
    const el = this.els.hint;
    const s = this.state;
    const u = this.selected();
    let html = '';
    if (s.phase !== 'player') html = '';
    else if (this.busy) html = 'The rites resolve…';
    else if (this.confirmEnd) html = `<b>${this.readyUnits().length}</b> unit(s) have not acted. Press <b>End turn</b> again to begin the Reckoning.`;
    else if (!this.readyUnits().length) html = 'Every unit has acted. <b>End the turn</b> (Space) to begin the Reckoning.';
    else if (!u) html = 'Select a member of the Vigil — click them or press <b>Tab</b>. Red tiles show what the demons will strike.';
    else if (this.abilityId) html = `<b>${getAbility(this.abilityId).name}:</b> hover a highlighted tile to preview the outcome, click to commit. Right-click to cancel.`;
    else if (!u.moved && !u.acted) html = '<b>Blue tiles:</b> move. Or choose a rite (<b>1</b>, <b>2</b>) to act from here. Right-click to deselect.';
    else if (!u.acted) html = 'Choose a rite (<b>1</b>, <b>2</b>). <b>Z</b> undoes the move.';
    else html = 'This unit has acted. Select another, or end the turn.';
    el.innerHTML = html;
  }

  // --- result ---------------------------------------------------------------------------

  private showResult(): void {
    const s = this.state;
    const won = s.phase === 'victory';
    const enc = getEncounter(this.encounterId);
    const bonus = allObjectives(s).filter((o) => o.def.bonus);
    const overlay = h(
      'div',
      { class: 'overlay' },
      h(
        'div',
        { class: 'frame gilded' },
        h('h1', { class: won ? '' : 'defeat' }, won ? (enc.objectives.some((o) => o.kind === 'banishBoss') ? 'Banished' : 'Sealed') : 'Fallen'),
        h('p', { class: 'lead' }, s.outcome?.reason ?? ''),
        h(
          'div',
          { class: 'stats' },
          ...[
            ['Rounds', s.round],
            ['Demons slain', s.stats.demonsSlain],
            ['Tiles cleansed', s.stats.tilesCleansed],
            ['Vigil fallen', s.stats.vigilFallen.length],
          ].map(([k, v]) => h('div', { class: 'stat' }, h('div', { class: 'v' }, String(v)), h('div', { class: 'k' }, String(k)))),
        ),
        won && bonus.length ? h('div', {}, h('div', { class: 'section-title' }, 'Bonus rites'), ...bonus.map((o) => h('div', { class: `obj${o.done ? ' done' : ' failed'}` }, h('div', { class: 'box' }), h('div', {}, o.def.label), h('span', { class: 'prog' }, o.progress)))) : '',
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn', onclick: () => this.cb.exit() }, 'Return to the Reclamation'),
          h('button', { class: 'btn', onclick: () => this.cb.restart() }, won ? 'Fight again' : 'Try again'),
          won && this.cb.next ? h('button', { class: 'btn primary', onclick: () => this.cb.goNext() }, `Onward: ${getEncounter(this.cb.next).name}`) : '',
        ),
      ),
    );
    document.body.append(overlay);
  }
}
