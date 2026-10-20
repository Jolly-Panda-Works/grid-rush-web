import { TRACK_LENGTH } from '../../../shared/src';

export interface Layout {
  w: number; h: number; cx: number; cy: number; landscape: boolean;
  my: { x: number; y: number; scale: number };
  opp: { x: number; y: number; scale: number };
  track: { x: number; y: number; cols: number; cell: number; rowGap: number; rows: number };
}

export function computeLayout(aspect: number): Layout {
  const n = TRACK_LENGTH + 1;
  if (aspect >= 1.1) {
    const cols = Math.ceil(n / 3);
    const cell = Math.min(0.7, 21.6 / cols);
    const rows = Math.ceil(n / cols);
    return {
      landscape: true, w: 22.8, h: 13.4, cx: 0, cy: -1.6,
      my: { x: -6.4, y: 0, scale: 1 }, opp: { x: 6.4, y: 0, scale: 1 },
      track: { x: 0, y: -6.1, cols, cell, rowGap: cell * 1.12, rows },
    };
  }
  const cols = Math.ceil(n / 6);
  const cell = Math.min(0.6, 9.6 / cols);
  const rows = Math.ceil(n / cols);
  return {
    landscape: false, w: 10.4, h: 21.4, cx: 0, cy: -0.2,
    my: { x: 0, y: -0.6, scale: 1 }, opp: { x: 0, y: 7.5, scale: 0.6 },
    track: { x: 0, y: -7.1, cols, cell, rowGap: cell * 1.12, rows },
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
