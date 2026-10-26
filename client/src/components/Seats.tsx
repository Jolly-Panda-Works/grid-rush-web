import { useEffect, useRef, useState } from 'react';
import { BOARD_SIZE, COIN_SCORE_DIVISOR, EMPTY_CELL_PENALTY, Seat, TRACK_LENGTH, TURN_SECONDS, scoreOf } from '../../../shared/src';
import { useT } from '../i18n';
import { avatarFor, avatarUrl, isHero } from './Medal';
import { useStore } from '../store';
import { Icon } from '../art';
import { CoinIcon, PlayerGlyph } from './TileShape';
import { NextGem, TrackLine } from './TrackBar';
import { GameMenu } from './GameMenu';
import { dragApi } from '../three/dragApi';

/** Seconds left in the current turn (null = no timer, e.g. offline bot games). */
function useTurnLeft(): number | null {
  const turnLeft = useStore((s) => s.turnLeft);
  const recv = useStore((s) => s.turnRecvAt);
  const [, tick] = useState(0);
  useEffect(() => { if (turnLeft === null) return; const i = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(i); }, [turnLeft]);
  return turnLeft === null ? null : Math.max(0, Math.round(turnLeft - (performance.now() - recv) / 1000));
}

/** Card-game style hero portrait: a glazed tile medallion with the player's marker, a gold rim,
 *  and (on the active player) a glowing ring that burns down with the turn timer. */
export function Portrait({ seat, size = 58 }: { seat: Seat; size?: number }) {
  const g = useStore((s) => s.game)!;
  const active = g.current === seat && g.phase !== 'finished';
  const left = useTurnLeft();
  const frac = active && left !== null ? Math.min(1, left / TURN_SECONDS) : 1;
  const R = 46, CIRC = 2 * Math.PI * R;
  const mySeat = useStore((s) => s.mySeat);
  const myAvatar = useStore((s) => s.profile.avatar);
  const av = seat === mySeat ? myAvatar : avatarFor(g.players[seat].name);
  const face = avatarUrl(av);
  return (
    <div className={'portrait p' + seat + (active ? ' active' : '') + (active && left !== null && left <= 10 ? ' low' : '')} style={{ width: size, height: size }}>
      <svg className="pring" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={R} className="pr-bg" />
        {active && <circle cx="50" cy="50" r={R} className="pr-fg" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - frac)} transform="rotate(-90 50 50)" />}
      </svg>
      <div className={'pface' + (isHero(av) ? ' hero' : '')} style={{ backgroundImage: `url(${face})` }} />
      <span className="pglyph"><PlayerGlyph seat={seat} size={Math.max(12, size * 0.26)} /></span>
      {active && left !== null && <span className="psecs num">{left}</span>}
    </div>
  );
}

/** "+3" / "−2" floating up from a counter whenever its value changes. */
export function CoinDelta({ value }: { value: number }) {
  const prev = useRef(value);
  const [items, setItems] = useState<{ id: number; d: number }[]>([]);
  useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    if (!d) return;
    const id = performance.now();
    setItems((xs) => [...xs.slice(-2), { id, d }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 1600); // each floater lives its full time
  }, [value]);
  return <>{items.map((x) => <span key={x.id} className={'cdelta num ' + (x.d > 0 ? 'up' : 'down')} dir="ltr">{x.d > 0 ? '+' : '−'}{Math.abs(x.d)}</span>)}</>;
}

/** Coins + empty cells as gems; the number pops whenever it changes. Tap for the full score breakdown. */
export function SeatStats({ seat, compact = false }: { seat: Seat; compact?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const p = g.players[seat];
  const sc = scoreOf(g, seat);
  return (
    <div className={'sstats' + (compact ? ' compact' : '')} data-seat={seat} role="button" tabIndex={0} onClick={() => setOpen((o) => !o)}>
      <span className="gem coin" title={t('hud.coins')}><CoinIcon size={16} /><b key={p.coins} className="num bump">{p.coins}</b><CoinDelta value={p.coins} /></span>
      <span className="gem empty" title={t('hud.empty', { p: EMPTY_CELL_PENALTY })}><Icon id="empty-cell" size={17} /><b key={sc.emptyCells} className="num bump">{sc.emptyCells}</b></span>
      {seat === mySeat && <NextGem />}
      {open && (
        <div className="pdetail" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
          <div className="dhead">{t('hud.scoreNow')}</div>
          <div><span>{t('res.coinsHalf', { c: sc.coins, d: COIN_SCORE_DIVISOR })}</span><b className="num">{sc.coinPoints}</b></div>
          {sc.bonus > 0 && <div><span>{t('res.bonus')}</span><b className="num">+{sc.bonus}</b></div>}
          <div><span>{t('res.empty', { n: sc.emptyCells, p: EMPTY_CELL_PENALTY })}</span><b className="num" dir="ltr">−{sc.penalty}</b></div>
          <div className="dtotal"><span>{t('res.final')}</span><b className="num" dir="ltr">{sc.total}</b></div>
          <div><span>{t('hud.position')}</span><b className="num">{p.pos}/{TRACK_LENGTH}</b></div>
          <div><span>{t('hud.filled')}</span><b className="num">{BOARD_SIZE * BOARD_SIZE - sc.emptyCells}/{BOARD_SIZE * BOARD_SIZE}</b></div>
        </div>
      )}
    </div>
  );
}

/** A portrait with the score-lead and 7x7 badges on it (badges never change the layout). */
export function SeatPortrait({ seat, size }: { seat: Seat; size: number }) {
  const t = useT();
  const g = useStore((s) => s.game)!;
  const lead = scoreOf(g, seat).total - scoreOf(g, (1 - seat) as Seat).total;
  return (
    <div className="pwrap">
      <Portrait seat={seat} size={size} />
      {lead > 0 && <span className="pbadge num" title={t('hud.scoreNow')}>+{lead}</span>}
      {g.players[seat].bonus7 && <span className="pbadge b7">7×7</span>}
    </div>
  );
}

/** One player's panel: portrait, name and gems. It gets a frame in the player's colour while it is their turn. */
function PlayerPanel({ seat }: { seat: Seat }) {
  const t = useT();
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const p = g.players[seat];
  const active = g.current === seat && g.phase !== 'finished';
  return (
    <section className={'ppanel p' + seat + (active ? ' active' : '')} aria-current={active ? 'true' : undefined}>
      <SeatPortrait seat={seat} size={40} />
      <div className="ppbody">
        <span className="ppname">
          <span className="n">{seat === mySeat ? t('you') : p.name}</span>
          {!p.connected && <span className="tag warn">{t('offline')}</span>}
        </span>
        <SeatStats seat={seat} compact />
      </div>
    </section>
  );
}

/** Both players' panels, one under the other, in the space the table layout keeps free next to the opponent board
 *  (opponent on top, me below). Fixed in place: nothing in them can move the boards. */
export function PlayerPanels() {
  useStore((s) => s.layoutTick); // re-measure when the 3D layout changes
  const mySeat = useStore((s) => s.mySeat);
  const r = dragApi.infoRect?.();
  if (!r || r.width < 60) return null;
  return (
    <div className={'ppanels' + (r.stacked ? '' : ' row')} style={{ left: Math.max(6, r.left), top: r.top, width: r.width, height: r.height }}>
      <PlayerPanel seat={(1 - mySeat) as Seat} />
      <PlayerPanel seat={mySeat} />
    </div>
  );
}

/** Top of the table: the whole time track as one slim line, and the menu button. */
export function OppBar() {
  return (
    <header className="oppbar slim">
      <TrackLine />
      <GameMenu />
    </header>
  );
}
