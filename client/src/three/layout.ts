import { TRACK_LENGTH } from '../../../shared/src';

export interface Layout {
  w: number; h: number; cx: number; cy: number; landscape: boolean;
  my: { x: number; y: number; scale: number };
  opp: { x: number; y: number; scale: number };
  track: { x: number; y: number; cols: number; cell: number; rowGap: number; rows: number };
}

/** The opponent's board is intentionally smaller than the player's own board. */
export function computeLayout(aspect: number): Layout {
  const n = TRACK_LENGTH + 1;
  if (aspect >= 1.1) {
    const cols = Math.ceil(n / 3);
    const cell = Math.min(0.8, 16 / cols);
    return {
      landscape: true, w: 18.8, h: 13.9, cx: 0, cy: -1.75,
      my: { x: -3.75, y: 0, scale: 1 }, opp: { x: 5.7, y: 0.4, scale: 0.6 },
      track: { x: 0, y: -6.3, cols, cell, rowGap: cell * 1.12, rows: Math.ceil(n / cols) },
    };
  }
  const cols = Math.ceil(n / 5);
  const cell = Math.min(0.85, 9.6 / cols);
  return {
    landscape: false, w: 10.4, h: 21.3, cx: 0, cy: -0.95,
    my: { x: 0, y: -0.6, scale: 1 }, opp: { x: 0, y: 7.0, scale: 0.5 },
    track: { x: 0, y: -7.2, cols, cell, rowGap: cell * 1.12, rows: Math.ceil(n / cols) },
  };
}

export function trackCoord(l: Layout, i: number): [number, number] {
  const { cols, cell, rowGap, x, y } = l.track;
  const row = Math.floor(i / cols);
  let col = i % cols;
  if (row % 2 === 1) col = cols - 1 - col;
  return [x + (col - (cols - 1) / 2) * cell, y - row * rowGap];
}
export function trackCoordFrac(l: Layout, f: number): [number, number] {
  const i0 = Math.floor(f), i1 = Math.min(TRACK_LENGTH, i0 + 1), t = f - i0;
  const a = trackCoord(l, i0), b = trackCoord(l, i1);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
