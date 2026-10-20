import * as THREE from 'three';
import { SHAPE_IDS } from '../../../shared/src';

// Persian tile-work palette, sampled from the Grid Rush logo art:
// lapis (#00308D), turquoise/firouzeh (#0AB6CB), emerald (#27B67A), saffron (#FFB400), cream plaster.
export const C = {
  navy: '#001E67', lapis: '#00308D', blue: '#0152AF', azure: '#17A8F0', turquoise: '#0AB6CB',
  emerald: '#27B67A', saffron: '#FFB400', gold: '#E3A71A', terracotta: '#E5553F', rose: '#D6457E', plum: '#7B4BC4',
  cream: '#FFF4DC', sand: '#EADBB2',
};
export const PLAYER_COLORS = [C.azure, '#F0524F'] as const;
export const UI = {
  board: C.cream, gridLine: C.sand, plate: C.navy, coin: C.saffron,
  success: C.emerald, error: C.terracotta,
};

const TILE_PALETTE = [C.turquoise, C.saffron, C.emerald, C.terracotta, C.rose, C.plum, C.azure, '#8DCB4C'];
const cache = new Map<string, string>();
export function shapeColor(shape: string): string {
  const hit = cache.get(shape);
  if (hit) return hit;
  let out: string;
  if (shape === 'mono') out = C.emerald;
  else {
    const i = Math.max(0, SHAPE_IDS.indexOf(shape));
    const base = new THREE.Color(TILE_PALETTE[i % 8]);
    const v = Math.floor(i / 8);
    base.offsetHSL(0, 0, v === 1 ? -0.09 : v === 2 ? 0.09 : 0);
    out = '#' + base.getHexString();
  }
  cache.set(shape, out);
  return out;
}
