/** Lets DOM drag-and-drop (tile offer cards) talk to the 3D scene. */
export const dragApi: {
  /** which cell of MY board is under the pointer (null if far away from the board) */
  pick: ((clientX: number, clientY: number) => [number, number] | null) | null;
  /** current on-screen size (px) of one cell of MY board */
  cellPx: (() => number) | null;
  /** on-screen position (px, relative to the 3D canvas) of a (fractional) cell of MY board */
  cellToScreen: ((r: number, c: number) => { x: number; y: number }) | null;
  /** on-screen rectangle (px, relative to the 3D canvas) reserved for the player panels */
  infoRect: (() => { left: number; top: number; width: number; height: number; stacked: boolean }) | null;
  /** on-screen rectangle of the days (strip = the phone's one-week window) */
  trackRect: (() => { left: number; top: number; width: number; height: number; strip: boolean }) | null;
} = { pick: null, cellPx: null, cellToScreen: null, infoRect: null, trackRect: null };
