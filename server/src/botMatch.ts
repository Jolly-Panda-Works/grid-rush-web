// Headless engine/bot sanity test:  npm run test:bots
import { applyAction, chooseAction, createGame, scoreOf, TRACK_LENGTH } from '../../shared/src';

const tiers = [1, 2, 3, 4, 5];
const wins: Record<string, number> = {};
let totalTurns = 0, games = 0, lens: Record<string, number> = {};
const N = 30;
const t0 = Date.now();
for (const a of tiers) for (const b of tiers) {
  if (a >= b) continue;
  for (let i = 0; i < N; i++) {
    const g = createGame([
      { name: 'A', isBot: true, level: 1, rating: 1000, botTier: a },
      { name: 'B', isBot: true, level: 1, rating: 1000, botTier: b },
    ]);
    let guard = 0;
    while (g.phase !== 'finished' && guard++ < 500) {
      const seat = g.current;
      const act = chooseAction(g, seat, g.players[seat].botTier);
      const err = applyAction(g, seat, act);
      if (err) throw new Error(`illegal bot action ${JSON.stringify(act)}: ${err}`);
    }
    if (g.phase !== 'finished') throw new Error('game did not finish');
    const w = g.result!.winner;
    const k = `tier${w === 0 ? a : b}`;
    wins[k] = (wins[k] || 0) + 1;
    const key = g.result!.reason; lens[key] = (lens[key] || 0) + 1;
    totalTurns += g.turnNo; games++;
    void scoreOf; void TRACK_LENGTH;
  }
}
console.log('games', games, 'avg turns', (totalTurns / games).toFixed(1), 'ms', Date.now() - t0);
console.log('wins by tier', wins);
console.log('end reasons', lens);
