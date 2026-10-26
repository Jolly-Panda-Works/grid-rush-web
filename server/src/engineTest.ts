// Fast rules test (npm test). Checks the confirmed rules from 02_Core_Rules.md and that bots always play legal moves.
import assert from 'node:assert/strict';
import {
  BOARD_SIZE, COIN_SCORE_DIVISOR, EMPTY_CELL_PENALTY, REWARD_POSITIONS, SPECIAL_7X7_BONUS, STARTING_COINS, TRACK_LENGTH, TREASURE_POSITIONS,
  GameState, TileDef, applyAction, applyAdvance, applyBuy, applyReward, botTierFor, chooseAction, cellIdx, createGame, emptyCount,
  eloDelta, finishGame, levelFromXp, legalActions, scoreOf, transformCells, orientations, cellsKey,
  LEVELS, RELIC_UID, STONE, STORY, applySoloAction, createSoloGame, daysLeft, goalsDone, replaySolo, solveLevel, starsOf, trackLen,
} from '../../shared/src';
import type { LevelDef } from '../../shared/src';

let n = 0;
const test = (name: string, fn: () => void) => { fn(); n++; console.log('  ok  ' + name); };
function seeded(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const fresh = (): GameState => {
  const s = createGame([{ name: 'A', isBot: false, level: 1, rating: 1000 }, { name: 'B', isBot: false, level: 1, rating: 1000 }], seeded(7));
  s.current = 0;
  return s;
};
const domino = (time: number, coin: number, engraved = 0): TileDef => ({ uid: 9001, shape: 'domino', cells: [[0, 0], [0, 1]], timeCost: time, coinCost: coin, engraved });
const buy = (s: GameState, t: TileDef, cells: [number, number][] = [[8, 7], [8, 8]]) => { s.offer[0] = t; return applyBuy(s, s.current, 0, cells, seeded(1)); };

console.log('rules');
test('start parameters', () => {
  const s = fresh();
  assert.equal(s.players[0].coins, STARTING_COINS); assert.equal(s.players[1].pos, 0);
  assert.equal(s.offer.length, 3); assert.ok(s.next, 'next tile is visible');
  assert.equal(s.players[0].board.length, BOARD_SIZE * BOARD_SIZE);
});
test('every generated tile has at least one cost', () => {
  for (let i = 0; i < 200; i++) { const s = createGame([{ name: 'A', isBot: false, level: 1, rating: 1000 }, { name: 'B', isBot: false, level: 1, rating: 1000 }], seeded(i)); for (const t of [...s.offer, s.next]) assert.ok(t.timeCost + t.coinCost > 0); }
});
test('Advance moves to opponent+1 and pays 1 coin per cell, then passes the turn', () => {
  const s = fresh(); s.players[0].pos = 12; s.players[1].pos = 14; // (no treasure / reward cell between 13 and 15)
  assert.equal(applyAdvance(s, 0), null);
  assert.equal(s.players[0].pos, 15); assert.equal(s.players[0].coins, STARTING_COINS + 3); assert.equal(s.current, 1);
});
test('Advance from the same cell moves exactly one cell ahead', () => {
  const s = fresh(); assert.equal(applyAdvance(s, 0), null); assert.equal(s.players[0].pos, 1); assert.equal(s.current, 1);
});
test('landing on the opponent cell keeps the turn; only strictly passing ends it', () => {
  const s = fresh(); s.players[0].pos = 7; s.players[1].pos = 8;
  assert.equal(buy(s, domino(1, 1)), null); assert.equal(s.players[0].pos, 8); assert.equal(s.current, 0, 'tie keeps the turn');
  assert.equal(buy(s, domino(1, 1), [[7, 7], [7, 8]]), null); assert.equal(s.players[0].pos, 9); assert.equal(s.current, 1, 'passing ends the turn');
});
test('buy: tile is placed BEFORE the move, so treasure pays its own engraved coins', () => {
  const s = fresh(); s.players[0].pos = TREASURE_POSITIONS[0] - 2; s.players[1].pos = 40; s.players[0].coins = 10;
  assert.equal(buy(s, domino(2, 1, 2)), null);
  assert.equal(s.players[0].coins, 10 - 1 + 2);
});
test('Advance across a treasure cell pays the engraved coins as well', () => {
  const s = fresh(); s.players[0].pos = 3; s.players[1].pos = 4; s.players[0].tiles.push({ uid: 5, shape: 'domino', engraved: 3, cells: [[0, 0], [0, 1]] });
  assert.equal(applyAdvance(s, 0), null); // 3 -> 5 (treasure at 5)
  assert.equal(s.players[0].pos, 5); assert.equal(s.players[0].coins, STARTING_COINS + 2 + 3);
});
test('1x1 reward cell: first player takes it and must place it', () => {
  const s = fresh(); s.players[0].pos = REWARD_POSITIONS[0] - 1; s.players[1].pos = 40;
  assert.equal(buy(s, domino(1, 1)), null);
  assert.equal(s.phase, 'placing_reward'); assert.equal(s.pendingRewards, 1); assert.equal(s.rewardTaken[0], true);
  assert.notEqual(applyAdvance(s, 0), null, 'no other action while a reward is pending');
  assert.equal(applyReward(s, 0, 0, 0), null); assert.equal(s.phase, 'playing');
  const s2 = fresh(); s2.players[1].pos = REWARD_POSITIONS[0] - 1; s2.current = 1; s2.rewardTaken[0] = true;
  assert.equal(buy(s2, domino(1, 1)), null); assert.equal(s2.pendingRewards, 0, 'already taken cells give nothing');
});
test('invalid purchases are rejected', () => {
  const s = fresh(); s.players[0].coins = 0;
  assert.notEqual(buy(s, domino(1, 1)), null, 'not enough coins');
  s.players[0].coins = 5; s.players[0].board[cellIdx(8, 7)] = 5;
  assert.notEqual(buy(s, domino(1, 1)), null, 'occupied cell');
  assert.notEqual(buy(s, domino(1, 1), [[8, 7], [7, 8]]), null, 'wrong shape');
  assert.notEqual(buy(s, domino(1, 1), [[0, 8], [0, 9]]), null, 'outside the board');
  const t = fresh(); t.current = 1; t.offer[0] = domino(1, 1); assert.notEqual(applyBuy(t, 0, 0, [[8, 7], [8, 8]]), null, 'not your turn');
});
test('rotate/flip give all distinct orientations (L tile = 8)', () => {
  assert.equal(orientations([[0, 0], [1, 0], [2, 0], [2, 1]]).length, 8);
  assert.equal(orientations([[0, 0], [0, 1], [1, 0], [1, 1]]).length, 1);
  const h = transformCells([[0, 0], [1, 0], [1, 1]], 1, true); assert.equal(h.length, 3); assert.ok(cellsKey(h).length > 0);
});
test('7x7 bonus: only the first player gets it, once', () => {
  const s = fresh(); s.players[0].pos = 0; s.players[1].pos = 30;
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) s.players[0].board[cellIdx(r, c)] = 1;
  s.players[0].board[cellIdx(0, 0)] = 0; s.players[0].board[cellIdx(0, 1)] = 0;
  assert.equal(buy(s, domino(1, 1), [[0, 0], [0, 1]]), null);
  assert.equal(s.players[0].bonus7, true); assert.equal(s.bonus7By, 0);
  s.current = 1; s.players[1].pos = 30; s.players[0].pos = 40;
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) s.players[1].board[cellIdx(r, c)] = 1;
  s.players[1].board[cellIdx(0, 0)] = 0; s.players[1].board[cellIdx(0, 1)] = 0;
  assert.equal(buy(s, domino(1, 1), [[0, 0], [0, 1]]), null);
  assert.equal(s.players[1].bonus7, false, 'second player gets nothing');
});
test('game ends at the end of the track; score = coins / 2 (rounded down) + bonus - 2 x empty cells', () => {
  const s = fresh(); s.players[0].pos = TRACK_LENGTH - 1; s.players[1].pos = TRACK_LENGTH;
  s.players[1].pos = 20; s.players[0].coins = 20;
  assert.equal(buy(s, domino(3, 1)), null);
  assert.equal(s.phase, 'finished'); assert.equal(s.result!.reason, 'track_end'); assert.equal(s.players[0].pos, TRACK_LENGTH, 'clamped');
  const sc = scoreOf(s, 0);
  assert.equal(sc.coinPoints, Math.floor(sc.coins / COIN_SCORE_DIVISOR));
  assert.equal(sc.total, sc.coinPoints + sc.bonus - EMPTY_CELL_PENALTY * emptyCount(s.players[0]));
  assert.equal(sc.emptyCells, BOARD_SIZE * BOARD_SIZE - 2);
});
test('leftover coins count half, rounded down (7 coins -> 3 points)', () => {
  const s = fresh();
  s.players[0].coins = 7; s.players[1].coins = 8;
  assert.equal(scoreOf(s, 0).coinPoints, 3);
  assert.equal(scoreOf(s, 1).coinPoints, 4);
  assert.equal(scoreOf(s, 0).total, 3 - EMPTY_CELL_PENALTY * BOARD_SIZE * BOARD_SIZE);
});
test('a full board ends the game', () => {
  const s = fresh(); s.players[1].pos = 30;
  for (let i = 0; i < 81; i++) s.players[0].board[i] = 1; s.players[0].board[cellIdx(8, 7)] = 0; s.players[0].board[cellIdx(8, 8)] = 0;
  assert.equal(buy(s, domino(1, 1)), null); assert.equal(s.phase, 'finished'); assert.equal(s.result!.reason, 'board_full');
});
test('tie-break: the player who ended the game wins', () => {
  const s = fresh(); s.players[0].coins = 10; s.players[1].coins = 10; s.endTriggeredBy = 1;
  finishGame(s, 'track_end'); assert.equal(s.result!.tieBreak, true); assert.equal(s.result!.winner, 1);
});
test('progression helpers', () => {
  assert.equal(levelFromXp(0), 1); assert.equal(levelFromXp(100), 2); assert.ok(eloDelta(1000, 1000, true) > 0 && eloDelta(1000, 1000, false) < 0);
  assert.ok(botTierFor(1, 800) <= botTierFor(30, 1600)); assert.ok(botTierFor(1, 100) >= 1 && botTierFor(99, 4000) <= 5);
});

console.log('bots');
test('bots (tiers 1-3) always play legal moves and finish games', () => {
  for (let g = 0; g < 9; g++) {
    const tiers = [1 + (g % 3), 1 + ((g + 1) % 3)];
    const s = createGame([{ name: 'A', isBot: true, level: 1, rating: 1000, botTier: tiers[0] }, { name: 'B', isBot: true, level: 1, rating: 1000, botTier: tiers[1] }], seeded(100 + g));
    let guard = 0;
    while (s.phase !== 'finished' && guard++ < 600) {
      const seat = s.current; const a = chooseAction(s, seat, s.players[seat].botTier, seeded(guard));
      assert.equal(applyAction(s, seat, a), null, 'bot move rejected: ' + JSON.stringify(a));
    }
    assert.equal(s.phase, 'finished');
  }
});
test('there is always at least one legal action (Advance)', () => {
  const s = fresh(); assert.ok(legalActions(s, 0).some((a) => a.t === 'advance'));
});
console.log('story levels');
const lvl = (over: Partial<LevelDef>): LevelDef => ({
  id: 20, seed: 5, days: 30, startingShards: 5, paydays: [], giftDays: [], goals: [{ type: 'fill_count', n: 4 }], stars: [10, 20], ...over,
});
test('work takes 1-5 days of the deadline and pays a shard a day; the turn never changes hands', () => {
  const s = createSoloGame(lvl({ paydays: [4] }));
  const shards = s.players[0].coins;
  assert.notEqual(applySoloAction(s, { t: 'advance' }), null, 'no opponent to pass');
  assert.notEqual(applySoloAction(s, { t: 'work', days: 6 }), null);
  assert.equal(applySoloAction(s, { t: 'work', days: 3 }), null);
  assert.equal(s.players[0].pos, 3); assert.equal(s.players[0].coins, shards + 3); assert.equal(s.current, 0);
  assert.equal(daysLeft(s), 27);
  assert.equal(applySoloAction(s, { t: 'work', days: 2 }), null);
  assert.ok(s.events.some((e) => e.k === 'treasure'), 'passing day 4 is a payday');
});
test('when no offer fits anywhere, the oldest offers are replaced', () => {
  const s = createSoloGame(lvl({ cells: { stone: Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9] as [number, number]).filter(([r, c]) => !(r === 4 && c < 2)) } }));
  assert.ok(s.offer.some((t) => t.cells.length <= 2), 'a tile that fits the 2-cell gap came in');
  const one = createSoloGame(lvl({ cells: { stone: Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9] as [number, number]).filter(([r, c]) => !(r === 4 && c === 4)) } }));
  assert.ok(one.offer.some((t) => t.cells.length === 1 && t.coinCost === 0), 'a single empty cell: a free 1x1 comes in');
  assert.equal(applySoloAction(one, { t: 'buy', offer: one.offer.findIndex((t) => t.cells.length === 1), cells: [[4, 4]] }), null);
  assert.equal(one.phase, 'finished', 'the board is full: the level ends');
});
test('stones take no tile and are neither empty nor filled; prefilled cells are old tiles', () => {
  const s = createSoloGame(lvl({ cells: { stone: [[0, 0]], filled: [[8, 8], [8, 7], [0, 8]] } }));
  const me = s.players[0];
  assert.equal(me.board[0], STONE); assert.equal(emptyCount(me), 81 - 4);
  assert.equal(me.tiles.length, 2, 'two groups of prefilled cells'); assert.ok(me.tiles.every((t) => t.uid >= RELIC_UID));
  s.offer[0] = { uid: 500, shape: 'domino', cells: [[0, 0], [0, 1]], timeCost: 1, coinCost: 0, engraved: 0 };
  assert.notEqual(applySoloAction(s, { t: 'buy', offer: 0, cells: [[0, 0], [0, 1]] }), null);
});
test('gold pays one coin, once (not again after the chisel)', () => {
  const s = createSoloGame(lvl({ cells: { gold: [[4, 4]] } }), { tools: { chisel: 1 } });
  s.offer[0] = { uid: 500, shape: 'domino', cells: [[0, 0], [0, 1]], timeCost: 1, coinCost: 0, engraved: 0 };
  const coins = s.players[0].coins;
  assert.equal(applySoloAction(s, { t: 'buy', offer: 0, cells: [[4, 4], [4, 5]] }), null);
  assert.equal(s.players[0].coins, coins + 1);
  assert.equal(applySoloAction(s, { t: 'chisel', uid: 500 }), null);
  assert.equal(s.players[0].board[cellIdx(4, 4)], 0, 'the chisel freed the cells');
  assert.notEqual(applySoloAction(s, { t: 'chisel', uid: 500 }), null, 'no chisel left');
});
test('goals done -> finish wins and turns the days left into coins; the deadline without goals loses', () => {
  const s = createSoloGame(lvl({}));
  assert.notEqual(applySoloAction(s, { t: 'finish' }), null);
  s.offer[0] = { uid: 500, shape: 'o4', cells: [[0, 0], [0, 1], [1, 0], [1, 1]], timeCost: 2, coinCost: 0, engraved: 0 };
  assert.equal(applySoloAction(s, { t: 'buy', offer: 0, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }), null);
  assert.ok(goalsDone(s));
  assert.equal(applySoloAction(s, { t: 'finish' }), null);
  assert.equal(s.solo!.outcome, 'won'); assert.equal(s.solo!.early, 30 - 2); assert.ok(starsOf(s) >= 1);
  const l = createSoloGame(lvl({ days: 6 }));
  while (!l.solo!.outcome) assert.equal(applySoloAction(l, { t: 'work', days: 5 }), null);
  assert.equal(l.solo!.outcome, 'lost'); assert.equal(starsOf(l), 0);
  assert.equal(applySoloAction(l, { t: 'continue' }), null, 'a continue reopens the level');
  assert.equal(trackLen(l), 6 + STORY.CONTINUE_DAYS); assert.equal(l.phase, 'playing');
});
test('a level replays to the same result (the server check)', () => {
  const lv = LEVELS[0];
  const r = solveLevel(lv);
  const again = replaySolo(lv, {}, r.actions);
  assert.equal(again.error, null); assert.equal(again.state.solo!.outcome, 'won');
});
test('every story level can be won by the greedy player', () => {
  for (const lv of LEVELS) assert.ok(solveLevel(lv).won, `level ${lv.id}`);
});
void SPECIAL_7X7_BONUS;
console.log(`\n${n} tests passed`);
