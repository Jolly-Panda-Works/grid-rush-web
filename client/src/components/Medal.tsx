import type { Seat } from '../../../shared/src';
import { AVATAR_COUNT, avatarArtUrl } from '../art';
import { starPath } from '../patterns';
import { PlayerGlyph } from './TileShape';

/** Avatars: painted enamel medallions in a gold rim (public/art/avatars). */
export const AVATARS: number[] = Array.from({ length: AVATAR_COUNT }, (_, i) => i);
export const avatarUrl = (i: number) => avatarArtUrl(((i % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT);
/** A stable avatar for players who did not pick one (bots, opponents): from their name. */
export const avatarFor = (name: string) => [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % AVATARS.length;

/** A hero medallion outside the game (menu, matchmaking, profile): the avatar in a gold rim, an optional level star,
 *  and the player's track marker as a small badge. */
export function Medal({ seat, size = 64, level, avatar }: { seat?: Seat; size?: number; level?: number; avatar: number }) {
  return (
    <div className="medalion" style={{ width: size, height: size }}>
      <div className="pface" style={{ backgroundImage: `url(${avatarUrl(avatar)})` }} />
      {seat !== undefined && <span className="pglyph"><PlayerGlyph seat={seat} size={Math.max(12, size * 0.24)} /></span>}
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
