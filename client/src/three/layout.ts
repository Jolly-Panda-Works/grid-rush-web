import { TRACK_LENGTH } from '../../../shared/src';

export interface TrackLayout {
  x: number; y: number;          // desktop: centre of the first line; phone: centre of the visible window
  cell: number;                  // cell size
  vertical: boolean;             // (legacy two-column phone track, unused)
  window: number;                // phone: number of visible cells of a single scrolling line (0 = whole track visible)
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
 *  Phones (portrait): opponent board on top, a zoomed scrolling strip of the time track in the middle, my board below.
 *  Desktop (landscape): boards side by side, the whole time track below. */
export function computeLayout(aspect: number): Layout {
  const n = TRACK_LENGTH + 1;
  if (aspect >= 1.1) {
    const lineLen = Math.ceil(n / 3), lines = 3;
    const cell = Math.min(0.8, 16 / lineLen), across = cell * 1.12, y = -6.3;
    return {
      landscape: true, w: 18.8, h: 13.9, cx: 0, cy: -1.75,
      my: { x: -3.75, y: 0, scale: 1 }, opp: { x: 5.7, y: 0.4, scale: 0.6 },
      track: {
        x: 0, y, cell, vertical: false, window: 0, lineLen, lines, step: cell, across,
        plate: { x: 0, y: y - ((lines - 1) * across) / 2, w: lineLen * cell + 0.75, h: (lines - 1) * across + cell + 0.65 },
      },
    };
  }
  // Phone: my board (frame 10.4) at y=0, the track strip above it, the small opponent board on top.
  const win = 11, cell = 0.92, step = 0.96, oppScale = 0.42;
  const plateW = win * step + 0.4, plateH = cell + 0.42;
  const ty = 5.2 + 0.4 + plateH / 2;
  const oy = ty + plateH / 2 + 0.4 + 5.2 * oppScale;
  const top = oy + 5.2 * oppScale, bottom = -5.2;
  return {
    landscape: false, w: 11.2, h: top - bottom + 0.5, cx: 0, cy: (top + bottom) / 2,
    my: { x: 0, y: 0, scale: 1 }, opp: { x: 0, y: oy, scale: oppScale },
    track: {
      x: 0, y: ty, cell, vertical: false, window: win, lineLen: n, lines: 1, step, across: 0,
      plate: { x: 0, y: ty, w: plateW, h: plateH },
    },
  };
}

/** `scroll` = the (fractional) track index shown in the middle of the phone window. */
export function trackCoord(l: Layout, i: number, scroll = 0): [number, number] {
  const t = l.track;
  if (t.window) return [t.x + (i - scroll) * t.step, t.y];
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
export function trackCoordFrac(l: Layout, f: number, scroll = 0): [number, number] {
  const i0 = Math.floor(f), i1 = Math.min(TRACK_LENGTH, i0 + 1), t = f - i0;
  const a = trackCoord(l, i0, scroll), b = trackCoord(l, i1, scroll);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Phone window: how visible a cell at track index `i` is (1 inside, fading to 0 just outside the window). */
export function windowAlpha(l: Layout, i: number, scroll: number): number {
  if (!l.track.window) return 1;
  const half = (l.track.window - 1) / 2;
  return Math.max(0, Math.min(1, half + 0.5 - Math.abs(i - scroll)));
}

/** Where the phone window should be centred so both markers (and the preview ghost) are visible. */
export function windowTarget(l: Layout, a: number, b: number, current: number): number {
  const half = (l.track.window - 1) / 2;
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const c = hi - lo <= l.track.window - 2 ? (lo + hi) / 2 : current + half - 1;
  return Math.max(half, Math.min(TRACK_LENGTH - half, c));
}
