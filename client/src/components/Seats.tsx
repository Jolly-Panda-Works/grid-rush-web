import { useEffect, useRef, useState } from 'react';
import { BOARD_SIZE, EMPTY_CELL_PENALTY, Seat, TRACK_LENGTH, TURN_SECONDS, scoreOf } from '../../../shared/src';
import { useT } from '../i18n';
import { patternUrl, tileLook } from '../patterns';
import { useStore } from '../store';
import { CoinIcon, EmptyIcon, PlayerGlyph } from './TileShape';
import { TrackBar } from './TrackBar';

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
  const face = patternUrl(tileLook(seat === 0 ? 7 : 12, 'x'));
  return (
    <div className={'portrait p' + seat + (active ? ' active' : '') + (active && left !== null && left <= 10 ? ' low' : '')} style={{ width: size, height: size }}>
      <svg className="pring" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={R} className="pr-bg" />
        {active && <circle cx="50" cy="50" r={R} className="pr-fg" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - frac)} transform="rotate(-90 50 50)" />}
      </svg>
      <div className="pface" style={{ backgroundImage: `url(${face})` }}><PlayerGlyph seat={seat} size={size * 0.42} /></div>
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
  const p = g.players[seat];
  const sc = scoreOf(g, seat);
  const lead = sc.total - scoreOf(g, (1 - seat) as Seat).total;
  return (
    <div className={'sstats' + (compact ? ' compact' : '')} role="button" tabIndex={0} onClick={() => setOpen((o) => !o)}>
      <span className="gem coin" title={t('hud.coins')}><CoinIcon size={16} /><b key={p.coins} className="num bump">{p.coins}</b><CoinDelta value={p.coins} /></span>
      <span className="gem empty" title={t('hud.empty', { p: EMPTY_CELL_PENALTY })}><EmptyIcon size={14} /><b key={sc.emptyCells} className="num bump">{sc.emptyCells}</b></span>
      {lead > 0 && <span className="leadrib num" title={t('hud.scoreNow')}>+{lead} {t('hud.lead')}</span>}
      {p.bonus7 && <span className="leadrib b7">7×7</span>}
      {open && (
        <div className="pdetail" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
          <div className="dhead">{t('hud.scoreNow')}</div>
          <div><span>{t('res.coins')}</span><b className="num">{sc.coins}</b></div>
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

/** Top of the table: the opponent's portrait and gems, and the time track at a glance. */
export function OppBar() {
  const t = useT();
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const opp = (1 - mySeat) as Seat;
  const p = g.players[opp];
  return (
    <header className="oppbar">
      <div className="oppseat">
        <Portrait seat={opp} size={48} />
        <div className="oppinfo">
          <div className="oppname"><span className="n">{p.name}</span>{p.isBot && <span className="tag bot">{t('bot')}</span>}{!p.connected && <span className="tag warn">{t('offline')}</span>}</div>
          <SeatStats seat={opp} compact />
        </div>
      </div>
      <TrackBar />
    </header>
  );
}
