import { BOARD_SIZE, Cell, GameState, cellIdx, cellsFree, transformCells } from '../../../shared/src';
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
