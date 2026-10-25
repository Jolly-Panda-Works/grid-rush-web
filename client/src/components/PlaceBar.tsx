import { useEffect, useState } from 'react';
import { confirmPlacement } from '../actions';
import { useT } from '../i18n';
import { flipHorizontal, resetSel, rotate, useStore } from '../store';
import { dragApi } from '../three/dragApi';
import { inBounds, previewFor } from '../three/placement';

/** Floating controls right next to the tile ghost on my board: place it, rotate, flip, cancel.
 *  Replaces the old row of tool buttons and the "tap twice to place" gesture. */
export function PlaceBar() {
  const t = useT();
  const g = useStore((s) => s.game);
  const mySeat = useStore((s) => s.mySeat);
  const sel = useStore((s) => s.sel);
  const drag = useStore((s) => s.drag);
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  if (!g || g.current !== mySeat || drag || !sel.hover || !dragApi.cellToScreen) return null;
  const reward = g.phase === 'placing_reward';
  if (!reward && (g.phase !== 'playing' || sel.offer === null)) return null;
  const pv = previewFor(g, mySeat, sel);
  if (!pv) return null;
  const cells = pv.abs.filter(inBounds);
  if (!cells.length) return null;
  const top = Math.min(...cells.map((c) => c[0])), bottom = Math.max(...cells.map((c) => c[0]));
  const midC = (Math.min(...cells.map((c) => c[1])) + Math.max(...cells.map((c) => c[1]))) / 2;
  const above = dragApi.cellToScreen(top - 0.5, midC);
  const below = dragApi.cellToScreen(bottom + 0.5, midC);
  const flipDown = above.y < 56; // no room above the tile: show the bar under it
  const at = flipDown ? below : above;
  return (
    <div className={'placebar' + (flipDown ? ' down' : '')} style={{ left: at.x, top: at.y }} onPointerDown={(e) => e.stopPropagation()}>
      <button className="pb ok" disabled={!pv.valid} onClick={confirmPlacement} aria-label={t('place.ok')}>✓<span>{t('place.ok')}</span></button>
      {!reward && <button className="pb" onClick={rotate} aria-label={t('offer.rotate')} title={t('offer.rotate')}>⟳</button>}
      {!reward && <button className="pb" onClick={flipHorizontal} aria-label={t('offer.flip')} title={t('offer.flip')}>⇋</button>}
      {!reward && <button className="pb" onClick={resetSel} aria-label={t('offer.cancel')} title={t('offer.cancel')}>✕</button>}
    </div>
  );
}
