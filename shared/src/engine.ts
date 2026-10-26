import {
  ADVANCE_COIN_RATE, BOARD_SIZE, COIN_SCORE_DIVISOR, EMPTY_CELL_PENALTY, OFFER_SIZE, REWARD_ENGRAVED, REWARD_POSITIONS,
  SPECIAL_7X7_BONUS, SPECIAL_AREA, STARTING_COINS, STARTING_POSITION, TRACK_LENGTH, TREASURE_POSITIONS,
} from './constants';
import { MONO_SHAPE, makeTile } from './tiles';
import type {
  Action, Cell, EndReason, GameEventBody, GameState, PlayerInit, PlayerState, Rng, ScoreBreakdown, Seat,
} from './types';

export const other = (s: Seat): Seat => (s === 0 ? 1 : 0);
/** The track of this game (story levels have their own). */
export const trackLen = (s: GameState) => s.track?.length ?? TRACK_LENGTH;
export const treasuresOf = (s: GameState) => s.track?.treasures ?? TREASURE_POSITIONS;
export const rewardsOf = (s: GameState) => s.track?.rewards ?? REWARD_POSITIONS;
export const cellIdx = (r: number, c: number) => r * BOARD_SIZE + c;

/* ---------- geometry ---------- */
export function normalize(cells: Cell[]): Cell[] {
  const minR = Math.min(...cells.map((c) => c[0]));
  const minC = Math.min(...cells.map((c) => c[1]));
  return cells
    .map(([r, c]) => [r - minR, c - minC] as Cell)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
export const cellsKey = (cells: Cell[]) => normalize(cells).map((c) => c.join(',')).join(';');

export function transformCells(cells: Cell[], rot: number, flip: boolean): Cell[] {
  let cur = cells.map((c) => [...c] as Cell);
  if (flip) cur = cur.map(([r, c]) => [r, -c] as Cell);
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) cur = cur.map(([r, c]) => [c, -r] as Cell);
  return normalize(cur);
}

const orientCache = new Map<string, Cell[][]>();
export function orientations(cells: Cell[]): Cell[][] {
  const base = cellsKey(cells);
  const hit = orientCache.get(base);
  if (hit) return hit;
  const seen = new Set<string>();
  const out: Cell[][] = [];
  for (const flip of [false, true]) {
    for (let rot = 0; rot < 4; rot++) {
      const o = transformCells(cells, rot, flip);
      const k = cellsKey(o);
      if (!seen.has(k)) { seen.add(k); out.push(o); }
    }
  }
  orientCache.set(base, out);
  return out;
}

export function allPlacements(board: number[], shape: Cell[]): Cell[][] {
  const res: Cell[][] = [];
  for (const o of orientations(shape)) {
    const h = Math.max(...o.map((c) => c[0])) + 1;
    const w = Math.max(...o.map((c) => c[1])) + 1;
    for (let r0 = 0; r0 <= BOARD_SIZE - h; r0++) {
      for (let c0 = 0; c0 <= BOARD_SIZE - w; c0++) {
        if (o.every(([r, c]) => board[cellIdx(r0 + r, c0 + c)] === 0)) res.push(o.map(([r, c]) => [r0 + r, c0 + c] as Cell));
      }
    }
  }
  return res;
}
export function canPlaceAny(board: number[], shape: Cell[]): boolean {
  for (const o of orientations(shape)) {
    const h = Math.max(...o.map((c) => c[0])) + 1;
    const w = Math.max(...o.map((c) => c[1])) + 1;
    for (let r0 = 0; r0 <= BOARD_SIZE - h; r0++)
      for (let c0 = 0; c0 <= BOARD_SIZE - w; c0++)
        if (o.every(([r, c]) => board[cellIdx(r0 + r, c0 + c)] === 0)) return true;
  }
  return false;
}
export function cellsFree(board: number[], abs: Cell[]): boolean {
  return abs.every(([r, c]) => r >= 0 && c >= 0 && r < BOARD_SIZE && c < BOARD_SIZE && board[cellIdx(r, c)] === 0);
}

/* ---------- helpers ---------- */
export const emptyCount = (p: PlayerState) => p.board.reduce((n, v) => n + (v === 0 ? 1 : 0), 0);
export const engravedTotal = (p: PlayerState) => p.tiles.reduce((n, t) => n + t.engraved, 0);
export const boardFull = (p: PlayerState) => emptyCount(p) === 0;

export function scoreOf(s: GameState, seat: Seat): ScoreBreakdown {
  const p = s.players[seat];
  const empty = emptyCount(p);
  const bonus = p.bonus7 ? SPECIAL_7X7_BONUS : 0;
  const penalty = empty * EMPTY_CELL_PENALTY;
  const coinPoints = Math.floor(p.coins / COIN_SCORE_DIVISOR); // score = coins / 2 (rounded down) + 7x7 bonus - 2 x empty cells
  return { coins: p.coins, coinPoints, bonus, emptyCells: empty, penalty, total: coinPoints + bonus - penalty };
}

export function ev(s: GameState, e: GameEventBody) {
  s.events.push({ ...e, id: s.eventSeq++ } as GameState['events'][number]);
  if (s.events.length > 40) s.events.shift();
}

/* ---------- game creation ---------- */
export function createGame(inits: [PlayerInit, PlayerInit], rng: Rng = Math.random): GameState {
  const mk = (i: Seat): PlayerState => ({
    seat: i, name: inits[i].name, isBot: inits[i].isBot, botTier: inits[i].botTier ?? 0,
    level: inits[i].level, rating: inits[i].rating, coins: STARTING_COINS, pos: STARTING_POSITION,
    board: new Array(BOARD_SIZE * BOARD_SIZE).fill(0), tiles: [], bonus7: false, connected: true,
  });
  const s: GameState = {
    phase: 'playing', current: rng() < 0.5 ? 0 : 1, players: [mk(0), mk(1)], offer: [], next: undefined as never,
    rewardTaken: REWARD_POSITIONS.map(() => false), bonus7By: null, endTriggeredBy: null,
    pendingRewards: 0, nextUid: 1, eventSeq: 1, events: [], turnNo: 1, result: null,
  };
  for (let i = 0; i < OFFER_SIZE; i++) s.offer.push(makeTile(s.nextUid++, rng));
  s.next = makeTile(s.nextUid++, rng);
  return s;
}

/* ---------- movement / track events ---------- */
function moveTo(s: GameState, seat: Seat, steps: number): number {
  const p = s.players[seat];
  const from = p.pos;
  const to = Math.min(trackLen(s), from + steps);
  p.pos = to;
  if (to > from) ev(s, { k: 'move', seat, from, to });
  for (let i = from + 1; i <= to; i++) {
    if (treasuresOf(s).includes(i)) {
      const coins = engravedTotal(p);
      p.coins += coins;
      ev(s, { k: 'treasure', seat, pos: i, coins });
    }
    const ri = rewardsOf(s).indexOf(i);
    if (ri >= 0 && !s.rewardTaken[ri]) {
      s.rewardTaken[ri] = true;
      s.pendingRewards++;
      ev(s, { k: 'reward', seat, pos: i });
    }
  }
  if (to >= trackLen(s) && s.endTriggeredBy === null) s.endTriggeredBy = seat;
  return to - from;
}

export function check7x7(s: GameState, seat: Seat) {
  if (s.bonus7By !== null) return;
  const p = s.players[seat];
  const span = BOARD_SIZE - SPECIAL_AREA;
  for (let r0 = 0; r0 <= span; r0++) {
    for (let c0 = 0; c0 <= span; c0++) {
      let ok = true;
      for (let r = 0; r < SPECIAL_AREA && ok; r++)
        for (let c = 0; c < SPECIAL_AREA; c++)
          if (p.board[cellIdx(r0 + r, c0 + c)] <= 0) { ok = false; break; } // a stone (story levels) is not a tile
      if (ok) { s.bonus7By = seat; p.bonus7 = true; ev(s, { k: 'bonus7', seat }); return; }
    }
  }
}

export function finishGame(s: GameState, reason: EndReason, loser?: Seat) {
  const scores: [ScoreBreakdown, ScoreBreakdown] = [scoreOf(s, 0), scoreOf(s, 1)];
  let winner: Seat;
  let tieBreak = false;
  if (reason === 'forfeit' || reason === 'timeout') winner = other(loser as Seat);
  else if (scores[0].total !== scores[1].total) winner = scores[0].total > scores[1].total ? 0 : 1;
  else { winner = s.endTriggeredBy ?? 0; tieBreak = true; } // CONFIRMED tie-break
  s.phase = 'finished';
  s.result = { winner, reason, endedBy: s.endTriggeredBy, tieBreak, scores };
  ev(s, { k: 'end', reason });
}

/** After an action fully resolved: pending 1x1 placement -> game end -> turn hand-over. */
function resolve(s: GameState, seat: Seat) {
  const me = s.players[seat];
  if (boardFull(me) && s.endTriggeredBy === null) s.endTriggeredBy = seat;
  if (boardFull(me)) s.pendingRewards = 0; // nowhere to put them
  if (s.pendingRewards > 0) { s.phase = 'placing_reward'; s.current = seat; return; }
  if (s.endTriggeredBy !== null) {
    finishGame(s, boardFull(s.players[s.endTriggeredBy]) ? 'board_full' : 'track_end');
    return;
  }
  s.phase = 'playing';
  // CONFIRMED: only strictly passing the opponent hands over the turn.
  const next: Seat = me.pos > s.players[other(seat)].pos ? other(seat) : seat;
  if (next !== seat) { s.turnNo++; ev(s, { k: 'turn', seat: next }); }
  s.current = next;
}

/* ---------- actions ---------- */
export function applyAdvance(s: GameState, seat: Seat): string | null {
  if (s.phase !== 'playing') return 'Not in action phase';
  if (s.current !== seat) return 'Not your turn';
  const me = s.players[seat];
  // RULE v0.4: Advance = move to exactly one cell ahead of the opponent (target = opponent position + 1).
  // On the mover's turn me.pos <= opp.pos always holds, so steps >= 1 and the mover always passes the opponent.
  const steps = Math.max(1, s.players[other(seat)].pos + 1 - me.pos);
  const moved = moveTo(s, seat, steps);
  const coins = moved * ADVANCE_COIN_RATE; // coins for cells actually moved (clamped at track end)
  me.coins += coins;
  ev(s, { k: 'advance', seat, steps: moved, coins });
  resolve(s, seat);
  return null;
}

export function applyBuy(s: GameState, seat: Seat, offerIdx: number, abs: Cell[], rng: Rng = Math.random): string | null {
  if (s.phase !== 'playing') return 'Not in action phase';
  if (s.current !== seat) return 'Not your turn';
  const tile = s.offer[offerIdx];
  if (!tile) return 'Unknown tile';
  const me = s.players[seat];
  if (me.coins < tile.coinCost) return 'Not enough coins';
  if (abs.length !== tile.cells.length) return 'Bad placement';
  if (!orientations(tile.cells).some((o) => cellsKey(o) === cellsKey(abs))) return 'Bad shape';
  if (!cellsFree(me.board, abs)) return 'Cells are not free';

  me.coins -= tile.coinCost;
  for (const [r, c] of abs) me.board[cellIdx(r, c)] = tile.uid;
  me.tiles.push({ uid: tile.uid, shape: tile.shape, engraved: tile.engraved, cells: abs.map((c) => [...c] as Cell) });
  s.offer[offerIdx] = s.next;           // the previewed tile slides in
  s.next = makeTile(s.nextUid++, rng);  // and a new one is drawn as the next preview
  ev(s, { k: 'buy', seat, shape: tile.shape, timeCost: tile.timeCost, coinCost: tile.coinCost });
  check7x7(s, seat);
  moveTo(s, seat, tile.timeCost); // placement happens BEFORE the move (CONFIRMED)
  resolve(s, seat);
  return null;
}

export function applyReward(s: GameState, seat: Seat, r: number, c: number): string | null {
  if (s.phase !== 'placing_reward') return 'No reward tile to place';
  if (s.current !== seat) return 'Not your turn';
  const me = s.players[seat];
  if (!Number.isInteger(r) || !Number.isInteger(c) || !cellsFree(me.board, [[r, c]])) return 'Cell is not free';
  const uid = s.nextUid++;
  me.board[cellIdx(r, c)] = uid;
  me.tiles.push({ uid, shape: MONO_SHAPE, engraved: REWARD_ENGRAVED, cells: [[r, c]] });
  s.pendingRewards--;
  ev(s, { k: 'place1x1', seat });
  check7x7(s, seat);
  resolve(s, seat);
  return null;
}

export function applyAction(s: GameState, seat: Seat, a: Action, rng: Rng = Math.random): string | null {
  if (s.phase === 'finished') return 'Game is over';
  switch (a.t) {
    case 'advance': return applyAdvance(s, seat);
    case 'buy': return applyBuy(s, seat, a.offer, a.cells, rng);
    case 'reward': return applyReward(s, seat, a.r, a.c);
  }
}

export function forfeit(s: GameState, loser: Seat, reason: 'forfeit' | 'timeout' = 'forfeit') {
  if (s.phase === 'finished') return;
  finishGame(s, reason, loser);
}

export function cloneForSim(s: GameState): GameState {
  return JSON.parse(JSON.stringify({ ...s, events: [], result: null }));
}
