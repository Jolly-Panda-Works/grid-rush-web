// Story levels (docs/story-mode.md): one board against the "pacer", a boardless piece on the time track that
// only moves forward a fixed number of cells per turn. The PvP rules in engine.ts are used unchanged; this file
// adds the level's special cells, goals, tools and the win / lose / continue flow around them.
import { BOARD_SIZE, COIN_SCORE_DIVISOR, SPECIAL_7X7_BONUS } from '../constants';
import { applyAction, cellIdx, cellsFree, check7x7, createGame, emptyCount, ev, finishGame, trackLen } from '../engine';
import { MONO_SHAPE, makeTile } from '../tiles';
import type { Action, Cell, GameState, Rng } from '../types';

/** A cell that is out of the game: no tile goes on it, and it is neither empty nor filled. */
export const STONE = -2;
/** Uids of the designer's prefilled tiles; player tiles count up from 1 and never get here. */
export const RELIC_UID = 100000;
export const RELIC_SHAPE = 'relic';

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
  | { type: 'min_coins'; n: number };

export interface LevelDef {
  id: number;
  /** fixes the tile offers, so a level plays the same every time and the server can replay it */
  seed: number;
  trackLength: number;
  pacerStep: number;
  startingCoins: number;
  treasures: number[];
  rewards: number[];
  cells?: { filled?: Cell[]; crack?: Cell[]; stone?: Cell[]; gold?: Cell[] };
  region?: string[];
  regionOrigin?: Cell;
  goals: Goal[];
  /** score for the 2nd and the 3rd star (the 1st star is the goals) */
  stars: [number, number];
  /** 1 = hard, 2 = very hard: a red frame on the map and more coins */
  hard?: 1 | 2;
  /** what the coach teaches in this level (client/src/levelCoach.ts) */
  teach?: string;
  /** free tools for this level only (the first sample of a new tool) */
  freeTools?: ToolCounts;
}

export interface SoloState {
  level: number;
  pacerStep: number;
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
  /** track cells left when the player ended the level early (they turn into coins) */
  early: number;
}

export type SoloAction =
  | Action
  | { t: 'chisel'; uid: number }
  | { t: 'wheel' }
  | { t: 'brush'; r: number; c: number }
  | { t: 'finish' }
  | { t: 'continue' };

export interface SoloOptions { name?: string; tools?: ToolCounts; coinBag?: boolean }

export const STORY = {
  TUTORIAL_LEVELS: 10,
  LIVES_MAX: 5,
  LIFE_MS: 30 * 60_000,
  WIN_COINS: [20, 40, 60] as const,
  EARLY_CELL_COINS: 2,
  REPLAY_COINS: 5,
  CONTINUE_CELLS: 6,
  CONTINUE_COINS: 5,
  CONTINUE_PRICE: 900,
  CONTINUE_MULT: [1, 1.7, 2.8] as const,
  REFILL_LIVES_PRICE: 900,
  COIN_BAG_COINS: 5,
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
    { name: 'pacer', isBot: true, level: 1, rating: 0, botTier: 0 },
  ], () => nextRandom(seedState));
  s.current = 0;
  s.track = { length: level.trackLength, treasures: [...level.treasures], rewards: [...level.rewards] };
  s.rewardTaken = level.rewards.map(() => false);
  const me = s.players[0], pacer = s.players[1];
  me.coins = level.startingCoins + (opts.coinBag ? STORY.COIN_BAG_COINS : 0);
  pacer.coins = 0;
  pacer.board.fill(STONE); // the pacer has no board

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
    level: level.id, pacerStep: Math.max(1, level.pacerStep), rng: seedState.rng,
    goals: level.goals, stars: level.stars,
    crack: (cells.crack ?? []).map(idx), gold: (cells.gold ?? []).map(idx), region: regionCells(level), goldTaken: [],
    tools, used: {}, coinBag: !!opts.coinBag, continues: 0, outcome: null, early: 0,
  };
  return s;
}

/* ---------- score and goals ---------- */
const isTile = (v: number) => v > 0;
const playerCells = (s: GameState) => s.players[0].board.reduce((n, v) => n + (v > 0 && v < RELIC_UID ? 1 : 0), 0);

/** Story score: half the coins + the 7x7 bonus + one point per cell the player covered (no empty-cell penalty:
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
      case 'min_coins': return { goal, have: p.coins, need: goal.n, done: p.coins >= goal.n };
    }
  });
}
export const goalsDone = (s: GameState) => goalProgress(s).every((g) => g.done);

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
  return base + solo.early * STORY.EARLY_CELL_COINS;
}

/* ---------- turns ---------- */
function conclude(s: GameState, outcome: 'won' | 'lost') {
  if (s.phase !== 'finished') finishGame(s, 'track_end');
  const solo = s.solo as SoloState;
  solo.outcome = outcome;
  if (s.result) s.result.winner = outcome === 'won' ? 0 : 1;
}

/** The pacer moves its fixed step until it is ahead of the player, then the turn comes back. Like an opponent
 *  buying in PvP, each pacer turn takes the oldest offer away, so offers that fit nowhere do not stay forever. */
function pacerTurns(s: GameState) {
  const solo = s.solo as SoloState;
  const me = s.players[0], pacer = s.players[1];
  if (s.current === 1 && s.phase === 'playing') {
    s.offer = [...s.offer.slice(1), s.next];
    s.next = makeTile(s.nextUid++, soloRng(solo));
  }
  while (s.current === 1 && s.phase === 'playing') {
    const from = pacer.pos;
    pacer.pos = Math.min(trackLen(s), from + solo.pacerStep);
    if (pacer.pos > from) ev(s, { k: 'move', seat: 1, from, to: pacer.pos });
    if (pacer.pos > me.pos || pacer.pos === from) {
      s.current = 0;
      s.turnNo++;
      ev(s, { k: 'turn', seat: 0 });
    }
  }
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
  if (s.phase === 'finished') { conclude(s, goalsDone(s) ? 'won' : 'lost'); return; }
  pacerTurns(s);
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
    (s.track as NonNullable<GameState['track']>).length += STORY.CONTINUE_CELLS;
    me.coins += STORY.CONTINUE_COINS;
    s.phase = 'playing';
    s.result = null;
    s.endTriggeredBy = null;
    s.pendingRewards = 0;
    s.current = me.pos > s.players[1].pos ? 1 : 0;
    pacerTurns(s);
    return null;
  }
  if (solo.outcome || s.phase === 'finished') return 'Level is over';
  if (s.current !== 0) return 'Not your turn';
  switch (a.t) {
    case 'finish':
      if (!goalsDone(s)) return 'Goals are not done';
      solo.early = trackLen(s) - me.pos;
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

/** Replays a level from its action log (the server's check, and the client's restore after a reload). */
export function replaySolo(level: LevelDef, opts: SoloOptions, actions: SoloAction[]): { state: GameState; error: string | null; at: number } {
  const state = createSoloGame(level, opts);
  for (let i = 0; i < actions.length; i++) {
    const error = applySoloAction(state, actions[i]);
    if (error) return { state, error, at: i };
  }
  return { state, error: null, at: actions.length };
}
