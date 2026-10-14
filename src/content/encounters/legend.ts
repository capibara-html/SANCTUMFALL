import type { LegendEntry } from '../../core/types';

/** Shared map alphabet so encounters read like small drawings. */
export const BASE_LEGEND: Record<string, LegendEntry> = {
  '.': {},
  ',': { corrupted: true },
  '+': { consecrated: true },
  '~': { terrain: 'abyss' },
  '#': { terrain: 'wall' },
  P: { entity: 'pillar' },
  t: { entity: 'gravestone' },
  S: { entity: 'shrine' },
  W: { entity: 'wound', corrupted: true },
  B: { entity: 'bell', corrupted: true },
  '1': { entity: 'penitent' },
  '2': { entity: 'consecrator' },
  '3': { entity: 'inquisitor' },
  h: { entity: 'hollow', corrupted: true },
  H: { entity: 'hollow' },
  g: { entity: 'gorehound' },
  c: { entity: 'cantor', corrupted: true },
  x: { entity: 'chanter', corrupted: true },
  d: { entity: 'thrall' },
  D: { entity: 'thrall', corrupted: true },
  L: { entity: 'leviathan', terrain: 'abyss' },
};
