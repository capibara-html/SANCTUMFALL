import { registerEncounter } from '../../core/registry';
import { BASE_LEGEND } from './legend';

registerEncounter({
  id: 'drowned_nave',
  name: 'The Drowned Nave',
  subtitle: 'II · Where the sea came into the cathedral',
  region: 'drowned',
  seed: 4401,
  // The western aisles have collapsed into the flooded crypt. The Leviathan
  // lies in that water; its two bells toll from the nave.
  map: [
    '~~..,.P,',
    '~~.,B,..',
    '~~.P..~.',
    'L~.D..P.',
    '~~.~.d..',
    '~~.P.,,.',
    '~~..,B,.',
    '~~.1.2.3',
  ],
  legend: BASE_LEGEND,
  taintLimit: 24,
  spawnPool: ['thrall', 'cantor', 'thrall', 'gorehound'],
  maxEnemies: 4,
  spawnFromRound: 2,
  spreadPerWound: 1,
  objectives: [
    { kind: 'banishBoss', label: 'Banish the Leviathan' },
    { kind: 'drownDemons', label: 'Let the tide drown 2 demons', count: 2, bonus: true },
    { kind: 'noLosses', label: 'Lose no one of the Vigil', bonus: true },
  ],
  briefing: [
    'The sea climbed the steps of the cathedral and did not leave.',
    'Something vast sings beneath the flooded crypt. Two drowned bells answer it.',
    'While the bells toll, the Leviathan cannot be harmed. Silence them. Then drive it back.',
  ],
});
