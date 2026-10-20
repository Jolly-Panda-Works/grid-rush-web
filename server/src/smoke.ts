// Connects a real Colyseus client in solo mode and plays until the game finishes:  npm run smoke (server must run)
import { Client } from 'colyseus.js';
import { allPlacements, GameState } from '../../shared/src';

(async () => {
  const client = new Client('ws://localhost:2567');
  const room = await client.create('grid_rush', { name: 'Smoke', level: 3, rating: 1100, solo: true });
  let seat = -1; let moves = 0; let last: GameState | null = null;
  room.onMessage('matched', (m) => { seat = m.seat; console.log('matched, seat', seat, m); });
  room.onMessage('lobby', (m) => console.log('lobby', m));
  room.onMessage('error', (m) => console.log('server error', m));
  room.onMessage('state', ({ state, turnLeft }: { state: GameState; turnLeft: number | null }) => {
    last = state;
    if (state.phase === 'finished') {
      console.log('FINISHED', state.result?.reason, 'winner', state.result?.winner, 'bot tier', state.players.find(p => p.isBot)?.botTier, 'moves', moves);
      room.leave(); setTimeout(() => process.exit(0), 200); return;
    }
    if (state.current !== seat || turnLeft === null) return;
    moves++;
    if (state.phase === 'placing_reward') {
      const i = state.players[seat].board.indexOf(0); room.send('reward', { r: Math.floor(i / 9), c: i % 9 }); return;
    }
    const me = state.players[seat];
    for (let o = 0; o < 3; o++) {
      const t = state.offer[o];
      if (t.coinCost <= me.coins) {
        const pl = allPlacements(me.board, t.cells);
        if (pl.length && Math.random() < 0.7) { room.send('buy', { offer: o, cells: pl[0] }); return; }
      }
    }
    room.send('advance');
  });
  setTimeout(() => { console.log('TIMEOUT', last?.phase); process.exit(1); }, 90000);
})().catch((e) => { console.error('smoke failed', e); process.exit(1); });
