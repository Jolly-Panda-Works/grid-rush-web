import { BOARD_SIZE, EMPTY_CELL_PENALTY, Seat, levelProgress } from '../../../shared/src';
import { PlayerGlyph } from '../components/TileShape';
import { backToMenu, startSearch } from '../net';
import { useStore } from '../store';

const REASONS: Record<string, string> = {
  track_end: 'Someone reached the end of the time track',
  board_full: 'A board was completely filled',
  forfeit: 'A player resigned or disconnected',
  timeout: 'A player stopped responding',
};

export default function ResultsScreen() {
  const g = useStore((s) => s.game);
  const res = useStore((s) => s.result);
  const mySeat = useStore((s) => s.mySeat);
  const solo = useStore((s) => s.match.solo);
  if (!g?.result || !res) return null;
  const r = g.result;
  const order: Seat[] = [mySeat, (1 - mySeat) as Seat];
  const lp = levelProgress(res.xpAfter);
  return (
    <main className="screen center results">
      <h1 className={res.won ? 'win' : 'lose'}>{res.won ? 'Victory' : 'Defeat'}</h1>
      <p className="muted">{REASONS[r.reason]}{r.tieBreak ? ' · tie broken in favour of the player who ended the game' : ''}</p>
      <div className="scoregrid">
        {order.map((seat) => {
          const p = g.players[seat], s = r.scores[seat];
          return (
            <div key={seat} className={'scorecard ' + (r.winner === seat ? 'winner' : '')}>
              <div className="pname"><PlayerGlyph seat={seat} /> <b>{p.name}</b>{seat === mySeat && <span className="tag">You</span>}{p.isBot && <span className="tag bot">Bot</span>}</div>
              <table className="num"><tbody>
                <tr><td>Coins left</td><td>{s.coins}</td></tr>
                <tr><td>7x7 bonus</td><td>{s.bonus ? `+${s.bonus}` : '0'}</td></tr>
                <tr><td>{s.emptyCells} empty cells (x{EMPTY_CELL_PENALTY})</td><td>-{s.penalty}</td></tr>
                <tr className="total"><td>Final score</td><td>{s.total}</td></tr>
              </tbody></table>
              <div className="muted small">Filled {BOARD_SIZE * BOARD_SIZE - s.emptyCells}/{BOARD_SIZE * BOARD_SIZE}</div>
            </div>
          );
        })}
      </div>
      <div className="progress num">
        <div>Rating <b>{res.ratingAfter}</b> <span className={res.delta >= 0 ? 'up' : 'down'}>({res.delta >= 0 ? '+' : ''}{res.delta})</span></div>
        <div>+{res.xpGain} XP · Level <b>{res.levelAfter}</b>{res.levelAfter > res.levelBefore && <span className="tag good">Level up!</span>}</div>
        <div className="xp"><div style={{ width: `${Math.min(100, lp.ratio * 100)}%` }} /></div>
      </div>
      <div className="row">
        <button className="btn primary big" onClick={() => startSearch(solo)}>Play again</button>
        <button className="btn ghost" onClick={backToMenu}>Main menu</button>
      </div>
    </main>
  );
}
