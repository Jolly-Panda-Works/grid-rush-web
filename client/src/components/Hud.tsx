import { useEffect, useState } from 'react';
import { TRACK_LENGTH, BOARD_SIZE, scoreOf, Seat } from '../../../shared/src';
import { profileLevel } from '../profile';
import { useT } from '../i18n';
import { useStore } from '../store';
import { CoinIcon, PlayerGlyph, TimeIcon } from './TileShape';

function PlayerCard({ seat, align }: { seat: Seat; align: 'left' | 'right' }) {
  const t = useT();
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const p = g.players[seat];
  const active = g.current === seat && g.phase !== 'finished';
  const sc = scoreOf(g, seat);
  const filled = BOARD_SIZE * BOARD_SIZE - sc.emptyCells;
  return (
    <div className={`pcard ${align} ${active ? 'active' : ''} p${seat}`}>
      <div className="pname">
        <PlayerGlyph seat={seat} />
        <span className="n">{p.name}</span>
        {seat === mySeat && <span className="tag">{t('you')}</span>}
        {p.isBot && <span className="tag bot">{t('bot')}</span>}
        {!p.connected && <span className="tag warn">{t('offline')}</span>}
      </div>
      <div className="pstats">
        <span title={t('hud.coins')}><CoinIcon /> <b className="num">{p.coins}</b></span>
        <span title={t('hud.pos')} className="num"><TimeIcon /> {p.pos}/{TRACK_LENGTH}</span>
        <span title={t('hud.cells')} className="num cells">{filled}/{BOARD_SIZE * BOARD_SIZE}</span>
        <span title={t('hud.score')} className="num score">{sc.total >= 0 ? '+' : ''}{sc.total}</span>
        {p.bonus7 && <span className="tag good">7x7</span>}
      </div>
      <div className="muted small">{t('hud.lv', { n: p.level })} · {p.rating}</div>
    </div>
  );
}

export function Timer() {
  const turnLeft = useStore((s) => s.turnLeft);
  const recv = useStore((s) => s.turnRecvAt);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(t); }, []);
  if (turnLeft === null) return null;
  const left = Math.max(0, Math.round(turnLeft - (performance.now() - recv) / 1000));
  return <span className={'timer num ' + (left <= 10 ? 'low' : '')}>{left}s</span>;
}

export function Hud() {
  const mySeat = useStore((s) => s.mySeat);
  const opp = (1 - mySeat) as Seat;
  return (
    <header className="hud">
      <PlayerCard seat={mySeat} align="left" />
      <div className="hudmid"><img className="hud-icon" src="/brand/icon-192.png" alt="Grid Rush" draggable={false} /><Timer /></div>
      <PlayerCard seat={opp} align="right" />
    </header>
  );
}
