// Global rule constants. Content-specific numbers live with the content; these
// are the rules of the world every encounter shares.
export const RULES = {
  /** damage taken by a unit pushed into an obstacle, edge or another unit */
  bumpDamage: 1,
  /** damage a demon takes when forced onto hallowed ground */
  hallowBurn: 1,
  /** damage to Vigil units standing on Taint at the end of a round */
  taintDamage: 1,
  /** extra damage dealt by demons attacking while standing on Taint */
  taintEmpower: 1,
  /** damage to a unit standing on a spawn site when the demon tries to emerge */
  spawnBlockDamage: 1,
  /** radius of corruption cleansed when a wound is sealed */
  sealRadius: 1,
  /** damage dealt to a boss when one of its warding bells is sealed */
  bellSealDamage: 2,
} as const;
