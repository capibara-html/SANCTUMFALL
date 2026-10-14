import { registerEncounter } from '../../core/registry';
import { BASE_LEGEND } from './legend';

registerEncounter({
  id: 'ashen_parish',
  name: 'The Ashen Parish',
  subtitle: 'I · The churchyard of Saint Ilse',
  region: 'ash',
  seed: 1187,
  // north is up. The Vigil enters from the south road.
  map: [
    ',,..t..,',
    ',W,h..W,',
    '.,.P..,.',
    '.c.+..g.',
    't..+S+.t',
    '..~.+...',
    '.P~...P.',
    '..1.2.3.',
  ],
  legend: BASE_LEGEND,
  taintLimit: 26,
  spawnPool: ['hollow', 'chanter', 'hollow', 'gorehound', 'cantor'],
  maxEnemies: 5,
  spawnFromRound: 1,
  spreadPerWound: 1,
  objectives: [
    { kind: 'sealWounds', label: 'Seal both Taint Wounds' },
    { kind: 'protect', label: 'Keep the Wayside Shrine standing', target: 'shrine', bonus: true },
    { kind: 'noLosses', label: 'Lose no one of the Vigil', bonus: true },
  ],
  briefing: [
    'Saint Ilse rang her bell for three nights, then fell silent.',
    'Two wounds have opened in the churchyard. The dead walk out of them.',
    'Seal both wounds before the Taint swallows the parish.',
  ],
});
