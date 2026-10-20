import type { Cell, Rng, TileDef } from './types';

export const SHAPES: Record<string, { rows: string[]; weight: number }> = {
  domino: { rows: ['XX'], weight: 2 },
  i3: { rows: ['XXX'], weight: 3 },
  l3: { rows: ['X.', 'XX'], weight: 3 },
  i4: { rows: ['XXXX'], weight: 2 },
  l4: { rows: ['X.', 'X.', 'XX'], weight: 3 },
  t4: { rows: ['XXX', '.X.'], weight: 3 },
  s4: { rows: ['.XX', 'XX.'], weight: 3 },
  o4: { rows: ['XX', 'XX'], weight: 3 },
  p5: { rows: ['XX', 'XX', 'X.'], weight: 1.2 },
  l5: { rows: ['X.', 'X.', 'X.', 'XX'], weight: 1.2 },
  y5: { rows: ['.X', 'XX', '.X', '.X'], weight: 1.2 },
  n5: { rows: ['.X', '.X', 'XX', 'X.'], weight: 1.2 },
  t5: { rows: ['XXX', '.X.', '.X.'], weight: 1.2 },
  u5: { rows: ['X.X', 'XXX'], weight: 1.2 },
  v5: { rows: ['X..', 'X..', 'XXX'], weight: 1.2 },
  w5: { rows: ['X..', 'XX.', '.XX'], weight: 1.2 },
  x5: { rows: ['.X.', 'XXX', '.X.'], weight: 1 },
  z5: { rows: ['XX.', '.X.', '.XX'], weight: 1.2 },
  f5: { rows: ['.XX', 'XX.', '.X.'], weight: 1.2 },
  i5: { rows: ['XXXXX'], weight: 1 },
};
export const MONO_SHAPE = 'mono';
export const SHAPE_IDS = [...Object.keys(SHAPES), MONO_SHAPE];

export function parseRows(rows: string[]): Cell[] {
  const out: Cell[] = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'X') out.push([r, c]); }));
  return out;
}

export function shapeCells(shape: string): Cell[] {
  if (shape === MONO_SHAPE) return [[0, 0]];
  return parseRows(SHAPES[shape].rows);
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function makeTile(uid: number, rng: Rng): TileDef {
  const ids = Object.keys(SHAPES);
  const total = ids.reduce((s, id) => s + SHAPES[id].weight, 0);
  let roll = rng() * total;
  let shape = ids[0];
  for (const id of ids) {
    roll -= SHAPES[id].weight;
    if (roll <= 0) { shape = id; break; }
  }
  const cells = shapeCells(shape);
  const n = cells.length;
  let timeCost = clamp(Math.round(n * 0.55 + (rng() * 2 - 1) * 1.2), 0, 6);
  let coinCost = clamp(Math.round(n * 0.45 + (rng() * 2 - 1) * 1.4), 0, 4);
  // CONFIRMED: at least one of the two costs must exist.
  if (timeCost === 0 && coinCost === 0) { if (rng() < 0.5) timeCost = 1; else coinCost = 1; }
  const e = rng();
  const engraved = e < 0.3 ? 0 : e < 0.65 ? 1 : e < 0.9 ? 2 : 3;
  return { uid, shape, cells, timeCost, coinCost, engraved };
}
