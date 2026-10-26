// Finds, per level, the shortest time track at which the greedy player reaches the target pass rate
// (or, failing that, the shortest one it can win at all). --write puts the result into shared/src/story/levels.ts.
import fs from 'fs';
import path from 'path';
import { LEVELS, solveLevel } from '../../shared/src';

const RUNS = Number(process.env.RUNS ?? 8);
const args = process.argv.slice(2);
const write = args.includes('--write');
const only = args.find((a) => /^\d/.test(a))?.split(',').map(Number) ?? null;
const found = new Map<number, number>();
for (const lv of LEVELS) {
  if (only && !only.includes(lv.id)) continue;
  const target = lv.hard === 2 ? 0.2 : lv.hard ? 0.35 : lv.id <= 10 ? 0.75 : 0.6;
  let first = 0, firstRate = 0, line = '';
  for (let track = 24; track <= 64; track += 2) {
    const l = { ...lv, trackLength: track };
    const best = solveLevel(l);
    if (!best.won) continue;
    let won = 0;
    for (let i = 0; i < RUNS; i++) if (solveLevel(l, {}, 15).won) won++;
    if (!first) { first = track; firstRate = won / RUNS; }
    if (won / RUNS >= target) { found.set(lv.id, track); line = `track ${track} (rate ${Math.round((100 * won) / RUNS)}%, best ${best.score}, moves ${best.actions.length})`; break; }
  }
  if (!line && first) { found.set(lv.id, first + 4); line = `only winnable: track ${first + 4} (rate at ${first}: ${Math.round(100 * firstRate)}%)`; }
  console.log(`${lv.id}: was ${lv.trackLength} -> ${line || 'NOT FOUND'}`);
}
if (write) {
  const file = path.resolve(__dirname, '../../shared/src/story/levels.ts');
  let src = fs.readFileSync(file, 'utf8');
  // people misplace more than the greedy player does: some slack on top, most in the tutorial
  const slack = (id: number) => (id <= 10 ? 6 : LEVELS[id - 1].hard ? 2 : 4);
  for (const [id, track] of found) src = src.replace(new RegExp(`(level\\(${id}, \\{[^]*?track: )\\d+`), `$1${track + slack(id)}`);
  fs.writeFileSync(file, src);
  console.log(`wrote ${found.size} track lengths`);
}
