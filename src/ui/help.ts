import { h, img } from './dom';
import { iconURL } from '../render/icons';

const section = (ic: string, title: string, html: string) =>
  h('section', {}, h('h3', {}, img(iconURL(ic, 2)), title), h('p', { html }));

export function showHelp(onClose?: () => void): void {
  const close = () => {
    overlay.remove();
    window.removeEventListener('keydown', onKey, true);
    onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'h' || e.key === 'H' || e.key === '?') {
      e.stopPropagation();
      e.preventDefault();
      close();
    }
  };
  const overlay = h(
    'div',
    { class: 'overlay', onclick: (e: Event) => e.target === overlay && close() },
    h(
      'div',
      { class: 'frame gilded' },
      h('h2', {}, 'The Rite of the Vigil'),
      h(
        'div',
        { class: 'help-grid' },
        section('hourglass', 'A round', '<b>Demons declare first.</b> Red hatched tiles show what each will strike, numbered in the order they act. Then <b>your Vigil</b> moves and acts. Then comes <b>the Reckoning</b>: the Taint burns, declared attacks resolve in order, the Taint spreads.'),
        section('move', 'Your units', 'Each unit may <b>move</b> (blue tiles) and then <b>act once</b>. Acting ends its turn. Hover a target to see exactly what will happen; click to commit. A move can be undone until you act.'),
        section('charge', 'Displacement', 'Attacks keep their <b>direction</b>. Push a demon and its strike moves with it — often onto empty ground or another demon. Kill a demon and its attack never happens.'),
        section('skull', 'Collisions', 'Anything knocked into a wall, the board edge, a pillar or another unit takes <b>1 damage</b> — and so does what it hits. Anything knocked into the <b>abyss</b> is lost.'),
        section('taint', 'The Taint', 'Violet tiles. Vigil standing on Taint at the Reckoning <b>suffer 1</b>. Demons on Taint <b>strike for +1</b>. Demons emerge only from Taint. If the Taint reaches its limit, the land is lost.'),
        section('sigil', 'Hallowed ground', 'Gold sigils. Demons <b>will not step</b> on hallowed ground; forced onto it they <b>burn for 1</b>. It cannot be tainted and nothing spawns on it.'),
        section('spawn', 'Wounds', 'Wounds spread Taint (hatched violet tiles) and mark spawn sites (swirling sigils). <b>Stand on a site</b> to block it (1 damage) or hallow it. Sealing a wound cleanses the land around it.'),
        section('bell', 'Entities', 'Great entities follow a visible <b>litany</b> of rites. Read it, prepare, and turn their own power against their servants.'),
      ),
      h(
        'p',
        { style: { marginTop: '14px', fontSize: '14px', color: 'var(--bone-dim)' }, html: 'Controls: <kbd>Click</kbd> select / move / commit · <kbd>Right-click</kbd> or <kbd>Esc</kbd> cancel · <kbd>1</kbd> <kbd>2</kbd> abilities · <kbd>Tab</kbd> next unit · <kbd>Z</kbd> undo move · <kbd>Space</kbd> end turn · <kbd>T</kbd> hide telegraphs · <kbd>F</kbd> fast animations · <kbd>M</kbd> sound · <kbd>H</kbd> this help' },
      ),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: close }, 'Understood')),
    ),
  );
  window.addEventListener('keydown', onKey, true);
  document.body.append(overlay);
}
