import { useEffect, useRef, useState } from 'react';
import { BOARD_SIZE, EMPTY_CELL_PENALTY, Seat, TRACK_LENGTH, TURN_SECONDS, scoreOf } from '../../../shared/src';
import { useT } from '../i18n';
import { useStore } from '../store';
import { CoinIcon, EmptyIcon, PlayerGlyph } from './TileShape';

/** One player: name, coins, empty cells and who is ahead. Tap the card for the full score breakdown. */
function PlayerCard({ seat, align }: { seat: Seat; align: 'left' | 'right' }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const p = g.players[seat];
  const active = g.current === seat && g.phase !== 'finished';
  const sc = scoreOf(g, seat);
  const lead = sc.total - scoreOf(g, (1 - seat) as Seat).total;
  const filled = BOARD_SIZE * BOARD_SIZE - sc.emptyCells;
  return (
    <div className={`pcard ${align} ${active ? 'active' : ''} p${seat}`} role="button" tabIndex={0} aria-expanded={open}
      onClick={() => setOpen((o) => !o)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen((o) => !o)}>
      <div className="prow">
        <PlayerGlyph seat={seat} size={14} />
        <span className="n">{p.name}</span>
        {seat === mySeat ? <span className="tag">{t('you')}</span> : p.isBot ? <span className="tag bot">{t('bot')}</span> : null}
        {!p.connected && <span className="tag warn">{t('offline')}</span>}
      </div>
      <div className="prow stats">
        <span className="stat coins" title={t('hud.coins')}><CoinIcon size={15} /><b className="num">{p.coins}</b><CoinDelta value={p.coins} /></span>
        <span className="stat empty" title={t('hud.empty', { p: EMPTY_CELL_PENALTY })}><EmptyIcon size={14} /><b className="num">{sc.emptyCells}</b></span>
        {lead > 0 && <span className="lead num" title={t('hud.scoreNow')}><b dir="ltr">+{lead}</b> {t('hud.lead')}</span>}
        {lead === 0 && seat === mySeat && <span className="lead tie" title={t('hud.scoreNow')}>{t('hud.tied')}</span>}
        {p.bonus7 && <span className="tag good">7×7</span>}
      </div>
      {open && (
        <div className="pdetail" onClick={(e) => e.stopPropagation()}>
          <div className="dhead">{t('hud.scoreNow')}</div>
          <div><span>{t('res.coins')}</span><b className="num">{sc.coins}</b></div>
          {sc.bonus > 0 && <div><span>{t('res.bonus')}</span><b className="num">+{sc.bonus}</b></div>}
          <div><span>{t('res.empty', { n: sc.emptyCells, p: EMPTY_CELL_PENALTY })}</span><b className="num" dir="ltr">−{sc.penalty}</b></div>
          <div className="dtotal"><span>{t('res.final')}</span><b className="num" dir="ltr">{sc.total}</b></div>
          <div><span>{t('hud.position')}</span><b className="num">{p.pos}/{TRACK_LENGTH}</b></div>
          <div><span>{t('hud.filled')}</span><b className="num">{filled}/{BOARD_SIZE * BOARD_SIZE}</b></div>
          <div><span>{t('menu.lv', { n: p.level })}</span><b className="num">{t('menu.rating', { n: p.rating })}</b></div>
        </div>
      )}
    </div>
  );
}

/** Fixed-size centre block (no layout jumps): whose turn it is in words, an arrow to that player, and a timer ring. */
export function TurnPill() {
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const turnLeft = useStore((s) => s.turnLeft);
  const recv = useStore((s) => s.turnRecvAt);
  const t = useT();
  const [, tick] = useState(0);
  useTick(() => tick((n) => n + 1), turnLeft !== null);
  const mine = g.current === mySeat;
  const left = turnLeft === null ? null : Math.max(0, Math.round(turnLeft - (performance.now() - recv) / 1000));
  const finished = g.phase === 'finished';
  const R = 13, CIRC = 2 * Math.PI * R;
  const frac = left === null ? 1 : Math.min(1, left / TURN_SECONDS);
  return (
    <div className={'turnpill ' + (finished ? 'done' : mine ? 'me' : 'opp') + (left !== null && left <= 10 ? ' low' : '')}
      title={mine ? t('turn.you') : t('turn.opp')} aria-live="polite">
      <span className="tlabel">{finished ? t('turn.overShort') : mine ? t('turn.youShort') : t('turn.oppShort')}</span>
      <span className="trow">
        <span className="arrow" aria-hidden="true">{!finished && mine ? '◀' : ''}</span>
        <span className={'ring' + (left === null ? ' off' : '')}>
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r={R} className="rbg" />
            <circle cx="16" cy="16" r={R} className="rfg" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - frac)} transform="rotate(-90 16 16)" />
          </svg>
          <span className="secs num">{left === null || finished ? '' : left}</span>
        </span>
        <span className="arrow" aria-hidden="true">{!finished && !mine ? '▶' : ''}</span>
      </span>
    </div>
  );
}

/** "+3" / "−2" floating up from a counter whenever its value changes (shown where the change happens). */
function CoinDelta({ value }: { value: number }) {
  const prev = useRef(value);
  const [items, setItems] = useState<{ id: number; d: number }[]>([]);
  useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    if (!d) return;
    const id = performance.now();
    setItems((xs) => [...xs.slice(-2), { id, d }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 1600); // not cleared on the next change, each floater lives its full time
  }, [value]);
  return <>{items.map((x) => <span key={x.id} className={'cdelta num ' + (x.d > 0 ? 'up' : 'down')} dir="ltr">{x.d > 0 ? '+' : '−'}{Math.abs(x.d)}</span>)}</>;
}

function useTick(fn: () => void, on: boolean) {
  useEffect(() => { if (!on) return; const i = setInterval(fn, 500); return () => clearInterval(i); }, [on]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function Hud() {
  const mySeat = useStore((s) => s.mySeat);
  const opp = (1 - mySeat) as Seat;
  return (
    <header className="hud">
      <PlayerCard seat={mySeat} align="left" />
      <div className="hudmid"><TurnPill /></div>
      <PlayerCard seat={opp} align="right" />
    </header>
  );
}
