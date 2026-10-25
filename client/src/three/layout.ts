import { TRACK_LENGTH } from '../../../shared/src';

export interface TrackLayout {
  x: number; y: number;          // desktop: centre of the first line; phone: centre of the first cell of line 0
  cell: number;                  // cell size
  vertical: boolean;             // phone: two columns on the left side of the screen
  lineLen: number; lines: number;
  step: number;                  // distance between neighbouring cells along a line
  across: number;                // distance between lines (rows / columns)
  plate: { x: number; y: number; w: number; h: number }; // background plate
}
export interface Layout {
  w: number; h: number; cx: number; cy: number; landscape: boolean;
  my: { x: number; y: number; scale: number };
  opp: { x: number; y: number; scale: number };
  track: TrackLayout;
}

/** The opponent's board is intentionally smaller than the player's own board.
 *  Phones (portrait): the time track is a 2-column snake on the LEFT, opponent board on top, my board below it.
 *  Desktop (landscape): boards side by side, the time track below. */
export function computeLayout(aspect: number): Layout {
  const n = TRACK_LENGTH + 1;
  if (aspect >= 1.1) {
    const lineLen = Math.ceil(n / 3), lines = 3;
    const cell = Math.min(0.8, 16 / lineLen), across = cell * 1.12, y = -6.3;
    return {
      landscape: true, w: 18.8, h: 13.9, cx: 0, cy: -1.75,
      my: { x: -3.75, y: 0, scale: 1 }, opp: { x: 5.7, y: 0.4, scale: 0.6 },
      track: {
        x: 0, y, cell, vertical: false, lineLen, lines, step: cell, across,
        plate: { x: 0, y: y - ((lines - 1) * across) / 2, w: lineLen * cell + 0.75, h: (lines - 1) * across + cell + 0.65 },
      },
    };
  }
  const lines = 2, lineLen = Math.ceil(n / lines);
  const cell = 0.56, across = cell * 1.12;
  const plateW = (lines - 1) * across + cell + 0.65, plateH = (lineLen - 1) * cell + cell + 0.65;
  const plateX = -6.4 + plateW / 2, plateY = 2.68;
  return {
    landscape: false, w: 12.7, h: 17.0, cx: -0.05, cy: 2.68,
    my: { x: 0.94, y: -0.3, scale: 1 }, opp: { x: 0.94, y: 8.0, scale: 0.55 },
    track: {
      x: plateX, y: plateY + plateH / 2 - 0.325 - cell / 2, cell, vertical: true, lineLen, lines, step: cell, across,
      plate: { x: plateX, y: plateY, w: plateW, h: plateH },
    },
  };
}

export function trackCoord(l: Layout, i: number): [number, number] {
  const t = l.track;
  if (t.vertical) {
    const line = Math.floor(i / t.lineLen);
    let idx = i % t.lineLen;
    if (line % 2 === 1) idx = t.lineLen - 1 - idx; // down the left column, back up the right column
    return [t.x + (line - (t.lines - 1) / 2) * t.across, t.y - idx * t.step];
  }
  const row = Math.floor(i / t.lineLen);
  let col = i % t.lineLen;
  if (row % 2 === 1) col = t.lineLen - 1 - col;
  return [t.x + (col - (t.lineLen - 1) / 2) * t.step, t.y - row * t.across];
}
export function trackCoordFrac(l: Layout, f: number): [number, number] {
  const i0 = Math.floor(f), i1 = Math.min(TRACK_LENGTH, i0 + 1), t = f - i0;
  const a = trackCoord(l, i0), b = trackCoord(l, i1);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
