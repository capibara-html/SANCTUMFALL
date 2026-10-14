// Built-in death hooks: what the world does when certain things are destroyed.
import { RULES } from './rules';
import { hasTag } from './grid';
import { cleanseTile, consecrateTile, dealDamage, desecrateTile, registerDeathHook, tilesWithin, unhallowTile } from './effects';
import { dropWoundAnnouncements } from './corruption';

/** A wound closes: the Taint around it recedes and its site is hallowed. */
registerDeathHook('seal', (s, e, ev) => {
  s.stats.woundsSealed++;
  dropWoundAnnouncements(s, e.id);
  ev.push({ t: 'sealed', id: e.id, at: { ...e.pos } });
  for (const p of tilesWithin(s, e.pos, RULES.sealRadius)) cleanseTile(s, p, 'seal', ev);
  consecrateTile(s, e.pos, 'seal', ev);
});

/** A drowned bell falls silent: as a wound, plus the boss it wards is hurt. */
registerDeathHook('sealBell', (s, e, ev) => {
  s.stats.woundsSealed++;
  dropWoundAnnouncements(s, e.id);
  ev.push({ t: 'sealed', id: e.id, at: { ...e.pos } });
  for (const p of tilesWithin(s, e.pos, RULES.sealRadius)) cleanseTile(s, p, 'seal', ev);
  consecrateTile(s, e.pos, 'seal', ev);
  for (const boss of s.entities.filter((o) => hasTag(o, 'boss'))) dealDamage(s, boss, RULES.bellSealDamage, 'bellSeal', ev);
});

/** A shrine falls: the ground it hallowed loses its grace; its site is defiled. */
registerDeathHook('desecrate', (s, e, ev) => {
  ev.push({ t: 'desecrated', id: e.id, at: { ...e.pos } });
  for (const p of tilesWithin(s, e.pos, 1)) unhallowTile(s, p, 'desecrate', ev);
  desecrateTile(s, e.pos, 'desecrate', ev);
});
