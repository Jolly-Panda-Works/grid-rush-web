/** Lets DOM drag-and-drop (tile offer cards) talk to the 3D scene. */
export const dragApi: {
  /** which cell of MY board is under the pointer (null if far away from the board) */
  pick: ((clientX: number, clientY: number) => [number, number] | null) | null;
  /** current on-screen size (px) of one cell of MY board */
  cellPx: (() => number) | null;
} = { pick: null, cellPx: null };
