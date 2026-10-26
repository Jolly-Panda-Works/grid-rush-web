import { useRef } from 'react';
import { TRACK_LENGTH, TileDef, canPlaceAny, transformCells } from '../../../shared/src';
import { Forecast, advanceSteps, useForecast } from '../forecast';
import { iconUrl } from '../three/icons';
import { useT, tr } from '../i18n';
import { send } from '../net';
import { applyFit, pickOffer, pushToast, resetSel, rotate, selectOffer, setSel, useStore } from '../store';
import { dragApi } from '../three/dragApi';
import { bestFit, previewFor } from '../three/placement';
import { CoinIcon, TileShape, TimeIcon } from './TileShape';
import { RewardCardFace } from './RewardCard';
import { sfx } from '../audio';

const DRAG_THRESHOLD = 8;

/** My side of the table, card-game style: my portrait and gems, the hand of tile cards (fanned),
 *  the draw pile (next tile) and the Advance medallion. On the opponent's turn the hand is simply locked. */
export function OfferPanel() {
  const t = useT();
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const sel = useStore((s) => s.sel);
  const intent = useStore((s) => s.oppIntent);
  const me = g.players[mySeat];
  const myTurn = g.current === mySeat && g.phase === 'playing';
  const locked = !myTurn;
  const placing = g.current === mySeat && g.phase === 'placing_reward';
  const suppressClick = useRef(false);
  const oppMove = intent && intent.seat !== mySeat && g.current === intent.seat ? intent.action : null;

  /** Drag a card onto the board: live preview while moving, place on drop (if it fits). */
  const startDrag = (e: React.PointerEvent, i: number) => {
    if (locked || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const st0 = { x: e.clientX, y: e.clientY, active: false };
    const off = e.pointerType === 'touch' ? -56 : 0; // keep the tile visible above the finger
    const move = (ev: PointerEvent) => {
      if (!st0.active) {
        if (Math.hypot(ev.clientX - st0.x, ev.clientY - st0.y) < DRAG_THRESHOLD) return;
        st0.active = true;
        if (useStore.getState().sel.offer !== i) pickOffer(i); // with that card's own orientation
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
      if (!st.game || st.sel.offer === null) return;
      const cell = ev.type === 'pointercancel' ? null : dragApi.pick?.(ev.clientX, ev.clientY + off) ?? null;
      const pv = cell ? previewFor(st.game, st.mySeat, { ...st.sel, hover: cell }) : null;
      if (pv && pv.valid) { send.buy(st.sel.offer, pv.abs); sfx.place(); resetSel(); return; }
      // dropped where it does not fit this way round: turn it if another orientation fits right there (shown, not placed:
      // the player confirms with ✓); otherwise the ghost goes to the nearest spot where it fits
      const fit = bestFit(st.game, st.mySeat, st.sel, cell ?? undefined, cell ?? undefined);
      if (fit) { applyFit(st.sel.offer, fit); if (!fit.turned && cell) { sfx.bad(); pushToast(tr('toast.noFit'), 'bad'); } }
      else if (cell) { sfx.bad(); pushToast(tr('toast.noFit'), 'bad'); }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const advSteps = advanceSteps(g, mySeat);
  const advEnds = me.pos + advSteps >= TRACK_LENGTH;
  const setAdv = (on: boolean) => { if (useStore.getState().advPreview !== on) useStore.setState({ advPreview: on }); };
  // tap a card = take it (it appears on your board); tap it again = rotate it
  const select = (i: number) => { sfx.select(); if (sel.offer === i) rotate(); else selectOffer(i); };
  const orient = useStore((s) => s.orient);
  const n = g.offer.length;

  return (
    <footer className={'dock' + (locked ? ' locked' : '')} aria-disabled={locked}>
      <div className={'hand' + (placing ? ' holding' : '')}>
        {placing && <div className="gcard rewardcard inhand sel" aria-label={t('reward.title')}><RewardCardFace count={g.pendingRewards} /></div>}
        {g.offer.map((tile, i) => {
          const afford = me.coins >= tile.coinCost;
          const fits = canPlaceAny(me.board, tile.cells);
          const blocked = !afford || !fits;
          const picked = sel.offer === i && !locked;
          const fan = (i - (n - 1) / 2); // -1, 0, 1
          return (
            <button key={tile.uid}
              className={'gcard' + (picked ? ' sel' : '') + (locked ? ' locked' : blocked ? ' dis' : '') + (oppMove?.t === 'buy' && oppMove.offer === i ? ' intent' : '')}
              style={{ '--rot': `${fan * 7}deg`, '--drop': `${Math.abs(fan) * 8}px` } as React.CSSProperties} disabled={locked || blocked}
              onPointerDown={(e) => startDrag(e, i)} onClick={() => { if (!suppressClick.current) select(i); }}
              title={locked ? '' : !afford ? t('offer.noCoins') : !fits ? t('offer.noRoom') : picked ? t('offer.tapRotate') : t('offer.select', { n: i + 1 })}>
              <CardFace tile={tile} rot={picked ? sel.rot : orient[tile.uid]?.rot ?? 0} flip={picked ? sel.flip : orient[tile.uid]?.flip ?? false} short={!afford} />
              {!locked && blocked && <span className="stamp" dir="auto">{!afford ? t('offer.short', { n: tile.coinCost - me.coins }) : t('offer.room')}</span>}
              {picked && <span className="rothint">⟳</span>}
            </button>
          );
        })}
      </div>

      <div className="side">
        {g.next && (
          <div className="pile" title={t('offer.nextTitle')}>
            <span className="pile-back" /><span className="pile-back b2" />
            <div className="pile-top" key={g.next.uid}><TileShape cells={g.next.cells} shape={g.next.shape} uid={g.next.uid} engraved={g.next.engraved} cell={8} /></div>
            <span className="pile-l">{t('offer.next')}</span>
          </div>
        )}
        {/* finger down / mouse over = preview the jump on the track; releasing on the medallion confirms it */}
        <button className={'medal' + (advEnds && !locked ? ' danger' : '') + (oppMove?.t === 'advance' ? ' intent' : '')} disabled={locked}
          onPointerEnter={(e) => { if (e.pointerType === 'mouse' && sel.offer === null) setAdv(true); }}
          onPointerDown={() => { if (sel.offer !== null) resetSel(); setAdv(true); }}
          onPointerLeave={() => setAdv(false)} onPointerCancel={() => setAdv(false)}
          onClick={() => { setAdv(false); sfx.advance(); resetSel(); send.advance(); }}
          aria-label={`${t('offer.advance')} +${advSteps}`}>
          <span className="medal-in"><span className="hourglass">⧗</span><span className="mgain num"><CoinIcon size={13} />+{advSteps}</span></span>
          <span className="medal-l">{t('offer.advance')}</span>
        </button>
      </div>
    </footer>
  );
}

/** A tile card: tile artwork in the middle, coin cost gem (top start), time gem (top end), engraved-coin ribbon. */
function CardFace({ tile, rot, flip, short }: { tile: TileDef; rot: number; flip: boolean; short?: boolean }) {
  const t = useT();
  return (
    <>
      <span className={'cgem coin num' + (short ? ' bad' : '')}><CoinIcon size={12} />{tile.coinCost}</span>
      <span className="cgem time num"><TimeIcon size={12} />{tile.timeCost}</span>
      <span className="cart"><TileShape cells={transformCells(tile.cells, rot, flip)} shape={tile.shape} uid={tile.uid} engraved={tile.engraved} cell={18} /></span>
      {tile.engraved > 0 && <span className="cribbon num" title={t('offer.engBadge', { n: tile.engraved })}><img src={iconUrl('chest')} alt="" />+{tile.engraved}</span>}
    </>
  );
}

/** Parchment scroll over the bottom of the table: what the selected tile / Advance would do, what the bot is about to do,
 *  or what the opponent just did. Hidden when there is nothing to say (no permanent instruction text). */
export function TurnScroll() {
  const t = useT();
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const intent = useStore((s) => s.oppIntent);
  const oppLog = useStore((s) => s.oppLog);
  const fc = useForecast();
  const opp = g.players[1 - mySeat];
  const oppMove = intent && intent.seat !== mySeat && g.current === intent.seat ? intent.action : null;
  const placing = g.current === mySeat && g.phase === 'placing_reward';
  let body: React.ReactNode = null, key = '', cls = '';
  if (g.phase === 'finished') return null;
  if (placing) { key = 'place'; cls = 'place'; body = t('offer.placeReward', { n: g.pendingRewards }); }
  else if (oppMove) {
    const lead = t(oppMove.t === 'buy' ? 'intent.buy' : oppMove.t === 'advance' ? 'intent.advance' : 'intent.reward', { name: opp.name });
    key = `i:${JSON.stringify(oppMove).slice(0, 40)}`; cls = 'opp';
    body = fc ? <Outcome fc={fc} oppName={opp.name} mine={false} lead={lead} /> : lead;
  } else if (g.current !== mySeat) { if (!oppLog) return null; key = oppLog; cls = 'log'; body = oppLog; }
  else if (fc) { key = `${fc.kind}:${fc.to}:${fc.from}`; body = <Outcome fc={fc} oppName={opp.name} mine />; }
  else return null;
  return <div key={key} className={'scroll ' + cls}>{body}</div>;
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
