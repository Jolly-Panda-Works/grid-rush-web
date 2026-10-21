import { useRef } from 'react';
import { TRACK_LENGTH, TREASURE_POSITIONS, canPlaceAny, engravedTotal, transformCells } from '../../../shared/src';
import { useT, tr } from '../i18n';
import { send } from '../net';
import { flipHorizontal, flipVertical, pushToast, resetSel, setSel, useStore } from '../store';
import { dragApi } from '../three/dragApi';
import { previewFor } from '../three/placement';
import { CoinIcon, TileShape, TimeIcon } from './TileShape';
import { sfx } from '../audio';

const DRAG_THRESHOLD = 8;

/** The panel is always visible. When it is not the player's turn everything is simply locked (not clickable). */
export function OfferPanel() {
  const t = useT();
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const sel = useStore((s) => s.sel);
  const me = g.players[mySeat], opp = g.players[1 - mySeat];
  const finished = g.phase === 'finished';
  const myTurn = g.current === mySeat && g.phase === 'playing';
  const placing = g.current === mySeat && g.phase === 'placing_reward';
  const locked = !myTurn;
  const suppressClick = useRef(false);

  /** Drag a card onto the board: live preview while moving, buy on drop (if it fits). */
  const startDrag = (e: React.PointerEvent, i: number) => {
    if (locked || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const st0 = { x: e.clientX, y: e.clientY, active: false };
    const off = e.pointerType === 'touch' ? -56 : 0; // keep the tile visible above the finger
    const move = (ev: PointerEvent) => {
      if (!st0.active) {
        if (Math.hypot(ev.clientX - st0.x, ev.clientY - st0.y) < DRAG_THRESHOLD) return;
        st0.active = true;
        if (useStore.getState().sel.offer !== i) setSel({ offer: i, rot: 0, flip: false, hover: null });
      }
      useStore.setState({ drag: { x: ev.clientX, y: ev.clientY + off } });
      setSel({ hover: dragApi.pick?.(ev.clientX, ev.clientY + off) ?? null });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      useStore.setState({ drag: null });
      if (!st0.active) return;
      suppressClick.current = true;
      setTimeout(() => { suppressClick.current = false; }, 0);
      const st = useStore.getState();
      const cell = ev.type === 'pointercancel' ? null : dragApi.pick?.(ev.clientX, ev.clientY + off) ?? null;
      if (!cell || !st.game || st.sel.offer === null) { setSel({ hover: null }); return; } // dropped elsewhere: tile stays selected
      const pv = previewFor(st.game, st.mySeat, { ...st.sel, hover: cell });
      if (pv && pv.valid) { send.buy(st.sel.offer, pv.abs); sfx.place(); resetSel(); }
      else { sfx.bad(); pushToast(tr('toast.noFit'), 'bad'); setSel({ hover: null }); }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const nextTile = g.next;
  // RULE v0.4: Advance jumps to exactly (opponent position + 1)
  const advSteps = Math.min(TRACK_LENGTH - me.pos, Math.max(1, opp.pos + 1 - me.pos));
  const advEnds = me.pos + advSteps >= TRACK_LENGTH;
  const selTile = !locked && sel.offer !== null ? g.offer[sel.offer] : null;

  let hint: { cls: string; text: string };
  if (finished) hint = { cls: 'wait', text: t('offer.over') };
  else if (placing) hint = { cls: 'place', text: t('offer.placeReward', { n: g.pendingRewards }) };
  else if (!myTurn) hint = { cls: 'wait', text: t('offer.playing', { name: opp.name, bot: opp.isBot ? t('offer.botSuffix') : '' }) };
  else if (selTile) {
    const np = Math.min(TRACK_LENGTH, me.pos + selTile.timeCost);
    const tre = TREASURE_POSITIONS.filter((p) => p > me.pos && p <= np).length;
    const gain = tre * (engravedTotal(me) + selTile.engraved);
    hint = { cls: '', text: `${np > opp.pos ? t('offer.passes') : t('offer.keeps')}${tre ? ` · ${t('offer.tre', { n: tre, c: gain })}` : ''}${np >= TRACK_LENGTH ? ` · ${t('offer.ends')}` : ''}` };
  } else hint = { cls: '', text: t('offer.hint') };

  const select = (i: number) => { sfx.turn(); setSel({ offer: sel.offer === i ? null : i, rot: 0, flip: false, hover: null }); };

  return (
    <footer className={'panel' + (locked ? ' locked' : '')} aria-disabled={locked}>
      <div className="offers">
        {g.offer.map((tile, i) => {
          const afford = me.coins >= tile.coinCost;
          const fits = canPlaceAny(me.board, tile.cells);
          const blocked = !afford || !fits;
          const shown = !locked && sel.offer === i ? transformCells(tile.cells, sel.rot, sel.flip) : tile.cells;
          return (
            <button key={tile.uid} className={'card ' + (sel.offer === i && !locked ? 'sel ' : '') + (locked ? 'locked ' : blocked ? 'dis' : '')} disabled={locked || blocked}
              onPointerDown={(e) => startDrag(e, i)} onClick={() => { if (!suppressClick.current) select(i); }}
              title={locked ? '' : !afford ? t('offer.noCoins') : !fits ? t('offer.noRoom') : t('offer.select', { n: i + 1 })}>
              <kbd>{i + 1}</kbd>
              <div className="shape"><TileShape cells={shown} shape={tile.shape} engraved={tile.engraved} cell={16} /></div>
              <div className="costs num">
                <span className={!afford ? 'bad' : ''}><CoinIcon /> {tile.coinCost}</span>
                <span><TimeIcon /> {tile.timeCost}</span>
                {tile.engraved > 0 && <span className="eng" title={t('offer.engraved')}>⛁ {tile.engraved}</span>}
              </div>
              {!locked && blocked && <div className="why">{!afford ? t('offer.needCoins') : t('offer.room')}</div>}
            </button>
          );
        })}
        {nextTile && (
          <div className="card next" title={t('offer.nextTitle')}>
            <div className="nlabel">{t('offer.next')}</div>
            <div className="shape"><TileShape cells={nextTile.cells} shape={nextTile.shape} engraved={nextTile.engraved} cell={11} /></div>
            <div className="costs num small">
              <span><CoinIcon size={12} /> {nextTile.coinCost}</span>
              <span><TimeIcon size={12} /> {nextTile.timeCost}</span>
              {nextTile.engraved > 0 && <span className="eng">⛁ {nextTile.engraved}</span>}
            </div>
          </div>
        )}
      </div>
      <div className="actions">
        <div className={'hint ' + hint.cls}>{hint.text}{hint.cls === 'wait' && !finished && <span className="dots" />}</div>
        <div className="tools">
          <button className="btn ghost" disabled={!selTile} onClick={() => setSel({ rot: (sel.rot + 1) % 4 })} title={t('offer.rotate')}><span className="ico">⟳</span><span className="lbl">{t('offer.rotate')} <kbd>R</kbd></span></button>
          <button className="btn ghost" disabled={!selTile} onClick={flipHorizontal} title={t('offer.flip')}><span className="ico">↔</span><span className="lbl">{t('offer.flip')} <kbd>F</kbd></span></button>
          <button className="btn ghost" disabled={!selTile} onClick={flipVertical} title={t('offer.flipV')}><span className="ico">↕</span><span className="lbl">{t('offer.flipV')} <kbd>V</kbd></span></button>
          <button className="btn ghost" disabled={!selTile} onClick={resetSel} title={t('offer.cancel')}><span className="ico">✕</span><span className="lbl">{t('offer.cancel')} <kbd>Esc</kbd></span></button>
        </div>
        <button className={'btn primary adv ' + (advEnds && !locked ? 'danger' : '')} disabled={locked} onClick={() => { sfx.advance(); resetSel(); send.advance(); }}>
          {t('offer.advance')} <kbd>A</kbd>
          <small>{t('offer.advInfo', { n: advSteps })}{advEnds ? t('offer.advEnds') : ''}</small>
        </button>
      </div>
    </footer>
  );
}
