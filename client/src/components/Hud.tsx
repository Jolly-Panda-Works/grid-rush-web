import { useEffect, useState } from 'react';
import { BOARD_SIZE, Seat, TRACK_LENGTH, scoreOf } from '../../../shared/src';
import { useT } from '../i18n';
import { useStore } from '../store';
import { CoinIcon, PlayerGlyph } from './TileShape';

/** One player: name, coins and score (clearly labelled). Tap the card for the rest (position, board, level, rating). */
function PlayerCard({ seat, align }: { seat: Seat; align: 'left' | 'right' }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const p = g.players[seat];
  const active = g.current === seat && g.phase !== 'finished';
  const sc = scoreOf(g, seat);
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
        <span className="stat" title={t('hud.coins')}><CoinIcon size={15} /><b className="num">{p.coins}</b></span>
        <span className="stat score" title={t('hud.score')}><small>{t('hud.scoreShort')}</small><b className="num" dir="ltr">{sc.total > 0 ? '+' : ''}{sc.total}</b></span>
        {p.bonus7 && <span className="tag good">7×7</span>}
      </div>
      {open && (
        <div className="pdetail" onClick={(e) => e.stopPropagation()}>
          <div><span>{t('hud.position')}</span><b className="num">{p.pos}/{TRACK_LENGTH}</b></div>
          <div><span>{t('hud.filled')}</span><b className="num">{filled}/{BOARD_SIZE * BOARD_SIZE}</b></div>
          <div><span>{t('menu.lv', { n: p.level })}</span><b className="num">{t('menu.rating', { n: p.rating })}</b></div>
        </div>
      )}
    </div>
  );
}

/** Fixed-size centre block (no layout jumps): an arrow pointing at the player whose turn it is, plus the timer. */
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
  return (
    <div className={'turnpill ' + (finished ? 'done' : mine ? 'me' : 'opp') + (left !== null && left <= 10 ? ' low' : '')}
      title={mine ? t('turn.you') : t('turn.opp')} aria-live="polite">
      <span className="arrow" aria-hidden="true">{finished ? '■' : mine ? '◀' : '▶'}</span>
      <span className="secs num">{left === null ? '' : `${left}`}</span>
    </div>
  );
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
