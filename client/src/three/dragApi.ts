/** Lets DOM drag-and-drop (tile offer cards) ask the 3D scene which board cell is under the pointer. */
export const dragApi: { pick: ((clientX: number, clientY: number) => [number, number] | null) | null } = { pick: null };
