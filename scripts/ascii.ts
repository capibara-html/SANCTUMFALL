// Developer tool: print an encounter as ASCII and play "end turn" N times to
// sanity-check pacing. Usage: npx tsx scripts/ascii.ts ashen_parish 6
import '../src/content';
import { BattleSession, entityAt, taintCount, intentQueue, getAbility, tileAt } from '../src/core';
import type { GameState } from '../src/core';

const GLYPH: Record<string, string> = {
  penitent: '1', consecrator: '2', inquisitor: '3', hollow: 'h', gorehound: 'g', cantor: 'c', chanter: 'x',
  thrall: 'd', wound: 'W', bell: 'B', shrine: 'S', pillar: 'P', gravestone: 't', leviathan: 'L',
};

export function draw(s: GameState): string {
  const lines: string[] = [];
  for (let y = 0; y < s.height; y++) {
    let row = '';
    for (let x = 0; x < s.width; x++) {
      const p = { x, y };
      const e = entityAt(s, p);
      const t = tileAt(s, p)!;
      const ground = t.terrain === 'abyss' ? '~' : t.terrain === 'wall' ? '#' : t.consecrated ? '+' : t.corrupted ? ',' : '.';
      const marker = s.spawnMarkers.some((m) => m.at.x === x && m.at.y === y) ? '!' : s.pendingSpread.some((m) => m.at.x === x && m.at.y === y) ? '*' : ' ';
      row += (e ? GLYPH[e.defId] ?? '?' : ground) + marker;
    }
    lines.push(row);
  }
  lines.push(`round ${s.round} taint ${taintCount(s)}/${s.taintLimit} phase ${s.phase}`);
  for (const e of intentQueue(s)) lines.push(`  ${e.intentOrder}. ${e.name}@${e.pos.x},${e.pos.y} -> ${getAbility(e.intent!.abilityId).name} dir=${e.intent!.dir ?? '-'} dist=${e.intent!.dist ?? '-'} off=${JSON.stringify(e.intent!.offset ?? null)}`);
  for (const e of s.entities.filter((e) => e.faction === 'vigil' || e.defId === 'shrine' || e.defId === 'leviathan')) lines.push(`  ${e.name} hp ${e.hp}/${e.maxHp}`);
  return lines.join('\n');
}

const id = process.argv[2] ?? 'ashen_parish';
const n = Number(process.argv[3] ?? 6);
const session = new BattleSession(id);
console.log(draw(session.state));
for (let i = 0; i < n && session.state.phase === 'player'; i++) {
  const ev = session.endTurn();
  console.log(ev.filter((e) => e.t === 'death' || e.t === 'outcome').map((e) => JSON.stringify(e)).join('\n'));
  console.log(draw(session.state));
}
