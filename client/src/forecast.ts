import { GameState, Seat, engravedTotal, rewardsOf, trackLen, treasuresOf } from '../../shared/src';
import { useStore } from './store';

/** What one action would do on the time track. Mirrors the engine rules (display only, nothing is applied). */
export interface Forecast {
  seat: Seat;
  kind: 'buy' | 'advance';
  from: number; to: number;
  treasures: number[];   // treasure cells crossed
  treasureCoins: number; // coins those treasures pay
  rewards: number[];     // free 1x1 reward cells crossed
  advanceCoins: number;  // coins from Advance (0 for a buy)
  passes: boolean;       // moves strictly past the opponent: the turn goes to them
  ends: boolean;         // reaches the finish: ends the game
}

/** RULE v0.4: Advance jumps to exactly (opponent position + 1), clamped at the finish. */
export function advanceSteps(g: GameState, seat: Seat): number {
  const me = g.players[seat], opp = g.players[1 - seat];
  return Math.min(trackLen(g) - me.pos, Math.max(1, opp.pos + 1 - me.pos));
}

export function forecast(g: GameState, seat: Seat, kind: 'buy' | 'advance', steps: number, extraEngraved = 0): Forecast {
  const me = g.players[seat], opp = g.players[1 - seat];
  const from = me.pos, to = Math.min(trackLen(g), from + steps);
  const crossed = (p: number) => p > from && p <= to;
  const treasures = treasuresOf(g).filter(crossed);
  const rewards = rewardsOf(g).filter((p, i) => crossed(p) && !g.rewardTaken[i]);
  return {
    seat, kind, from, to, treasures, rewards,
    treasureCoins: treasures.length * (engravedTotal(me) + extraEngraved), // a bought tile is placed BEFORE the move
    advanceCoins: kind === 'advance' ? to - from : 0,
    passes: to > opp.pos, ends: to >= trackLen(g),
  };
}

/** The forecast for what the player is currently looking at (the selected tile, or the Advance button),
 *  or, on the opponent's turn, for the move the bot has just announced. */
export function useForecast(): Forecast | null {
  const g = useStore((s) => s.game);
  const mySeat = useStore((s) => s.mySeat);
  const offer = useStore((s) => s.sel.offer);
  const adv = useStore((s) => s.advPreview);
  const intent = useStore((s) => s.oppIntent);
  if (!g || g.phase !== 'playing') return null;
  if (intent && g.current === intent.seat && intent.seat !== mySeat) {
    const a = intent.action;
    if (a.t === 'advance') return forecast(g, intent.seat, 'advance', advanceSteps(g, intent.seat));
    if (a.t === 'buy' && g.offer[a.offer]) return forecast(g, intent.seat, 'buy', g.offer[a.offer].timeCost, g.offer[a.offer].engraved);
    return null;
  }
  if (g.current !== mySeat) return null;
  if (offer !== null && g.offer[offer]) {
    const t = g.offer[offer];
    return forecast(g, mySeat, 'buy', t.timeCost, t.engraved);
  }
  if (adv) return forecast(g, mySeat, 'advance', advanceSteps(g, mySeat));
  return null;
}
