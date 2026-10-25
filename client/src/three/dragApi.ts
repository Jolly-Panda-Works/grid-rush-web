/** Lets DOM drag-and-drop (tile offer cards) talk to the 3D scene. */
export const dragApi: {
  /** which cell of MY board is under the pointer (null if far away from the board) */
  pick: ((clientX: number, clientY: number) => [number, number] | null) | null;
  /** current on-screen size (px) of one cell of MY board */
  cellPx: (() => number) | null;
  /** on-screen position (px, relative to the 3D canvas) of a (fractional) cell of MY board */
  cellToScreen: ((r: number, c: number) => { x: number; y: number }) | null;
} = { pick: null, cellPx: null, cellToScreen: null };
