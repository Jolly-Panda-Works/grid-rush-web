import { BOARD_SIZE, EMPTY_CELL_PENALTY, Seat, levelProgress } from '../../../shared/src';
import { PlayerGlyph } from '../components/TileShape';
import { useT } from '../i18n';
import { backToMenu, startSearch } from '../net';
import { useStore } from '../store';

export default function ResultsScreen() {
  const t = useT();
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
      <h1 className={res.won ? 'win' : 'lose'}>{res.won ? t('res.win') : t('res.lose')}</h1>
      <p className="muted">{t('res.' + r.reason)}{r.tieBreak ? t('res.tie') : ''}</p>
      <div className="scoregrid">
        {order.map((seat) => {
          const p = g.players[seat], s = r.scores[seat];
          return (
            <div key={seat} className={'scorecard ' + (r.winner === seat ? 'winner' : '')}>
              <div className="pname"><PlayerGlyph seat={seat} /> <b>{p.name}</b>{seat === mySeat && <span className="tag">{t('you')}</span>}{p.isBot && <span className="tag bot">{t('bot')}</span>}</div>
              <table className="num"><tbody>
                <tr><td>{t('res.coins')}</td><td>{s.coins}</td></tr>
                <tr><td>{t('res.bonus')}</td><td>{s.bonus ? `+${s.bonus}` : '0'}</td></tr>
                <tr><td>{t('res.empty', { n: s.emptyCells, p: EMPTY_CELL_PENALTY })}</td><td dir="ltr">-{s.penalty}</td></tr>
                <tr className="total"><td>{t('res.final')}</td><td dir="ltr">{s.total}</td></tr>
              </tbody></table>
              <div className="muted small">{t('res.filled', { a: BOARD_SIZE * BOARD_SIZE - s.emptyCells, b: BOARD_SIZE * BOARD_SIZE })}</div>
            </div>
          );
        })}
      </div>
      <div className="progress num">
        <div>{t('res.rating')} <b>{res.ratingAfter}</b> <span dir="ltr" className={res.delta >= 0 ? 'up' : 'down'}>({res.delta >= 0 ? '+' : ''}{res.delta})</span></div>
        <div>{t('res.xp', { n: res.xpGain })} <b>{res.levelAfter}</b>{res.levelAfter > res.levelBefore && <span className="tag good">{t('res.levelUp')}</span>}</div>
        <div className="xp"><div style={{ width: `${Math.min(100, lp.ratio * 100)}%` }} /></div>
      </div>
      <div className="row">
        <button className="btn primary big" onClick={() => startSearch(solo)}>{t('res.again')}</button>
        <button className="btn ghost" onClick={backToMenu}>{t('res.menu')}</button>
      </div>
    </main>
  );
}
