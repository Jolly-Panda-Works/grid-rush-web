import { useEffect, useMemo, useState } from 'react';
import { BOARD_SIZE, COIN_SCORE_DIVISOR, EMPTY_CELL_PENALTY, Seat, levelProgress } from '../../../shared/src';
import { BoardArt } from '../components/BoardArt';
import { Popup } from '../components/Popup';
import { PlayerGlyph } from '../components/TileShape';
import { useT } from '../i18n';
import { publishBoard } from '../museum';
import { backToMenu, startSearch } from '../net';
import { pushToast, useStore } from '../store';

/** Results: both final boards, then the empty cells are counted one by one (−2 each) before the winner is revealed. */
export default function ResultsScreen() {
  const t = useT();
  const g = useStore((s) => s.game);
  const res = useStore((s) => s.result);
  const mySeat = useStore((s) => s.mySeat);
  const solo = useStore((s) => s.match.solo);
  const reduce = useStore((s) => s.settings.reduceMotion);
  const r = g?.result;
  const empties = useMemo(() => (g ? g.players.map((p) => p.board.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0)) : [[], []]), [g]);
  const total = Math.max(empties[0].length, empties[1].length);
  const [k, setK] = useState(reduce ? total : 0);
  const [saved, setSaved] = useState<'idle' | 'busy' | 'done'>('idle');
  useEffect(() => {
    if (k >= total) return;
    const step = Math.max(30, Math.min(140, 2400 / Math.max(1, total)));
    const tm = setTimeout(() => setK((n) => n + 1), k === 0 ? 700 : step);
    return () => clearTimeout(tm);
  }, [k, total]);
  if (!g || !r || !res) return null;
  const done = k >= total;
  const order: Seat[] = [mySeat, (1 - mySeat) as Seat];
  const lp = levelProgress(res.xpAfter);
  const exhibit = async () => {
    setSaved('busy');
    const ok = await publishBoard(g.players[mySeat].tiles, r.scores[mySeat].total);
    setSaved(ok ? 'done' : 'idle');
    pushToast(t(ok ? 'museum.published' : 'museum.offline'), ok ? 'good' : 'warn');
  };
  return (
    <main className="screen center results">
      <h1 className={!done ? 'counting' : res.won ? 'win' : 'lose'}>{!done ? t('res.counting') : res.won ? t('res.win') : t('res.lose')}</h1>
      <p className="muted">{t('res.' + r.reason)}{done && r.tieBreak ? t('res.tie') : ''}</p>
      <div className="scoregrid">
        {order.map((seat) => {
          const p = g.players[seat], s = r.scores[seat];
          const counted = Math.min(k, s.emptyCells);
          const marked = new Set(empties[seat].slice(0, counted));
          return (
            <div key={seat} className={'scorecard ' + (done && r.winner === seat ? 'winner' : '')}>
              <div className="pname"><PlayerGlyph seat={seat} /> <b>{p.name}</b>{seat === mySeat && <span className="tag">{t('you')}</span>}{p.isBot && <span className="tag bot">{t('bot')}</span>}</div>
              <BoardArt tiles={p.tiles} size={150} marked={marked} />
              <table className="num"><tbody>
                <tr><td>{t('res.coinsHalf', { c: s.coins, d: COIN_SCORE_DIVISOR })}</td><td>{s.coinPoints}</td></tr>
                <tr><td>{t('res.bonus')}</td><td>{s.bonus ? `+${s.bonus}` : '0'}</td></tr>
                <tr className={counted < s.emptyCells ? 'live' : ''}><td>{t('res.empty', { n: counted, p: EMPTY_CELL_PENALTY })}</td><td dir="ltr">−{counted * EMPTY_CELL_PENALTY}</td></tr>
                <tr className="total"><td>{t('res.final')}</td><td dir="ltr">{s.coinPoints + s.bonus - counted * EMPTY_CELL_PENALTY}</td></tr>
              </tbody></table>
              <div className="muted small">{t('res.filled', { a: BOARD_SIZE * BOARD_SIZE - s.emptyCells, b: BOARD_SIZE * BOARD_SIZE })}</div>
            </div>
          );
        })}
      </div>
      {done && (
        <>
          <div className="progress num">
            <div>{t('res.rating')} <b>{res.ratingAfter}</b> <span dir="ltr" className={res.delta >= 0 ? 'up' : 'down'}>({res.delta >= 0 ? '+' : ''}{res.delta})</span></div>
            <div>{t('res.xp', { n: res.xpGain })} <b>{res.levelAfter}</b>{res.levelAfter > res.levelBefore && <span className="tag good">{t('res.levelUp')}</span>}</div>
            <div className="xp"><div style={{ width: `${Math.min(100, lp.ratio * 100)}%` }} /></div>
          </div>
          <div className="row">
            <button className="btn primary big" onClick={() => startSearch(solo)}>{t('res.again')}</button>
            <button className="btn" disabled={saved !== 'idle' || g.players[mySeat].tiles.length === 0} onClick={exhibit}>🏛 {saved === 'done' ? t('museum.inMuseum') : t('museum.exhibit')}</button>
            <button className="btn ghost" onClick={backToMenu}>{t('res.menu')}</button>
          </div>
        </>
      )}
      {!done && <button className="btn ghost small" onClick={() => setK(total)}>{t('res.skip')}</button>}
      <Popup />

    </main>
  );
}
