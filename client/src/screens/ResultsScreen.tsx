import { useEffect, useMemo, useRef, useState } from 'react';
import { COIN_SCORE_DIVISOR, EMPTY_CELL_PENALTY, Seat, levelProgress } from '../../../shared/src';
import { Icon } from '../art';
import { sfx } from '../audio';
import { BoardArt } from '../components/BoardArt';
import { LevelUp } from '../components/LevelUp';
import { Popup } from '../components/Popup';
import { PlayerGlyph } from '../components/TileShape';
import { useT } from '../i18n';
import { publishBoard } from '../museum';
import { ACHIEVEMENTS } from '../achievements';
import { backToMenu, startSearch } from '../net';
import { pushToast, useStore } from '../store';

/** The score table fills row by row: coins, 7x7 bonus, empty cells (marked on the boards one by one), then the total. */
const ROWS = ['coins', 'bonus', 'empty', 'total'] as const;
const DONE = ROWS.length;
const easeOut = (x: number) => 1 - (1 - x) ** 3;
const signed = (n: number) => (n < 0 ? `−${-n}` : String(n));

/** Results: both final boards, the score table counted up for both players, then the winner (and a level-up, if any). */
export default function ResultsScreen() {
  const t = useT();
  const g = useStore((s) => s.game);
  const res = useStore((s) => s.result);
  const mySeat = useStore((s) => s.mySeat);
  const solo = useStore((s) => s.match.solo);
  const avatar = useStore((s) => s.profile.avatar);
  const reduce = useStore((s) => s.settings.reduceMotion);
  const r = g?.result;
  const empties = useMemo(() => (g ? g.players.map((p) => p.board.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0)) : [[], []]), [g]);
  const maxEmpty = Math.max(empties[0].length, empties[1].length);
  const [stage, setStage] = useState(reduce ? DONE : 0); // the row being counted (DONE = all counted)
  const [prog, setProg] = useState(0); // 0..1 through that row
  const [saved, setSaved] = useState<'idle' | 'busy' | 'done'>('idle');
  const [levelUp, setLevelUp] = useState<'no' | 'open' | 'seen'>('no');
  const ticks = useRef(0);

  useEffect(() => {
    if (stage >= DONE) return;
    const row = ROWS[stage];
    const dur = row === 'empty' ? Math.max(500, Math.min(2400, maxEmpty * 110)) : row === 'bonus' ? 600 : 900;
    const t0 = performance.now() + (stage === 0 ? 700 : 280);
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - t0) / dur));
      setProg(p);
      const step = Math.floor(p * (row === 'empty' ? maxEmpty : 12)); // a soft click for every counted step
      if (step > ticks.current) { ticks.current = step; sfx.tick(); }
      if (p < 1) raf = requestAnimationFrame(tick);
      else { ticks.current = 0; sfx.turn(); setStage(stage + 1); setProg(0); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, maxEmpty]);

  const done = stage >= DONE;
  useEffect(() => {
    if (!done || !res) return;
    (res.won ? sfx.win : sfx.lose)();
    if (res.levelAfter > res.levelBefore) { const tm = setTimeout(() => setLevelUp('open'), 1100); return () => clearTimeout(tm); }
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!g || !r || !res) return null;
  const order: Seat[] = [mySeat, (1 - mySeat) as Seat];
  const lp = levelProgress(res.xpAfter);
  const exhibit = async () => {
    setSaved('busy');
    const ok = await publishBoard(g.players[mySeat].tiles, r.scores[mySeat].total);
    setSaved(ok ? 'done' : 'idle');
    pushToast(t(ok ? 'museum.published' : 'museum.offline'), ok ? 'good' : 'warn');
  };
  /** How far a row has been counted: 1 = finished, 0 = not reached. */
  const reached = (i: number) => (i < stage ? 1 : i === stage ? prog : 0);
  const emptyCounted = (seat: Seat) => Math.round(r.scores[seat].emptyCells * reached(2));
  const value = (row: (typeof ROWS)[number], seat: Seat) => {
    const s = r.scores[seat], k = easeOut(reached(ROWS.indexOf(row)));
    if (row === 'coins') return Math.round(s.coinPoints * k);
    if (row === 'bonus') return Math.round(s.bonus * k);
    if (row === 'empty') return -emptyCounted(seat) * EMPTY_CELL_PENALTY;
    return Math.round(s.total * k);
  };
  const label = (row: (typeof ROWS)[number]) =>
    row === 'coins' ? t('res.rowCoins', { d: COIN_SCORE_DIVISOR }) : row === 'bonus' ? t('res.bonus') : row === 'empty' ? t('res.rowEmpty', { p: EMPTY_CELL_PENALTY }) : t('res.final');
  const note = (row: (typeof ROWS)[number], seat: Seat) => {
    const s = r.scores[seat];
    if (row === 'coins') return `${s.coins} ÷ ${COIN_SCORE_DIVISOR}`;
    if (row === 'empty') return t('res.cells', { n: emptyCounted(seat) });
    return null;
  };

  return (
    <main className="screen center results">
      <h1 className={!done ? 'counting' : res.won ? 'win' : 'lose'}>{!done ? t('res.counting') : res.won ? t('res.win') : t('res.lose')}</h1>
      <p className="muted">{t('res.' + r.reason)}{done && r.tieBreak ? t('res.tie') : ''}</p>
      <div className="scoregrid">
        {order.map((seat) => {
          const p = g.players[seat];
          return (
            <div key={seat} className={'scorecard ' + (done && r.winner === seat ? 'winner' : '')}>
              {done && r.winner === seat && <Icon id="crown" size={40} className="wincrown" />}
              <div className="pname"><PlayerGlyph seat={seat} /> <b>{p.name}</b>{seat === mySeat && <span className="tag">{t('you')}</span>}{p.isBot && <span className="tag bot">{t('bot')}</span>}</div>
              <BoardArt tiles={p.tiles} size={150} marked={new Set(empties[seat].slice(0, emptyCounted(seat)))} />
            </div>
          );
        })}
      </div>
      <table className="scoretable num">
        <thead>
          <tr><th />{order.map((seat) => <th key={seat} className={done && r.winner === seat ? 'win' : ''}><PlayerGlyph seat={seat} size={12} /> {seat === mySeat ? t('you') : g.players[seat].name}</th>)}</tr>
        </thead>
        <tbody>
          {ROWS.map((row, i) => i <= stage && (
            <tr key={row} className={'r-' + row + (i === stage ? ' live' : '')}>
              <th>{label(row)}</th>
              {order.map((seat) => (
                <td key={seat} className={row === 'total' && done && r.winner === seat ? 'win' : ''}>
                  <b dir="ltr">{row === 'bonus' && value(row, seat) > 0 ? `+${value(row, seat)}` : signed(value(row, seat))}</b>
                  {note(row, seat) && <small dir={row === 'coins' ? 'ltr' : undefined}>{note(row, seat)}</small>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {done && (
        <>
          <div className="progress num">
            <div>{t('res.rating')} <b>{res.ratingAfter}</b> {res.practice ? <span className="muted small">{t('res.practice')}</span> : <span dir="ltr" className={res.delta >= 0 ? 'up' : 'down'}>({res.delta >= 0 ? '+' : ''}{res.delta})</span>}</div>
            <div>{t('res.xp', { n: res.xpGain })} <b>{res.levelAfter}</b>{res.levelAfter > res.levelBefore && <span className="tag good">{t('res.levelUp')}</span>}</div>
            <div className="xp"><div style={{ width: `${Math.min(100, lp.ratio * 100)}%` }} /></div>
          </div>
          {!!res.newAch?.length && (
            <div className="newach">
              <b>{t('ach.new')}</b>
              {res.newAch.map((id) => { const a = ACHIEVEMENTS.find((x) => x.id === id); return <span key={id} className="achchip">{a && <Icon id={a.icon} size={22} />} {t('ach.' + id)}</span>; })}
            </div>
          )}
          <div className="row">
            <button className="btn primary" onClick={() => startSearch(solo)}>{t('res.again')}</button>
            <button className="btn" disabled={saved !== 'idle' || g.players[mySeat].tiles.length === 0} onClick={exhibit}><Icon id="museum" size={20} />{saved === 'done' ? t('museum.inMuseum') : t('museum.exhibit')}</button>
            <button className="btn" onClick={backToMenu}>{t('res.menu')}</button>
          </div>
        </>
      )}
      {!done && <button className="btn small" onClick={() => { setStage(DONE); setProg(0); }}>{t('res.skip')}</button>}
      {levelUp === 'open' && <LevelUp from={res.levelBefore} to={res.levelAfter} xp={res.xpAfter} avatar={avatar} onClose={() => setLevelUp('seen')} />}
      <Popup />
    </main>
  );
}
