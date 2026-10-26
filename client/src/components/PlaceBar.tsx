import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cellsKey, transformCells } from '../../../shared/src';
import { confirmPlacement } from '../actions';
import { Icon } from '../art';
import { useT } from '../i18n';
import { setOrientation, useStore } from '../store';
import { dragApi } from '../three/dragApi';
import { distinctOrientations, fitsSomewhere, inBounds, previewFor } from '../three/placement';
import { TileShape } from './TileShape';

/** Floating controls right next to the tile ghost on my board: the Place button and a strip with every way the tile
 *  can face (tap one to use it; shapes that fit nowhere on the board are dimmed). */
export function PlaceBar() {
  const t = useT();
  const g = useStore((s) => s.game);
  const mySeat = useStore((s) => s.mySeat);
  const sel = useStore((s) => s.sel);
  const drag = useStore((s) => s.drag);
  const [, bump] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => { const w = box.current?.offsetWidth ?? 0; if (w && Math.abs(w - width) > 1) setWidth(w); });
  useEffect(() => { const f = () => bump((n) => n + 1); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const tile = g && sel.offer !== null ? g.offer[sel.offer] : null;
  const board = g?.players[mySeat].board;
  const shapes = useMemo(() => (tile && board ? distinctOrientations(tile.cells).map((o) => ({ ...o, fits: fitsSomewhere(board, o.cells) })) : []), [tile, board]);
  if (!g || g.current !== mySeat || drag || !sel.hover || !dragApi.cellToScreen) return null;
  const reward = g.phase === 'placing_reward';
  if (!reward && (g.phase !== 'playing' || !tile)) return null;
  const pv = previewFor(g, mySeat, sel);
  if (!pv) return null;
  const cells = pv.abs.filter(inBounds);
  if (!cells.length) return null;
  const top = Math.min(...cells.map((c) => c[0])), bottom = Math.max(...cells.map((c) => c[0]));
  const midC = (Math.min(...cells.map((c) => c[1])) + Math.max(...cells.map((c) => c[1]))) / 2;
  const above = dragApi.cellToScreen(top - 0.5, midC);
  const below = dragApi.cellToScreen(bottom + 0.5, midC);
  const showStrip = !reward && shapes.length > 1;
  const flipDown = above.y < (showStrip ? 108 : 56); // no room above the tile: show the bar under it
  const at = flipDown ? below : above;
  // keep the whole bar on screen: slide it sideways when the tile is near an edge of the board
  const stageW = box.current?.parentElement?.clientWidth ?? 0;
  const left = width && stageW ? Math.min(Math.max(at.x, width / 2 + 6), stageW - width / 2 - 6) : at.x;
  const currentKey = tile ? cellsKey(transformCells(tile.cells, sel.rot, sel.flip)) : '';
  return (
    <div ref={box} className={'placebar' + (flipDown ? ' down' : '')} style={{ left, top: at.y }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="pbrow">
        <button className="pb ok" disabled={!pv.valid} onClick={confirmPlacement} aria-label={t('place.ok')}><Icon id="confirm" size={20} /><span>{t('place.ok')}</span></button>
      </div>
      {showStrip && tile && (
        <div className="pbstrip" role="radiogroup" aria-label={t('place.shapes')}>
          {shapes.map((o) => (
            <button key={o.key} role="radio" aria-checked={o.key === currentKey} title={o.fits ? t('place.shape') : t('place.noFit')}
              className={'pbshape' + (o.key === currentKey ? ' on' : '') + (o.fits ? '' : ' nofit')} onClick={() => setOrientation({ rot: o.rot, flip: o.flip })}>
              <TileShape cells={o.cells} shape={tile.shape} uid={tile.uid} cell={6} />
            </button>
          ))}
        </div>
      )}
      {!reward && <div className="pbtip">{t('place.tip')}</div>}
    </div>
  );
}
