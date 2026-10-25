import type { Seat } from '../../../shared/src';
import { patternUrl, starPath, tileLook } from '../patterns';
import { PlayerGlyph } from './TileShape';

/** A hero medallion outside the game (menu, matchmaking): a painted tile face with the player's marker in a gold rim. */
export function Medal({ seat, size = 64, level }: { seat: Seat; size?: number; level?: number }) {
  const face = patternUrl(tileLook(seat === 0 ? 7 : 12, 'x'));
  return (
    <div className={'medalion p' + seat} style={{ width: size, height: size }}>
      <div className="pface" style={{ backgroundImage: `url(${face})` }}><PlayerGlyph seat={seat} size={size * 0.42} /></div>
      {level !== undefined && <span className="lvstar num" aria-label={`Lv ${level}`}>{level}</span>}
    </div>
  );
}

/** Spinning gold shamseh, used while something loads or a match is being found. */
export function Spinner({ size = 72 }: { size?: number }) {
  return (
    <svg className="shamseh-spin" width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true">
      <g className="ss-outer"><path d={starPath(16, 46, 32)} fill="#E8B730" stroke="#7a5200" strokeWidth="2" /></g>
      <g className="ss-inner"><path d={starPath(8, 27, 15)} fill="#1BA3B8" stroke="#0b5f6e" strokeWidth="2" /></g>
      <circle r="8" fill="#D8322E" stroke="#7a1a14" strokeWidth="2" />
    </svg>
  );
}
