import { useMemo } from 'react';
import { BOARD_SIZE, PlacedTile } from '../../../shared/src';
import { patternUrl, starPath, tileLook } from '../patterns';

/** A finished (or in-progress) board as a flat picture: every cell a painted square tile, wider grout between pieces.
 *  Used on the results screen and in the museum. `marked` = empty cells to highlight (end-of-game counting). */
export function BoardArt({ tiles, size = 180, marked, showEmpty = true }: { tiles: PlacedTile[]; size?: number; marked?: Set<number>; showEmpty?: boolean }) {
  const N = BOARD_SIZE;
  const owner = useMemo(() => {
    const m = new Array<number>(N * N).fill(0);
    tiles.forEach((t) => t.cells.forEach(([r, c]) => { m[r * N + c] = t.uid; }));
    return m;
  }, [tiles, N]);
  const looks = useMemo(() => tiles.map((t) => ({ t, look: tileLook(t.uid, t.shape) })), [tiles]);
  const seam = 0.06;
  return (
    <svg className="boardart" width={size} height={size} viewBox={`-0.15 -0.15 ${N + 0.3} ${N + 0.3}`} role="img">
      <defs>
        {looks.map(({ t, look }) => (
          <pattern key={t.uid} id={`ba-${t.uid}`} patternUnits="userSpaceOnUse" width={1} height={1}>
            <image href={patternUrl(look)} width={1} height={1} preserveAspectRatio="none" />
          </pattern>
        ))}
      </defs>
      <rect x={-0.15} y={-0.15} width={N + 0.3} height={N + 0.3} rx={0.3} fill="#E3A71A" />
      <rect x={0} y={0} width={N} height={N} fill="#EFE6CF" />{/* grout */}
      {showEmpty && owner.map((u, i) => u === 0 && (
        <rect key={'e' + i} x={(i % N) + 0.06} y={Math.floor(i / N) + 0.06} width={0.88} height={0.88} rx={0.08}
          fill={marked?.has(i) ? '#F7B5A8' : '#EADBB2'} stroke={marked?.has(i) ? '#C0503F' : 'none'} strokeWidth={0.05} />
      ))}
      {looks.map(({ t, look }) => t.cells.map(([r, c], k) => {
        // thin grout between the tiles of one piece, wider grout where pieces meet
        const same = (rr: number, cc: number) => rr >= 0 && cc >= 0 && rr < N && cc < N && owner[rr * N + cc] === t.uid;
        const g = (n: boolean) => (n ? 0.02 : seam);
        const x0 = c + g(same(r, c - 1)), x1 = c + 1 - g(same(r, c + 1));
        const y0 = r + g(same(r - 1, c)), y1 = r + 1 - g(same(r + 1, c));
        return <rect key={`${t.uid}-${k}`} x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={`url(#ba-${t.uid})`} />;
      }))}
      {tiles.map((t) => t.cells.slice(0, t.engraved).map(([r, c], k) => (
        <path key={`co-${t.uid}-${k}`} d={starPath(8, 9, 5.2)} transform={`translate(${c + 0.5} ${r + 0.5}) scale(0.03)`} fill="#F2C744" stroke="#8a5a00" strokeWidth={1.4} />
      )))}
    </svg>
  );
}
