// The SANCTUMFALL palette: warm blacks, browns, stone, bone, aged gold and
// dark red, plus a corruption violet and the teal of the drowned lands.
// Sprite maps use these single-character keys.
export const PAL: Record<string, string> = {
  K: '#0d090b', // outline
  k: '#1a1317',
  d: '#2a1f24',
  b: '#433029',
  B: '#62483a',
  n: '#8c6c50',
  N: '#b48f68',
  g: '#38363d',
  G: '#5a575c',
  s: '#878079',
  S: '#aaa196',
  w: '#cbbfa4',
  W: '#eee4cb',
  o: '#6e4f22',
  O: '#a97c35',
  y: '#dcb65e',
  Y: '#f5e3a0',
  r: '#4a1217',
  R: '#842028',
  e: '#c4402c',
  E: '#f28a45',
  p: '#26142c',
  P: '#561f45',
  v: '#9c2f58',
  V: '#d8547d',
  t: '#173230',
  T: '#285a54',
  q: '#4f9787',
  Q: '#9fd3c0',
  c: '#5f6f78',
  C: '#9fb1b6',
  f: '#fff8ea',
  i: '#202a3a', // cold shadow
  I: '#3c4c66', // cold steel blue
};

/** Colours used by the board UI layer (telegraphs, highlights). */
export const UI = {
  move: '#7fb6c2',
  moveDim: '#3e6872',
  target: '#e8c86a',
  targetDim: '#7a6230',
  threat: '#e2473a',
  threatDim: '#6e1a1c',
  taint: '#b0386a',
  hallow: '#f0d27a',
  bone: '#eee4cb',
  ink: '#0d090b',
  shield: '#9fd3e8',
  heal: '#8fdc8a',
};

export interface RegionStyle {
  stoneDark: string;
  stone: string;
  stoneLight: string;
  mortar: string;
  moss: string;
  abyssTop: string;
  abyssDeep: string;
  abyssGlint: string;
  fog: string;
  ambient: string;
  void: string;
}

export const REGIONS: Record<'ash' | 'drowned', RegionStyle> = {
  ash: {
    stoneDark: '#2d2826',
    stone: '#4a423d',
    stoneLight: '#6a5f55',
    mortar: '#1a1513',
    moss: '#4b4630',
    abyssTop: '#120c0c',
    abyssDeep: '#060404',
    abyssGlint: '#5a1d14',
    fog: '#b9ab98',
    ambient: '#140d0d',
    void: '#0a0708',
  },
  drowned: {
    stoneDark: '#212a2b',
    stone: '#36423f',
    stoneLight: '#52615a',
    mortar: '#101716',
    moss: '#2e4a3c',
    abyssTop: '#0a1a1c',
    abyssDeep: '#040b0d',
    abyssGlint: '#3f8a7c',
    fog: '#9fc2b8',
    ambient: '#081011',
    void: '#05090a',
  },
};
