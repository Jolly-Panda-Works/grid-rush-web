import { SHAPE_IDS } from '../../../shared/src';

export const PLAYER_COLORS = ['#2F80FF', '#FF5A5F'] as const;
export const UI = {
  primary: '#6C5CE7', secondary: '#00D9C0', accent: '#FF6B35', bg: '#12121C', surface: '#1E1E2E',
  gridLine: '#2A2A3D', coin: '#FFC94D', success: '#43D17A', error: '#FF5C5C',
};

export function shapeColor(shape: string): string {
  if (shape === 'mono') return UI.primary;
  const i = Math.max(0, SHAPE_IDS.indexOf(shape));
  const hue = (i * 137.5 + 20) % 360;
  return `hsl(${hue.toFixed(0)}, 58%, 56%)`;
}
