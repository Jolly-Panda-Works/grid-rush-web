import type { Cell } from '../../../shared/src';
import { shapeColor } from '../three/colors';

export function TileShape({ cells, shape, engraved = 0, cell = 14 }: { cells: Cell[]; shape: string; engraved?: number; cell?: number }) {
  const h = Math.max(...cells.map((c) => c[0])) + 1, w = Math.max(...cells.map((c) => c[1])) + 1;
  const color = shapeColor(shape);
  return (
    <svg width={w * cell} height={h * cell} viewBox={`0 0 ${w * cell} ${h * cell}`} aria-label={`${shape} tile`}>
      {cells.map(([r, c], i) => (
        <g key={i}>
          <rect x={c * cell + 1} y={r * cell + 1} width={cell - 2} height={cell - 2} rx={3} fill={color} />
          {i < engraved && <circle cx={c * cell + cell / 2} cy={r * cell + cell / 2} r={cell * 0.26} fill="#FFC94D" stroke="#7a5a00" strokeWidth={1} />}
        </g>
      ))}
    </svg>
  );
}
export const CoinIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#FFC94D" stroke="#B88A00" /><path d="M5 5h2v2H5zM9 5h2v2H9zM5 9h2v2H5z" fill="#8a6200" /></svg>
);
export const TimeIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#00D9C0" strokeWidth="1.6" /><path d="M8 4v4.2l2.8 1.6" fill="none" stroke="#00D9C0" strokeWidth="1.6" strokeLinecap="square" /></svg>
);
export const PlayerGlyph = ({ seat, size = 16 }: { seat: 0 | 1; size?: number }) => seat === 0
  ? <svg width={size} height={size} viewBox="0 0 16 16" aria-label="circle"><circle cx="8" cy="8" r="6.5" fill="#2F80FF" /></svg>
  : <svg width={size} height={size} viewBox="0 0 16 16" aria-label="diamond"><path d="M8 1l7 7-7 7-7-7z" fill="#FF5A5F" /></svg>;
