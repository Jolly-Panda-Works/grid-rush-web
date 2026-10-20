import { useRef } from 'react';
import { TRACK_LENGTH, TREASURE_POSITIONS, canPlaceAny, engravedTotal, transformCells } from '../../../shared/src';
import { useT, tr } from '../i18n';
import { send } from '../net';
import { pushToast, resetSel, setSel, useStore } from '../store';
import { dragApi } from '../three/dragApi';
import { previewFor } from '../three/placement';
import { CoinIcon, TileShape, TimeIcon } from './TileShape';
import { sfx } from '../audio';

const DRAG_THRESHOLD = 8;

export function OfferPanel() {
  const t = useT();
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const sel = useStore((s) => s.sel);
  const me = g.players[mySeat], opp = g.players[1 - mySeat];
  const myTurn = g.current === mySeat && g.phase === 'playing';
  const placing = g.current === mySeat && g.phase === 'placing_reward';
  const suppressClick = useRef(false);

  /** Drag a card onto the board: live preview while moving, buy on drop (if it fits). */
  const startDrag = (e: React.PointerEvent, i: number) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const st0 = { x: e.clientX, y: e.clientY, active: false };
    const move = (ev: PointerEvent) => {
      if (!st0.active) {
        if (Math.hypot(ev.clientX - st0.x, ev.clientY - st0.y) < DRAG_THRESHOLD) return;
        st0.active = true;
        if (useStore.getState().sel.offer !== i) setSel({ offer: i, rot: 0, flip: false, hover: null });
      }
      useStore.setState({ drag: { x: ev.clientX, y: ev.clientY } });
      setSel({ hover: dragApi.pick?.(ev.clientX, ev.clientY) ?? null });
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
      const cell = ev.type === 'pointercancel' ? null : dragApi.pick?.(ev.clientX, ev.clientY) ?? null;
      if (!cell || !st.game || st.sel.offer === null) { setSel({ hover: null }); return; } // dropped elsewhere: tile stays selected
      const pv = previewFor(st.game, st.mySeat, { ...st.sel, hover: cell });
      if (pv && pv.valid) { send.buy(st.sel.offer, pv.abs); sfx.place(); resetSel(); }
      else { sfx.bad(); pushToast(tr('toast.noFit'), 'bad'); setSel({ hover: null }); }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  if (placing) {
    return <footer className="panel"><div className="banner accentb">{t('offer.placeReward', { n: g.pendingRewards })}</div></footer>;
  }
  const nextTile = g.next;
  const nextCard = nextTile && (
    <div className="card next" title={t('offer.nextTitle')}>
      <div className="nlabel">{t('offer.next')}</div>
      <div className="shape"><TileShape cells={nextTile.cells} shape={nextTile.shape} engraved={nextTile.engraved} cell={11} /></div>
      <div className="costs num small">
        <span><CoinIcon size={12} /> {nextTile.coinCost}</span>
        <span><TimeIcon size={12} /> {nextTile.timeCost}</span>
        {nextTile.engraved > 0 && <span className="eng">⛁ {nextTile.engraved}</span>}
      </div>
    </div>
  );
  if (!myTurn) {
    return (
      <footer className="panel">
        <div className="banner waiting">
          {g.phase === 'finished' ? t('offer.over') : t('offer.playing', { name: opp.name, bot: opp.isBot ? t('offer.botSuffix') : '' })}<span className="dots" />
        </div>
      </footer>
    );
  }
  // RULE v0.4: Advance jumps to exactly (opponent position + 1)
  const advSteps = Math.min(TRACK_LENGTH - me.pos, Math.max(1, opp.pos + 1 - me.pos));
  const advEnds = me.pos + advSteps >= TRACK_LENGTH;
  const selTile = sel.offer !== null ? g.offer[sel.offer] : null;
  let hint = '';
  if (selTile) {
    const np = Math.min(TRACK_LENGTH, me.pos + selTile.timeCost);
    const tre = TREASURE_POSITIONS.filter((p) => p > me.pos && p <= np).length;
    const gain = tre * (engravedTotal(me) + selTile.engraved);
    hint = `${np > opp.pos ? t('offer.passes') : t('offer.keeps')}${tre ? ` · ${t('offer.tre', { n: tre, c: gain })}` : ''}${np >= TRACK_LENGTH ? ` · ${t('offer.ends')}` : ''}`;
  }
  const select = (i: number) => { sfx.turn(); setSel({ offer: sel.offer === i ? null : i, rot: 0, flip: false, hover: null }); };

  return (
    <footer className="panel">
      <div className="offers">
        {g.offer.map((tile, i) => {
          const afford = me.coins >= tile.coinCost;
          const fits = canPlaceAny(me.board, tile.cells);
          const disabled = !afford || !fits;
          const shown = sel.offer === i ? transformCells(tile.cells, sel.rot, sel.flip) : tile.cells;
          return (
            <button key={tile.uid} className={'card ' + (sel.offer === i ? 'sel ' : '') + (disabled ? 'dis' : '')} disabled={disabled}
              onPointerDown={(e) => !disabled && startDrag(e, i)} onClick={() => { if (!suppressClick.current) select(i); }}
              title={!afford ? t('offer.noCoins') : !fits ? t('offer.noRoom') : t('offer.select', { n: i + 1 })}>
              <kbd>{i + 1}</kbd>
              <div className="shape"><TileShape cells={shown} shape={tile.shape} engraved={tile.engraved} cell={16} /></div>
              <div className="costs num">
                <span className={!afford ? 'bad' : ''}><CoinIcon /> {tile.coinCost}</span>
                <span><TimeIcon /> {tile.timeCost}</span>
                {tile.engraved > 0 && <span className="eng" title={t('offer.engraved')}>⛁ {tile.engraved}</span>}
              </div>
              {disabled && <div className="why">{!afford ? t('offer.needCoins') : t('offer.room')}</div>}
            </button>
          );
        })}
        {nextCard}
      </div>
      <div className="actions">
        <div className="tools">
          <button className="btn ghost" disabled={!selTile} onClick={() => setSel({ rot: (sel.rot + 1) % 4 })}>{t('offer.rotate')} <kbd>R</kbd></button>
          <button className="btn ghost" disabled={!selTile} onClick={() => setSel({ flip: !sel.flip })}>{t('offer.flip')} <kbd>F</kbd></button>
          <button className="btn ghost" disabled={!selTile} onClick={resetSel}>{t('offer.cancel')} <kbd>Esc</kbd></button>
        </div>
        <div className="hint">{selTile ? hint : t('offer.hint')}</div>
        <button className={'btn primary adv ' + (advEnds ? 'danger' : '')} onClick={() => { sfx.advance(); resetSel(); send.advance(); }}>
          {t('offer.advance')} <kbd>A</kbd>
          <small>{t('offer.advInfo', { n: advSteps })}{advEnds ? t('offer.advEnds') : ''}</small>
        </button>
      </div>
    </footer>
  );
}
