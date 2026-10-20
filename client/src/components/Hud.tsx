import { useEffect, useState } from 'react';
import { REWARD_POSITIONS, TRACK_LENGTH, TREASURE_POSITIONS, BOARD_SIZE, scoreOf, Seat } from '../../../shared/src';
import { profileLevel } from '../profile';
import { useStore } from '../store';
import { CoinIcon, PlayerGlyph } from './TileShape';

function PlayerCard({ seat, align }: { seat: Seat; align: 'left' | 'right' }) {
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
        {seat === mySeat && <span className="tag">You</span>}
        {p.isBot && <span className="tag bot">Bot</span>}
        {!p.connected && <span className="tag warn">offline</span>}
      </div>
      <div className="pstats">
        <span title="Coins"><CoinIcon /> <b className="num">{p.coins}</b></span>
        <span title="Cells filled" className="num">{filled}/{BOARD_SIZE * BOARD_SIZE}</span>
        <span title="Score if the game ended now" className="num score">{sc.total >= 0 ? '+' : ''}{sc.total}</span>
        {p.bonus7 && <span className="tag good">7x7</span>}
      </div>
      <div className="muted small">Lv {p.level} · {p.rating}</div>
    </div>
  );
}

function TrackBar() {
  const g = useStore((s) => s.game)!;
  const pct = (n: number) => `${(n / TRACK_LENGTH) * 100}%`;
  const [a, b] = g.players;
  const lead = a.pos - b.pos;
  return (
    <div className="trackbar" aria-label="Shared time track">
      <div className="line">
        {TREASURE_POSITIONS.map((t) => <i key={'t' + t} className="tick treasure" style={{ left: pct(t) }} title="Treasure" />)}
        {REWARD_POSITIONS.map((t, i) => !g.rewardTaken[i] && <i key={'r' + t} className="tick reward" style={{ left: pct(t) }} title="1x1 reward" />)}
        <i className="tick finish" style={{ left: '100%' }} />
        <span className="m m0" style={{ left: pct(a.pos) }}><PlayerGlyph seat={0} size={18} /></span>
        <span className="m m1" style={{ left: pct(b.pos) }}><PlayerGlyph seat={1} size={18} /></span>
      </div>
      <div className="tinfo num">
        <span>{a.pos}</span>
        <span className="muted">{lead === 0 ? 'level' : `${Math.abs(lead)} cells ${lead > 0 ? '← blue ahead' : 'red ahead →'}`} · finish at {TRACK_LENGTH}</span>
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
