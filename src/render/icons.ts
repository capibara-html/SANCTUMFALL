// 9x9 pixel icons used on the board and in the HUD.
import { fromMap, outlined, toDataURL, type Canvas } from './pixel';

const MAPS: Record<string, string[]> = {
  flail: ['......oo.', '.....o..o', '....o...o', '...o..yOy', '..o...OEO', '.o....yOy', 'N........', 'NN.......', '.NN......'],
  charge: ['.........', '...E.....', '...EE....', 'wwwEEE...', 'WWWEEEE..', 'wwwEEE...', '...EE....', '...E.....', '.........'],
  sigil: ['..OOOOO..', '.O..y..O.', 'O..yyy..O', 'O...y...O', 'O.yYYYy.O', 'O...y...O', 'O...y...O', '.O..y..O.', '..OOOOO..'],
  ward: ['.QQQQQQQ.', 'Q.QQQQQ.Q', 'QQQfQQQQQ', 'QQffQQQQQ', '.QQQQQQQ.', '.QQQQQQQ.', '..QQQQQ..', '...QQQ...', '....Q....'],
  chain: ['.......CC', '......C.C', '.....CCC.', '....C....', '...CCC...', '..C.C....', '.CCC.....', 'C........', 'CC.......'],
  rebuke: ['...yyy...', '..y...y..', '.y.....y.', '.y...yyyy', '.y....yy.', '.y.....y.', '..y......', '...yyy...', '.........'],
  claw: ['w.w.w....', 'w.w.w....', 'w.w.w....', '.w.w.w...', '.w.w.w...', '..w.w.w..', '...w.w.w.', '....w.w.w', '.....w.w.'],
  horn: ['W.......W', 'W.......W', '.W.....W.', '.W.....W.', '..WRRRW..', '..RRRRR..', '..ReRRR..', '...RRR...', '....R....'],
  bile: ['....V....', '...VvV...', '...vVv...', '..PvVvP..', '.PvvvvvP.', '.PvVvvvP.', '..PvvvP..', '...PPP...', '.........'],
  rite: ['E...E...E', 'y...y...y', 'O...O...O', '.........', '..PPPPP..', '.PvVVVvP.', '.PvVVVvP.', '..PPPPP..', '.........'],
  grasp: ['..q.q.q..', '..q.q.q..', '..q.q.q..', '.qqqqqqq.', '.qqqqqqq.', 'qqqqqqq..', '.qqqqqq..', '..qqqq...', '...qq....'],
  wave: ['.........', '..qqq....', '.q...q...', 'q..Q..q.q', 'T.QQQ..qT', 'TTQQQTTTT', 'TTTTTTTTT', 'tTtTtTtTt', '.........'],
  maw: ['WkWkWkWkW', '.W.W.W.W.', '.........', 'rrrrrrrrr', 'rRRRRRRRr', '.........', '.W.W.W.W.', 'WkWkWkWkW', '.........'],
  stir: ['....q....', '...qQq...', '..q...q..', '.q..T..q.', 'q..TQT..q', '.q..T..q.', '..q...q..', '...qQq...', '....q....'],
  skull: ['..WWWWW..', '.WWWWWWW.', 'WWkkWkkWW', 'WWkkWkkWW', 'WWWWkWWWW', '.WWWWWWW.', '..WkWkW..', '..WWWWW..', '.........'],
  heart: ['.........', '.ee...ee.', 'eEEe.eEEe', 'eEEEeEEEe', 'eEEEEEEEe', '.eEEEEEe.', '..eEEEe..', '...eEe...', '....e....'],
  move: ['...QQ....', '...QQQ...', 'QQQQQQQ..', 'QQQQQQQQ.', 'QQQQQQQ..', '...QQQ...', '...QQ....', '.........', '.........'],
  taint: ['....V....', '...vVv...', '..vPVPv..', '.vPpVpPv.', 'vPpkVkpPv', '.vPpVpPv.', '..vPVPv..', '...vVv...', '....V....'],
  spawn: ['V...V...V', '.v..v..v.', '..vPPPv..', '..PkkkP..', 'VvPkVkPvV', '..PkkkP..', '..vPPPv..', '.v..v..v.', 'V...V...V'],
  drown: ['..WWWWW..', '.WWkWkWW.', '.WWWWWWW.', '..WkWkW..', 'q..q..q..', '.q.Qq.Qq.', 'qQq.QqQ.q', 'TTTTTTTTT', 'ttttttttt'],
  shield: ['QQQQQQQQQ', 'QffQQQQQQ', 'QfQQQQQQQ', 'QQQQQQQQQ', '.QQQQQQQ.', '.QQQQQQQ.', '..QQQQQ..', '...QQQ...', '....Q....'],
  bell: ['....o....', '...OOO...', '..OyOOO..', '..OyOOO..', '.OyOOOOO.', '.OyOOOOO.', 'OOOOOOOOO', '....O....', '.........'],
  hourglass: ['OOOOOOO..', '.wwwww...', '..www....', '...w.....', '..wyw....', '.wyyyw...', 'OOOOOOO..', '.........', '.........'],
};

const cache = new Map<string, Canvas>();
const urls = new Map<string, string>();

export function icon(id: string): Canvas {
  let c = cache.get(id);
  if (!c) {
    const map = MAPS[id] ?? MAPS.skull;
    cache.set(id, (c = outlined(fromMap(map))));
  }
  return c;
}

export function iconURL(id: string, scale = 3): string {
  const k = `${id}@${scale}`;
  let u = urls.get(k);
  if (!u) urls.set(k, (u = toDataURL(icon(id), scale)));
  return u;
}
