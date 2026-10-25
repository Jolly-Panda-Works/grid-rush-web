import type { Cell } from '../../../shared/src';
import { Icon } from '../art';
import { patternUrl, starPath, tileLook } from '../patterns';

/** A tile piece drawn with its Patchwork-style fabric (the same look as on the 3D board and in the museum). */
export function TileShape({ cells, shape, uid, engraved = 0, cell = 14 }: { cells: Cell[]; shape: string; uid: number; engraved?: number; cell?: number }) {
  const h = Math.max(...cells.map((c) => c[0])) + 1, w = Math.max(...cells.map((c) => c[1])) + 1;
  const look = tileLook(uid, shape);
  const pid = `fab-${uid}-${cell}`;
  return (
    <svg width={w * cell} height={h * cell} viewBox={`0 0 ${w * cell} ${h * cell}`} aria-label={`${shape} tile`}>
      <defs>
        <pattern id={pid} patternUnits="userSpaceOnUse" width={cell} height={cell}>
          <image href={patternUrl(look)} width={cell} height={cell} preserveAspectRatio="none" />
        </pattern>
      </defs>
      {cells.map(([r, c], i) => (
        <g key={i}>
          <rect x={c * cell + 1} y={r * cell + 1} width={cell - 2} height={cell - 2} rx={3} fill={`url(#${pid})`} stroke={look.color} strokeWidth={1} />
          {i < engraved && (
            // engraved coin = a gold shamseh (8-point star) inlaid in the tile
            <path d={starPath(8, 9, 5.2)} transform={`translate(${c * cell + cell / 2} ${r * cell + cell / 2}) scale(${(cell * 0.36) / 9})`} fill="#F2C744" stroke="#8a5a00" strokeWidth={1.2} />
          )}
        </g>
      ))}
    </svg>
  );
}
/** Painted gold coins / hourglass, drawn a little larger than the text they sit next to. */
export const CoinIcon = ({ size = 14 }: { size?: number }) => <Icon id="coins" size={Math.round(size * 1.3)} />;
export const TimeIcon = ({ size = 14 }: { size?: number }) => <Icon id="hourglass" size={Math.round(size * 1.3)} />;
export const PlayerGlyph = ({ seat, size = 16 }: { seat: 0 | 1; size?: number }) => seat === 0
  ? <svg width={size} height={size} viewBox="0 0 16 16" aria-label="circle"><circle cx="8" cy="8" r="6.5" fill="#2F80FF" /></svg>
  : <svg width={size} height={size} viewBox="0 0 16 16" aria-label="diamond"><path d="M8 1l7 7-7 7-7-7z" fill="#FF5A5F" /></svg>;
