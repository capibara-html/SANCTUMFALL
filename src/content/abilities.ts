// Ability data. Numbers here are the balance knobs; behaviour comes from the
// generic effect interpreter in core/abilities.ts.
import { registerAbility } from '../core/registry';
import type { AbilityDef } from '../core/types';

export const ABILITIES: AbilityDef[] = [
  // --- The Penitent: damage and forced movement --------------------------------
  {
    id: 'censer_flail',
    name: 'Censer Flail',
    description: 'Strike an adjacent tile for 2 damage and knock the target back 1 tile.',
    targeting: { kind: 'melee' },
    effects: [{ op: 'damage', amount: 2 }, { op: 'push', dir: 'forward' }],
    icon: 'flail',
    animation: 'melee',
  },
  {
    id: 'zealous_charge',
    name: 'Zealous Charge',
    description: 'Dash in a straight line until something stops you. Deal 1 damage to it and knock it back. Recharges every other round.',
    targeting: { kind: 'charge' },
    effects: [{ op: 'damage', amount: 1 }, { op: 'push', dir: 'forward' }],
    cooldown: 2,
    icon: 'charge',
    animation: 'charge',
  },
  // --- The Consecrator: purification, protection, ground control ---------------
  {
    id: 'hallow',
    name: 'Hallow',
    description: 'Consecrate a tile within 3: cleanse its Taint and make it hallowed ground. A demon there burns for 1; a wound or bell suffers 2.',
    targeting: { kind: 'tile', minRange: 1, maxRange: 3, requires: 'any' },
    effects: [
      { op: 'damage', amount: 1, only: 'demon' },
      { op: 'damage', amount: 2, only: 'wound' },
      { op: 'consecrate' },
    ],
    icon: 'sigil',
    animation: 'hallow',
  },
  {
    id: 'sanctuary',
    name: 'Sanctuary',
    description: 'Ward yourself, an ally or a shrine within 3. The ward absorbs the next instance of damage. Recharges every other round.',
    targeting: { kind: 'tile', minRange: 0, maxRange: 3, requires: 'ally' },
    effects: [{ op: 'shield' }],
    cooldown: 2,
    icon: 'ward',
    animation: 'ward',
  },
  // --- The Inquisitor: interruption and threat manipulation --------------------
  {
    id: 'chain_of_judgment',
    name: 'Chain of Judgment',
    description: 'Hurl a chain in a straight line. The first thing it strikes takes 1 damage and is dragged 1 tile toward you.',
    targeting: { kind: 'projectile' },
    effects: [{ op: 'damage', amount: 1 }, { op: 'push', dir: 'back' }],
    icon: 'chain',
    animation: 'chain',
  },
  {
    id: 'rebuke',
    name: 'Rebuke',
    description: "Turn a demon's declared attack back the way it came. Rites with no direction are silenced. Range 3. Recharges every other round.",
    targeting: { kind: 'tile', minRange: 1, maxRange: 3, requires: 'enemyWithIntent' },
    effects: [{ op: 'rebuke' }],
    cooldown: 2,
    icon: 'rebuke',
    animation: 'rebuke',
  },
  // --- Demons --------------------------------------------------------------------
  {
    id: 'rend',
    name: 'Rend',
    description: 'Claws an adjacent tile for 1 damage.',
    targeting: { kind: 'melee' },
    effects: [{ op: 'damage', amount: 1 }],
    icon: 'claw',
    animation: 'melee',
  },
  {
    id: 'gore_rush',
    name: 'Gore Rush',
    description: 'Charges in a straight line and gores whatever stops it for 2 damage, knocking it back.',
    targeting: { kind: 'charge' },
    effects: [{ op: 'damage', amount: 2 }, { op: 'push', dir: 'forward' }],
    icon: 'horn',
    animation: 'charge',
  },
  {
    id: 'bile_hymn',
    name: 'Bile Hymn',
    description: 'Lobs bile 2–3 tiles away, arcing over obstacles: 1 damage and Taint at the centre; the four tiles around it are blasted 1 tile outward.',
    targeting: { kind: 'artillery', minRange: 2, maxRange: 3 },
    effects: [{ op: 'damage', amount: 1 }, { op: 'corrupt' }, { op: 'push', dir: 'outward', area: 'adjacent' }],
    icon: 'bile',
    animation: 'artillery',
  },
  {
    id: 'profane_rite',
    name: 'Profane Rite',
    description: 'Defiles the ground around itself with Taint and deals 1 damage to every human beside it. Cannot be turned, only silenced.',
    targeting: { kind: 'self' },
    effects: [{ op: 'damage', amount: 1, area: 'adjacent', only: 'human' }, { op: 'corrupt', area: 'plus' }],
    icon: 'rite',
    animation: 'chant',
  },
  {
    id: 'drowning_shove',
    name: 'Drowning Shove',
    description: 'Strikes an adjacent tile for 1 damage and shoves the target 1 tile away — into the deep, if it can.',
    targeting: { kind: 'melee' },
    effects: [{ op: 'damage', amount: 1 }, { op: 'push', dir: 'forward' }],
    icon: 'grasp',
    animation: 'melee',
  },
];

for (const a of ABILITIES) registerAbility(a);
