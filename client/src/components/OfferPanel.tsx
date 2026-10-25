import { useRef } from 'react';
import { TRACK_LENGTH, canPlaceAny, transformCells } from '../../../shared/src';
import { Forecast, advanceSteps, useForecast } from '../forecast';
import { iconUrl } from '../three/icons';
import { useT, tr } from '../i18n';
import { send } from '../net';
import { pushToast, resetSel, rotate, selectOffer, setSel, useStore } from '../store';
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
        if (useStore.getState().sel.offer !== i) setSel({ offer: i, hover: null }); // keeps the rotation / flip
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
  const advSteps = advanceSteps(g, mySeat);
  const advEnds = me.pos + advSteps >= TRACK_LENGTH;
  const fc = useForecast();
  const intent = useStore((s) => s.oppIntent);
  const oppLog = useStore((s) => s.oppLog);
  const oppMove = intent && intent.seat !== mySeat && g.current === intent.seat ? intent.action : null;

  let hint: { cls: string; text: string; out?: Forecast; lead?: string };
  if (finished) hint = { cls: 'wait', text: t('offer.over') };
  else if (placing) hint = { cls: 'place', text: t('offer.placeReward', { n: g.pendingRewards }) };
  else if (oppMove) { // the bot announced its move: say it in words, with its consequences
    const lead = t(oppMove.t === 'buy' ? 'intent.buy' : oppMove.t === 'advance' ? 'intent.advance' : 'intent.reward', { name: opp.name });
    hint = fc ? { cls: 'out opp', text: `i:${fc.kind}:${fc.to}`, out: fc, lead } : { cls: 'opp', text: lead };
  } else if (!myTurn) hint = { cls: 'wait', text: oppLog ?? t('offer.playing', { name: opp.name, bot: opp.isBot ? t('offer.botSuffix') : '' }) };
  else if (fc) hint = { cls: 'out', text: `${fc.kind}:${fc.to}`, out: fc }; // what the selected tile / Advance would do
  else hint = { cls: '', text: t('offer.hint') };
  const setAdv = (on: boolean) => { if (useStore.getState().advPreview !== on) useStore.setState({ advPreview: on }); };

  // tap a card = take it (it appears on your board); tap it again = rotate it
  const select = (i: number) => { sfx.turn(); if (sel.offer === i) rotate(); else selectOffer(i); };

  return (
    <footer className={'panel' + (locked ? ' locked' : '')} aria-disabled={locked}>
      <div className="offers">
        {g.offer.map((tile, i) => {
          const afford = me.coins >= tile.coinCost;
          const fits = canPlaceAny(me.board, tile.cells);
          const blocked = !afford || !fits;
          const shown = locked ? tile.cells : transformCells(tile.cells, sel.rot, sel.flip); // rotate / flip apply to ALL shown tiles
          return (
            <button key={tile.uid} className={'card ' + (sel.offer === i && !locked ? 'sel ' : '') + (locked ? 'locked ' : blocked ? 'dis ' : '') + (oppMove?.t === 'buy' && oppMove.offer === i ? 'intent' : '')} disabled={locked || blocked}
              onPointerDown={(e) => startDrag(e, i)} onClick={() => { if (!suppressClick.current) select(i); }}
              title={locked ? '' : !afford ? t('offer.noCoins') : !fits ? t('offer.noRoom') : sel.offer === i ? t('offer.tapRotate') : t('offer.select', { n: i + 1 })}>
              {tile.engraved > 0 && (
                <span className="engbadge num" title={t('offer.engBadge', { n: tile.engraved })}><img src={iconUrl('chest')} alt="" />+{tile.engraved}</span>
              )}
              <div className="shape"><TileShape cells={shown} shape={tile.shape} uid={tile.uid} engraved={tile.engraved} cell={16} /></div>
              <div className="costs num">
                <span className={'cchip coin' + (!afford ? ' bad' : '')}><CoinIcon /> {tile.coinCost}</span>
                <span className="cchip time"><TimeIcon /> {tile.timeCost}</span>
              </div>
              {!locked && blocked && <span className="why">{!afford ? t('offer.short', { n: tile.coinCost - me.coins }) : t('offer.room')}</span>}
            </button>
          );
        })}
        {nextTile && (
          <div className="card next" title={t('offer.nextTitle')}>
            <div className="nlabel">{t('offer.next')}</div>
            <div className="shape"><TileShape cells={locked ? nextTile.cells : transformCells(nextTile.cells, sel.rot, sel.flip)} shape={nextTile.shape} uid={nextTile.uid} engraved={nextTile.engraved} cell={11} /></div>
            <div className="costs num small">
              <span><CoinIcon size={12} /> {nextTile.coinCost}</span>
              <span><TimeIcon size={12} /> {nextTile.timeCost}</span>
            </div>
          </div>
        )}
      </div>
      <div className="actions">
        <div className={'hint ' + hint.cls}>
          {hint.out ? <Outcome key={hint.text} fc={hint.out} oppName={opp.name} mine={hint.out.seat === mySeat} lead={hint.lead} /> : (
            <span key={hint.text} className="hint-t">{hint.text}{hint.cls === 'wait' && !finished && <span className="dots" />}</span>
          )}
        </div>
        {/* finger down / mouse over = preview the jump on the track; releasing on the button confirms it */}
        <button className={'btn primary adv ' + (advEnds && !locked ? 'danger ' : '') + (oppMove?.t === 'advance' ? 'intent' : '')} disabled={locked}
          onPointerEnter={(e) => { if (e.pointerType === 'mouse' && sel.offer === null) setAdv(true); }}
          onPointerDown={() => { if (sel.offer !== null) resetSel(); setAdv(true); }}
          onPointerLeave={() => setAdv(false)} onPointerCancel={() => setAdv(false)}
          onClick={() => { setAdv(false); sfx.advance(); resetSel(); send.advance(); }}>
          <span className="advtop">{t('offer.advance')} <kbd>A</kbd></span>
          <span className="advgain num"><CoinIcon size={18} /> +{advSteps}</span>
          <small>{t('offer.advCells', { n: advSteps })}{advEnds ? ` · ${t('offer.advEnds')}` : ''}</small>
        </button>
      </div>
    </footer>
  );
}

/** Plain-language result of the action being previewed (mine) or announced (the opponent's): who plays next, plus what it collects or ends. */
function Outcome({ fc, oppName, mine, lead }: { fc: Forecast; oppName: string; mine: boolean; lead?: string }) {
  const t = useT();
  const next = mine ? (fc.passes ? t('out.pass', { name: oppName }) : t('out.keep')) : (fc.passes ? t('out.yourNext') : t('out.oppAgain', { name: oppName }));
  return (
    <span className="outcome">
      {lead && <span className="olead">{lead}</span>}
      <span className={'ochip ' + (fc.passes ? 'pass' : 'keep')}>{next}</span>
      {fc.advanceCoins > 0 && <span className="ochip gain num"><CoinIcon size={13} /> {t('out.coins', { c: fc.advanceCoins })}</span>}
      {fc.treasures.length > 0 && <span className="ochip gain num"><img src={iconUrl('chest')} alt="" /> {t('out.tre', { c: fc.treasureCoins })}</span>}
      {fc.rewards.length > 0 && <span className="ochip reward">{t('out.reward')}</span>}
      {fc.ends && <span className="ochip end">{t('out.ends')}</span>}
    </span>
  );
}
