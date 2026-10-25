import { useMemo } from 'react';
import { BOARD_SIZE, PlacedTile } from '../../../shared/src';
import { patternUrl, tileLook } from '../patterns';

/** A finished (or in-progress) board as a flat picture: every piece in its fabric, seams between pieces.
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
      <rect x={0} y={0} width={N} height={N} fill="#FFF4DC" />
      {showEmpty && owner.map((u, i) => u === 0 && (
        <rect key={'e' + i} x={(i % N) + 0.06} y={Math.floor(i / N) + 0.06} width={0.88} height={0.88} rx={0.08}
          fill={marked?.has(i) ? '#F7B5A8' : '#EADBB2'} stroke={marked?.has(i) ? '#C0503F' : 'none'} strokeWidth={0.05} />
      ))}
      {looks.map(({ t, look }) => t.cells.map(([r, c], k) => {
        // grow each cell towards neighbours of the same piece, so a piece is one patch with seams only at its border
        const same = (rr: number, cc: number) => rr >= 0 && cc >= 0 && rr < N && cc < N && owner[rr * N + cc] === t.uid;
        const x0 = c + (same(r, c - 1) ? 0 : seam), x1 = c + 1 - (same(r, c + 1) ? 0 : seam);
        const y0 = r + (same(r - 1, c) ? 0 : seam), y1 = r + 1 - (same(r + 1, c) ? 0 : seam);
        return <rect key={`${t.uid}-${k}`} x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={`url(#ba-${t.uid})`} stroke={look.color} strokeWidth={0.02} />;
      }))}
      {tiles.map((t) => t.cells.slice(0, t.engraved).map(([r, c], k) => (
        <circle key={`co-${t.uid}-${k}`} cx={c + 0.5} cy={r + 0.5} r={0.2} fill="#FFC94D" stroke="#8a6200" strokeWidth={0.05} />
      )))}
    </svg>
  );
}
