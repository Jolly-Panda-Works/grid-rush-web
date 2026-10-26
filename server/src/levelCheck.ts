// Story level check (npm run test:levels): every level must be winnable, and the pass rate of a greedy player
// with growing noise gives a first idea of the difficulty curve.
import { LEVELS, solveLevel } from '../../shared/src';

const RUNS = Number(process.env.RUNS ?? 20);
let bad = 0;
for (const lv of LEVELS) {
  const best = solveLevel(lv);
  const rates = [15, 40, 90].map((noise) => {
    let won = 0;
    for (let i = 0; i < RUNS; i++) if (solveLevel(lv, {}, noise).won) won++;
    return Math.round((100 * won) / RUNS);
  });
  if (!best.won) bad++;
  console.log(`${String(lv.id).padStart(2)} ${lv.hard ? (lv.hard === 2 ? 'VH' : 'H ') : '  '} best: ${best.won ? 'won ' + best.stars + '*' : 'LOST'} score ${String(best.score).padStart(3)} in ${best.actions.length} moves | noise 15/40/90: ${rates.join('% / ')}%`);
}
if (bad) { console.error(`${bad} level(s) the greedy player cannot win`); process.exitCode = 1; }
