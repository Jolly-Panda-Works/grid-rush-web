import { useEffect, useState } from 'react';
import { REWARD_POSITIONS, TRACK_LENGTH, TREASURE_POSITIONS, BOARD_SIZE, scoreOf, Seat } from '../../../shared/src';
import { profileLevel } from '../profile';
import { useT } from '../i18n';
import { useStore } from '../store';
import { CoinIcon, PlayerGlyph } from './TileShape';

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
        <span title={t('hud.cells')} className="num">{filled}/{BOARD_SIZE * BOARD_SIZE}</span>
        <span title={t('hud.score')} className="num score">{sc.total >= 0 ? '+' : ''}{sc.total}</span>
        {p.bonus7 && <span className="tag good">7x7</span>}
      </div>
      <div className="muted small">{t('hud.lv', { n: p.level })} · {p.rating}</div>
    </div>
  );
}

function TrackBar() {
  const t = useT();
  const g = useStore((s) => s.game)!;
  const pct = (n: number) => `${(n / TRACK_LENGTH) * 100}%`;
  const [a, b] = g.players;
  const lead = a.pos - b.pos;
  return (
    <div className="trackbar" aria-label="Shared time track">
      <div className="line">
        {TREASURE_POSITIONS.map((tp) => <i key={'t' + tp} className="tick treasure" style={{ left: pct(tp) }} title={t('hud.treasure')} />)}
        {REWARD_POSITIONS.map((rp, i) => !g.rewardTaken[i] && <i key={'r' + rp} className="tick reward" style={{ left: pct(rp) }} title={t('hud.reward')} />)}
        <i className="tick finish" style={{ left: '100%' }} />
        <span className="m m0" style={{ left: pct(a.pos) }}><PlayerGlyph seat={0} size={18} /></span>
        <span className="m m1" style={{ left: pct(b.pos) }}><PlayerGlyph seat={1} size={18} /></span>
      </div>
      <div className="tinfo num">
        <span>{a.pos}</span>
        <span className="muted">{lead === 0 ? t('hud.level') : t('hud.leads', { name: (lead > 0 ? a : b).name, n: Math.abs(lead) })} · {t('hud.finish', { n: TRACK_LENGTH })}</span>
        <span>{b.pos}</span>
      </div>
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
      <div className="hudmid"><TrackBar /><Timer /></div>
      <PlayerCard seat={opp} align="right" />
    </header>
  );
}
