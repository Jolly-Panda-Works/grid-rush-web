// Story levels (docs/story-mode.md, docs/days-and-shards.md): one board and a deadline in days. The PvP rules in
// engine.ts are used unchanged (a tile costs shards and days, a payday pays the tiles' wages, a gift day gives a 1x1);
// there is no opponent, so the turn never changes hands, and "work" takes the number of days the player picks.
// This file adds the level's special cells, goals, tools and the win / lose / continue flow around them.
// (In the code a shard is still a "coin", a day a track cell, a payday a treasure and a gift day a reward cell.)
import { BOARD_SIZE, COIN_SCORE_DIVISOR, SPECIAL_7X7_BONUS } from '../constants';
import {
  applyAction, applyAdvance, canPlaceAny, cellIdx, cellsFree, check7x7, createGame, emptyCount, ev, finishGame, trackLen,
} from '../engine';
import { MONO_SHAPE, makeTile } from '../tiles';
import type { Action, Cell, GameState, Rng } from '../types';

/** A cell that is out of the game: no tile goes on it, and it is neither empty nor filled. */
export const STONE = -2;
/** Uids of the designer's prefilled tiles; player tiles count up from 1 and never get here. */
export const RELIC_UID = 100000;
export const RELIC_SHAPE = 'relic';
/** The unused second seat stays this far ahead, so the turn never passes to it. */
const NOBODY_POS = 1_000_000;

export type ToolId = 'chisel' | 'wheel' | 'brush';
export const TOOL_IDS: ToolId[] = ['chisel', 'wheel', 'brush'];
/** The level each tool is introduced at (with one free sample); before that it is not shown. */
export const TOOL_INTRO: Record<ToolId, number> = { chisel: 11, wheel: 12, brush: 13 };
export type ToolCounts = Partial<Record<ToolId, number>>;

export type Goal =
  | { type: 'fill_board' }
  | { type: 'fill_count'; n: number }
  | { type: 'fill_region' }
  | { type: 'cover_cracks' }
  | { type: 'bonus7' }
  | { type: 'max_empty'; max: number }
  | { type: 'min_score'; n: number }
  | { type: 'min_shards'; n: number };

export interface LevelDef {
  id: number;
  /** fixes the tile offers, so a level plays the same every time and the server can replay it */
  seed: number;
  /** the deadline */
  days: number;
  startingShards: number;
  paydays: number[];
  giftDays: number[];
  cells?: { filled?: Cell[]; crack?: Cell[]; stone?: Cell[]; gold?: Cell[] };
  region?: string[];
  regionOrigin?: Cell;
  goals: Goal[];
  /** score for the 2nd and the 3rd star (the 1st star is the goals) */
  stars: [number, number];
  /** 1 = hard, 2 = very hard: a red frame on the map and more coins */
  hard?: 1 | 2;
  /** what the coach teaches in this level (StoryUI LevelCoach) */
  teach?: string;
  /** free tools for this level only (the first sample of a new tool) */
  freeTools?: ToolCounts;
}

export interface SoloState {
  level: number;
  /** seeded generator state: every random draw of the level comes from here */
  rng: number;
  goals: Goal[];
  stars: [number, number];
  crack: number[];
  gold: number[];
  region: number[];
  goldTaken: number[];
  /** tools the player can still use in this attempt (own ones + the level's free samples) */
  tools: ToolCounts;
  used: ToolCounts;
  coinBag: boolean;
  continues: number;
  outcome: 'won' | 'lost' | null;
  /** days left when the player ended the level early (they turn into coins) */
  early: number;
}

export type SoloAction =
  | Action
  | { t: 'work'; days: number }
  | { t: 'chisel'; uid: number }
  | { t: 'wheel' }
  | { t: 'brush'; r: number; c: number }
  | { t: 'finish' }
  | { t: 'continue' };

export interface SoloOptions { name?: string; tools?: ToolCounts; coinBag?: boolean }

export const STORY = {
  TUTORIAL_LEVELS: 10,
  /** level 1 hides shards and days, levels 2-3 hide days, level 6 shows the paydays (docs/days-and-shards.md) */
  SHOW_SHARDS: 2,
  SHOW_DAYS: 4,
  WORK_MAX: 5,
  LIVES_MAX: 5,
  LIFE_MS: 30 * 60_000,
  WIN_COINS: [20, 40, 60] as const,
  EARLY_DAY_COINS: 2,
  REPLAY_COINS: 5,
  CONTINUE_DAYS: 5,
  CONTINUE_SHARDS: 5,
  CONTINUE_PRICE: 900,
  CONTINUE_MULT: [1, 1.7, 2.8] as const,
  REFILL_LIVES_PRICE: 900,
  COIN_BAG_SHARDS: 5,
  COIN_BAG_PRICE: 250,
  TOOL_PRICE: { chisel: 300, wheel: 300, brush: 300 } as Record<ToolId, number>,
  UNLOCK_GIFT: { coins: 500, tools: { chisel: 2, wheel: 2 } as ToolCounts },
};

/** Price of the n-th (0-based) classic continue of an attempt; free in the tutorial levels. */
export const continuePrice = (level: number, n: number) =>
  level <= STORY.TUTORIAL_LEVELS ? 0 : Math.round(STORY.CONTINUE_PRICE * STORY.CONTINUE_MULT[Math.min(n, 2)]);

/* ---------- seeded random ---------- */
export function nextRandom(o: { rng: number }): number {
  const a = (o.rng = (o.rng + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const soloRng = (solo: SoloState): Rng => () => nextRandom(solo);

/* ---------- level geometry ---------- */
const idx = ([r, c]: Cell) => cellIdx(r, c);
export function regionCells(level: LevelDef): number[] {
  if (!level.region) return [];
  const [r0, c0] = level.regionOrigin ?? [0, 0];
  const out: number[] = [];
  level.region.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'X') out.push(cellIdx(r0 + r, c0 + c)); }));
  return out;
}

/** Prefilled cells as tiles: each 4-connected group is one old tile. */
function relicTiles(cells: Cell[]): Cell[][] {
  const left = new Set(cells.map(idx));
  const groups: Cell[][] = [];
  for (const start of cells.map(idx)) {
    if (!left.has(start)) continue;
    left.delete(start);
    const g: Cell[] = [];
    const stack = [start];
    while (stack.length) {
      const i = stack.pop() as number;
      const r = Math.floor(i / BOARD_SIZE), c = i % BOARD_SIZE;
      g.push([r, c]);
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= BOARD_SIZE || nc >= BOARD_SIZE) continue;
        const ni = cellIdx(nr, nc);
        if (left.has(ni)) { left.delete(ni); stack.push(ni); }
      }
    }
    groups.push(g);
  }
  return groups;
}

/* ---------- creation ---------- */
export function createSoloGame(level: LevelDef, opts: SoloOptions = {}): GameState {
  const seedState = { rng: level.seed | 0 };
  const s = createGame([
    { name: opts.name ?? '', isBot: false, level: 1, rating: 0 },
    { name: '', isBot: true, level: 1, rating: 0, botTier: 0 },
  ], () => nextRandom(seedState));
  s.current = 0;
  s.track = { length: level.days, treasures: [...level.paydays], rewards: [...level.giftDays] };
  s.rewardTaken = level.giftDays.map(() => false);
  const me = s.players[0], nobody = s.players[1];
  me.coins = level.startingShards + (opts.coinBag ? STORY.COIN_BAG_SHARDS : 0);
  nobody.coins = 0;
  nobody.pos = NOBODY_POS;
  nobody.board.fill(STONE);

  const cells = level.cells ?? {};
  for (const c of cells.stone ?? []) me.board[idx(c)] = STONE;
  relicTiles(cells.filled ?? []).forEach((g, i) => {
    const uid = RELIC_UID + i;
    for (const c of g) me.board[idx(c)] = uid;
    me.tiles.push({ uid, shape: RELIC_SHAPE, engraved: 0, cells: g });
  });

  const tools: ToolCounts = {};
  for (const t of TOOL_IDS) {
    if (level.id < TOOL_INTRO[t]) continue;
    const n = (opts.tools?.[t] ?? 0) + (level.freeTools?.[t] ?? 0);
    if (n > 0) tools[t] = n;
  }
  s.solo = {
    level: level.id, rng: seedState.rng, goals: level.goals, stars: level.stars,
    crack: (cells.crack ?? []).map(idx), gold: (cells.gold ?? []).map(idx), region: regionCells(level), goldTaken: [],
    tools, used: {}, coinBag: !!opts.coinBag, continues: 0, outcome: null, early: 0,
  };
  refreshIfStuck(s);
  return s;
}

/* ---------- score and goals ---------- */
const isTile = (v: number) => v > 0;
const playerCells = (s: GameState) => s.players[0].board.reduce((n, v) => n + (v > 0 && v < RELIC_UID ? 1 : 0), 0);

/** Story score: half the shards + the 7x7 bonus + one point per cell the player covered (no empty-cell penalty:
 *  the early levels do not ask for a full board; boards that must be full say so with a goal). */
export function soloScore(s: GameState) {
  const p = s.players[0];
  const coinPoints = Math.floor(p.coins / COIN_SCORE_DIVISOR);
  const bonus = p.bonus7 ? SPECIAL_7X7_BONUS : 0;
  const cells = playerCells(s);
  return { coins: p.coins, coinPoints, bonus, cells, total: coinPoints + bonus + cells };
}

export interface GoalProgress { goal: Goal; have: number; need: number; done: boolean }

export function goalProgress(s: GameState): GoalProgress[] {
  const solo = s.solo as SoloState;
  const p = s.players[0];
  const filled = (list: number[]) => list.reduce((n, i) => n + (isTile(p.board[i]) ? 1 : 0), 0);
  return solo.goals.map((goal): GoalProgress => {
    switch (goal.type) {
      case 'fill_board': {
        const need = p.board.filter((v) => v !== STONE).length;
        const have = need - emptyCount(p);
        return { goal, have, need, done: have >= need };
      }
      case 'fill_count': { const have = playerCells(s); return { goal, have, need: goal.n, done: have >= goal.n }; }
      case 'fill_region': { const have = filled(solo.region); return { goal, have, need: solo.region.length, done: have >= solo.region.length }; }
      case 'cover_cracks': { const have = filled(solo.crack); return { goal, have, need: solo.crack.length, done: have >= solo.crack.length }; }
      case 'bonus7': return { goal, have: p.bonus7 ? 1 : 0, need: 1, done: p.bonus7 };
      case 'max_empty': { const have = emptyCount(p); return { goal, have, need: goal.max, done: have <= goal.max }; }
      case 'min_score': { const have = soloScore(s).total; return { goal, have, need: goal.n, done: have >= goal.n }; }
      case 'min_shards': return { goal, have: p.coins, need: goal.n, done: p.coins >= goal.n };
    }
  });
}
export const goalsDone = (s: GameState) => goalProgress(s).every((g) => g.done);
/** Days left before the deadline. */
export const daysLeft = (s: GameState) => trackLen(s) - s.players[0].pos;

export function starsOf(s: GameState): number {
  const solo = s.solo as SoloState;
  if (solo.outcome !== 'won') return 0;
  const sc = soloScore(s).total;
  return 1 + (sc >= solo.stars[0] ? 1 : 0) + (sc >= solo.stars[1] ? 1 : 0);
}

/** Meta coins the level pays out on a win (the server decides whether this is a first win). */
export function winCoins(level: LevelDef, s: GameState, firstWin: boolean): number {
  const solo = s.solo as SoloState;
  if (solo.outcome !== 'won') return 0;
  const base = firstWin ? STORY.WIN_COINS[level.hard ?? 0] : STORY.REPLAY_COINS;
  return base + solo.early * STORY.EARLY_DAY_COINS;
}

/* ---------- flow ---------- */
function conclude(s: GameState, outcome: 'won' | 'lost') {
  if (s.phase !== 'finished') finishGame(s, 'track_end');
  const solo = s.solo as SoloState;
  solo.outcome = outcome;
  if (s.result) s.result.winner = outcome === 'won' ? 0 : 1;
}

/** No opponent buys tiles here, so the market moves on in two other ways: every "work" replaces the oldest offer,
 *  and if none of the three fits anywhere on the board, the oldest ones are replaced (up to three times) instead of
 *  leaving the player stuck. Seeded, so a replay does the same. */
function refreshIfStuck(s: GameState) {
  const board = s.players[0].board;
  if (s.phase !== 'playing' || emptyCount(s.players[0]) === 0) return;
  for (let n = 0; n < 3 && !s.offer.some((t) => canPlaceAny(board, t.cells)); n++) rotateOffer(s);
}
/** The oldest offer leaves, the previewed tile slides in and a new one is drawn. */
function rotateOffer(s: GameState) {
  s.offer = [...s.offer.slice(1), s.next];
  s.next = makeTile(s.nextUid++, soloRng(s.solo as SoloState));
}

function payGold(s: GameState) {
  const solo = s.solo as SoloState;
  const me = s.players[0];
  for (const i of solo.gold) {
    if (solo.goldTaken.includes(i) || !isTile(me.board[i])) continue;
    solo.goldTaken.push(i);
    me.coins += 1;
    ev(s, { k: 'gold', seat: 0, coins: 1 });
  }
}

function settle(s: GameState) {
  payGold(s);
  s.current = 0;
  if (s.phase === 'finished') { conclude(s, goalsDone(s) ? 'won' : 'lost'); return; }
  refreshIfStuck(s);
}

function useTool(s: GameState, tool: ToolId): string | null {
  const solo = s.solo as SoloState;
  if (s.phase !== 'playing') return 'Not now';
  if (!(solo.tools[tool]! > 0)) return 'No such tool';
  solo.tools[tool] = solo.tools[tool]! - 1;
  solo.used[tool] = (solo.used[tool] ?? 0) + 1;
  ev(s, { k: 'tool', seat: 0, tool });
  return null;
}

/** Everything the player does in a level goes through here, in the order it was done; the same list replayed on
 *  the server gives the same result. */
export function applySoloAction(s: GameState, a: SoloAction): string | null {
  const solo = s.solo;
  if (!solo) return 'Not a story level';
  const me = s.players[0];
  if (a.t === 'continue') {
    if (solo.outcome !== 'lost') return 'Nothing to continue';
    if (solo.continues >= STORY.CONTINUE_MULT.length) return 'No more continues';
    solo.continues++;
    solo.outcome = null;
    (s.track as NonNullable<GameState['track']>).length += STORY.CONTINUE_DAYS;
    me.coins += STORY.CONTINUE_SHARDS;
    s.phase = 'playing';
    s.result = null;
    s.endTriggeredBy = null;
    s.pendingRewards = 0;
    s.current = 0;
    refreshIfStuck(s);
    return null;
  }
  if (solo.outcome || s.phase === 'finished') return 'Level is over';
  switch (a.t) {
    case 'advance': return 'Pick the days to work';
    case 'work': {
      if (!Number.isInteger(a.days) || a.days < 1 || a.days > STORY.WORK_MAX) return 'Pick the days to work';
      const err = applyAdvance(s, 0, Math.min(a.days, daysLeft(s)));
      if (err) return err;
      // while the player works, the market moves on: the oldest offer is replaced
      if (s.phase === 'playing') rotateOffer(s);
      settle(s);
      return null;
    }
    case 'finish':
      if (!goalsDone(s)) return 'Goals are not done';
      solo.early = daysLeft(s);
      conclude(s, 'won');
      return null;
    case 'chisel': {
      const tile = me.tiles.find((t) => t.uid === a.uid);
      if (!tile || tile.uid >= RELIC_UID) return 'Not your tile';
      const err = useTool(s, 'chisel');
      if (err) return err;
      for (const [r, c] of tile.cells) me.board[cellIdx(r, c)] = 0;
      me.tiles = me.tiles.filter((t) => t !== tile);
      return null;
    }
    case 'wheel': {
      const err = useTool(s, 'wheel');
      if (err) return err;
      const rng = soloRng(solo);
      s.offer = s.offer.map(() => makeTile(s.nextUid++, rng));
      refreshIfStuck(s);
      return null;
    }
    case 'brush': {
      if (!Number.isInteger(a.r) || !Number.isInteger(a.c) || !cellsFree(me.board, [[a.r, a.c]])) return 'Cell is not free';
      const err = useTool(s, 'brush');
      if (err) return err;
      const uid = s.nextUid++;
      me.board[cellIdx(a.r, a.c)] = uid;
      me.tiles.push({ uid, shape: MONO_SHAPE, engraved: 0, cells: [[a.r, a.c]] });
      ev(s, { k: 'place1x1', seat: 0 });
      check7x7(s, 0);
      if (emptyCount(me) === 0) { s.endTriggeredBy = 0; finishGame(s, 'board_full'); }
      settle(s);
      return null;
    }
    default: {
      const err = applyAction(s, 0, a, soloRng(solo));
      if (err) return err;
      settle(s);
      return null;
    }
  }
}

/** Replays a level from its action list (the server's check). */
export function replaySolo(level: LevelDef, opts: SoloOptions, actions: SoloAction[]): { state: GameState; error: string | null; at: number } {
  const state = createSoloGame(level, opts);
  for (let i = 0; i < actions.length; i++) {
    const error = applySoloAction(state, actions[i]);
    if (error) return { state, error, at: i };
  }
  return { state, error: null, at: actions.length };
}
