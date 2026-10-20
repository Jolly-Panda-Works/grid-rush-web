import { SHAPE_IDS } from '../../../shared/src';

// Google brand palette (brandcolorcode.com/google): #4285F4 blue, #EA4335 red, #FBBC05 yellow, #34A853 green
export const G = { blue: '#4285F4', red: '#EA4335', yellow: '#FBBC05', green: '#34A853' };
export const PLAYER_COLORS = [G.blue, G.red] as const;
export const UI = {
  bg: '#F4F7FE', board: '#FFFFFF', gridLine: '#E3E8F4', plate: '#DCE4F5',
  coin: G.yellow, success: G.green, error: G.red, primary: G.green, secondary: G.blue, accent: G.yellow,
};

export function shapeColor(shape: string): string {
  if (shape === 'mono') return G.green;
  const i = Math.max(0, SHAPE_IDS.indexOf(shape));
  const hue = (i * 137.5 + 8) % 360;
  return `hsl(${hue.toFixed(0)}, 72%, 56%)`;
}
