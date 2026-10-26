import { TRACK_LENGTH } from '../../../shared/src';

export interface TrackLayout {
  len: number;                   // last track index (the PvP track or a story level's own)
  calendar: boolean;             // desktop: days in rows of 9 (a calendar), read in the language's direction
  rtl: boolean;
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
  /** where the player panels go (world units): phones = left of the opponent board, desktop = under it */
  info: { x0: number; y0: number; x1: number; y1: number };
  track: TrackLayout;
}

/** The opponent's board is intentionally smaller than the player's own board.
 *  Phones (portrait): opponent board on top, a zoomed scrolling strip of the time track in the middle, my board below.
 *  Desktop (landscape): boards side by side, the whole time track below. */
export function computeLayout(aspect: number, len: number = TRACK_LENGTH, solo = false, rtl = false): Layout {
  if (solo) return soloLayout(aspect, len);
  const n = len + 1;
  if (aspect >= 1.1) {
    // the calendar: day 1..len in rows of 9 (day 0, the start, sits just before day 1)
    const lineLen = 9, lines = Math.ceil(len / 9);
    const cell = 0.74, across = cell * 1.08, y = -6.1;
    const bottom = y - (lines - 1) * across - cell / 2 - 0.45;
    return {
      landscape: true, w: 18.8, h: 6.0 - bottom, cx: 0, cy: (6.0 + bottom) / 2,
      my: { x: -3.75, y: 0, scale: 1 }, opp: { x: 5.7, y: 0.4, scale: 0.6 },
      // a story level has no opponent board: the goals take its place
      info: solo ? { x0: 5.7 - 3.12, x1: 5.7 + 3.12, y0: -5.55, y1: 0.4 + 3.12 } : { x0: 5.7 - 3.12, x1: 5.7 + 3.12, y0: -5.55, y1: 0.4 - 3.12 - 0.25 },
      track: {
        len, calendar: true, rtl, x: 0, y, cell, vertical: false, window: 0, lineLen, lines, step: cell * 1.06, across,
        plate: { x: 0, y: y - ((lines - 1) * across) / 2, w: (lineLen + 1) * cell * 1.06 + 0.5, h: (lines - 1) * across + cell + 0.65 },
      },
    };
  }
  // Phone, top to bottom: the time-track strip (left of the menu button), the opponent board (right) with the
  // player panels on its left, my board (frame 10.4) at y=0.
  const win = 9, cell = 0.92, step = 0.96, oppScale = 0.45;
  const plateW = win * step + 0.4, plateH = cell + 0.42;
  const MENU_ROOM = 1.35; // the menu button floats in the top-right corner
  const tx = 5.6 - MENU_ROOM - (plateW + 0.25) / 2;
  const oy = 5.2 + 0.4 + 5.2 * oppScale;
  const ty = oy + 5.2 * oppScale + 0.4 + plateH / 2;
  const top = ty + plateH / 2, bottom = -5.2;
  return {
    landscape: false, w: 11.2, h: top - bottom + 0.5, cx: 0, cy: (top + bottom) / 2,
    // the opponent board sits on the right, the player panels fill the space on its left
    my: { x: 0, y: 0, scale: 1 }, opp: { x: 5.6 - 5.2 * oppScale - 0.15, y: oy, scale: oppScale },
    info: { x0: -5.5, x1: solo ? 5.5 : 5.6 - 2 * 5.2 * oppScale - 0.45, y0: oy - 5.2 * oppScale, y1: oy + 5.2 * oppScale },
    track: {
      len, calendar: false, rtl, x: tx, y: ty, cell, vertical: false, window: win, lineLen: n, lines: 1, step, across: 0,
      plate: { x: tx, y: ty, w: plateW, h: plateH },
    },
  };
}

/** A story level: my board and, in place of the opponent's board and the time track, the goals panel (with the day
 *  counter). The track layout is still filled in (nothing draws it). */
function soloLayout(aspect: number, len: number): Layout {
  const track: TrackLayout = { len, calendar: false, rtl: false, x: 0, y: 0, cell: 0.8, vertical: false, window: 0, lineLen: len + 1, lines: 1, step: 0.8, across: 0, plate: { x: 0, y: 0, w: 0, h: 0 } };
  if (aspect >= 1.1) {
    return {
      landscape: true, w: 18.8, h: 11.4, cx: 0, cy: 0,
      my: { x: -3.75, y: 0, scale: 1 }, opp: { x: 5.7, y: 0, scale: 0.6 },
      info: { x0: 5.7 - 3.12, x1: 5.7 + 3.12, y0: -5.2, y1: 5.2 }, track,
    };
  }
  const MENU_ROOM = 1.35, infoH = 3.9;
  const y0 = 5.2 + 0.35, y1 = y0 + infoH, bottom = -5.2;
  return {
    landscape: false, w: 11.2, h: y1 - bottom + 0.5, cx: 0, cy: (y1 + bottom) / 2,
    my: { x: 0, y: 0, scale: 1 }, opp: { x: 0, y: y1, scale: 0.45 },
    info: { x0: -5.5, x1: 5.5 - MENU_ROOM, y0, y1 }, track,
  };
}

/** `scroll` = the (fractional) track index shown in the middle of the phone window. */
export function trackCoord(l: Layout, i: number, scroll = 0): [number, number] {
  const t = l.track;
  if (t.window) return [t.x + (i - scroll) * t.step, t.y];
  if (t.calendar) {
    const row = i === 0 ? 0 : Math.floor((i - 1) / t.lineLen);
    const col = i === 0 ? -1 : (i - 1) % t.lineLen;
    const x = (col - (t.lineLen - 2) / 2) * t.step; // (col -1 = the start, so the grid with it is centred)
    return [t.x + (t.rtl ? -x : x), t.y - row * t.across];
  }
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
  const i0 = Math.floor(f), i1 = Math.min(l.track.len, i0 + 1), t = f - i0;
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
  return Math.max(half, Math.min(l.track.len - half, c));
}
