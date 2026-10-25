import { BOARD_SIZE, Cell, GameState, cellIdx, cellsFree, cellsKey, transformCells } from '../../../shared/src';
import type { Selection } from '../store';

export interface Preview { abs: Cell[]; valid: boolean }

/** Preview of the selected tile (or the 1x1 reward) around the hovered cell. */
export function previewFor(g: GameState, seat: 0 | 1, sel: Selection): Preview | null {
  if (!sel.hover) return null;
  const board = g.players[seat].board;
  const [hr, hc] = sel.hover;
  if (g.phase === 'placing_reward') return { abs: [[hr, hc]], valid: cellsFree(board, [[hr, hc]]) };
  if (sel.offer === null) return null;
  const tile = g.offer[sel.offer];
  if (!tile) return null;
  const cells = transformCells(tile.cells, sel.rot, sel.flip);
  const h = Math.max(...cells.map((c) => c[0])) + 1, w = Math.max(...cells.map((c) => c[1])) + 1;
  const r0 = hr - Math.floor(h / 2), c0 = hc - Math.floor(w / 2);
  const abs = cells.map(([r, c]) => [r0 + r, c0 + c] as Cell);
  return { abs, valid: cellsFree(board, abs) };
}
/** The valid ghost position closest to `from` (default: board centre), so a selected tile is shown on the board at once. */
export function nearestValid(g: GameState, seat: 0 | 1, sel: Selection, from: [number, number] = [4, 4]): [number, number] | null {
  let best: [number, number] | null = null, bestD = Infinity;
  for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) {
    const d = (r - from[0]) ** 2 + (c - from[1]) ** 2;
    if (d >= bestD) continue;
    const pv = previewFor(g, seat, { ...sel, hover: [r, c] });
    if (pv?.valid) { best = [r, c]; bestD = d; }
  }
  return best;
}
export const inBounds = ([r, c]: Cell) => r >= 0 && c >= 0 && r < BOARD_SIZE && c < BOARD_SIZE;
export { cellIdx };

/** Same orientation as transformCells, but cells keep their original order (cell k of the tile stays index k),
 *  so a turn can keep one particular cell of the tile in place. */
export function orientUnsorted(cells: Cell[], rot: number, flip: boolean): Cell[] {
  let cur = cells.map(([r, c]) => [r, flip ? -c : c] as Cell);
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) cur = cur.map(([r, c]) => [c, -r] as Cell);
  const mr = Math.min(...cur.map((c) => c[0])), mc = Math.min(...cur.map((c) => c[1]));
  return cur.map(([r, c]) => [r - mr, c - mc] as Cell);
}

/** Board cells covered by a tile in a given orientation when the ghost is centred on `hover` (as previewFor does). */
export function placedCells(cells: Cell[], rot: number, flip: boolean, hover: [number, number]): Cell[] {
  const o = orientUnsorted(cells, rot, flip);
  const h = Math.max(...o.map((c) => c[0])) + 1, w = Math.max(...o.map((c) => c[1])) + 1;
  const r0 = hover[0] - Math.floor(h / 2), c0 = hover[1] - Math.floor(w / 2);
  return o.map(([r, c]) => [r0 + r, c0 + c] as Cell);
}

/** The ghost centre that puts tile cell `k` of orientation (rot, flip) exactly on board cell `at`. */
export function hoverKeeping(cells: Cell[], rot: number, flip: boolean, k: number, at: Cell): [number, number] {
  const o = orientUnsorted(cells, rot, flip);
  const h = Math.max(...o.map((c) => c[0])) + 1, w = Math.max(...o.map((c) => c[1])) + 1;
  const r0 = at[0] - o[k][0], c0 = at[1] - o[k][1];
  return [r0 + Math.floor(h / 2), c0 + Math.floor(w / 2)];
}

/** Every distinct way a tile can face, with one (rot, flip) that produces it. */
export function distinctOrientations(cells: Cell[]): { rot: number; flip: boolean; cells: Cell[]; key: string }[] {
  const out: { rot: number; flip: boolean; cells: Cell[]; key: string }[] = [];
  for (const flip of [false, true]) for (let rot = 0; rot < 4; rot++) {
    const o = transformCells(cells, rot, flip), key = cellsKey(o);
    if (!out.some((x) => x.key === key)) out.push({ rot, flip, cells: o, key });
  }
  return out;
}

/** Does this exact orientation fit anywhere on the board? */
export function fitsSomewhere(board: number[], oriented: Cell[]): boolean {
  const h = Math.max(...oriented.map((c) => c[0])) + 1, w = Math.max(...oriented.map((c) => c[1])) + 1;
  for (let r0 = 0; r0 <= BOARD_SIZE - h; r0++) for (let c0 = 0; c0 <= BOARD_SIZE - w; c0++)
    if (oriented.every(([r, c]) => board[(r0 + r) * BOARD_SIZE + c0 + c] === 0)) return true;
  return false;
}

/**
 * Where (and which way round) to show a selected tile: its current orientation at the valid spot nearest to `from`;
 * if the tile fits nowhere that way round, the first orientation that does fit (so a card that can be played always
 * gets a ghost on the board). With `at`, an orientation that fits exactly there wins (a drop on the board).
 */
export function bestFit(g: GameState, seat: 0 | 1, sel: Selection, from?: [number, number], at?: [number, number]):
  { rot: number; flip: boolean; hover: [number, number]; turned: boolean } | null {
  const tile = sel.offer !== null ? g.offer[sel.offer] : null;
  if (!tile) return null;
  const orients = distinctOrientations(tile.cells);
  const cur = cellsKey(transformCells(tile.cells, sel.rot, sel.flip));
  const same = (o: { key: string }) => o.key === cur;
  if (at) {
    if (previewFor(g, seat, { ...sel, hover: at })?.valid) return { rot: sel.rot, flip: sel.flip, hover: at, turned: false };
    for (const o of orients) if (!same(o) && previewFor(g, seat, { ...sel, rot: o.rot, flip: o.flip, hover: at })?.valid) return { rot: o.rot, flip: o.flip, hover: at, turned: true };
  }
  const here = nearestValid(g, seat, sel, from);
  if (here) return { rot: sel.rot, flip: sel.flip, hover: here, turned: false };
  for (const o of orients) {
    if (same(o)) continue;
    const h = nearestValid(g, seat, { ...sel, rot: o.rot, flip: o.flip }, from);
    if (h) return { rot: o.rot, flip: o.flip, hover: h, turned: true };
  }
  return null;
}
