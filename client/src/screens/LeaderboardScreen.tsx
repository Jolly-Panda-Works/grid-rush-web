import { useEffect, useState } from 'react';
import { api } from '../account';
import { Medal } from '../components/Medal';
import { PlayerCard, PublicPlayer } from '../components/PlayerCard';
import { Popup } from '../components/Popup';
import { useT } from '../i18n';
import { useStore } from '../store';

interface Row extends PublicPlayer { rank: number; xp: number; me: boolean }
interface Board { rows: Row[]; me: Row }

/** Leaderboard: by rating (online matches) or by level, everyone or just my friends. My own row is always visible. */
export default function LeaderboardScreen() {
  const t = useT();
  const [by, setBy] = useState<'rating' | 'level'>('rating');
  const [scope, setScope] = useState<'global' | 'friends'>('global');
  const [board, setBoard] = useState<Board | null | undefined>(undefined);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    setBoard(undefined);
    api<Board>(`/leaderboard?by=${by}&scope=${scope}`).then((r) => setBoard(r?.ok ? r.data : null));
  }, [by, scope]);
  const value = (r: Row) => (by === 'rating' ? r.rating : t('menu.lv', { n: r.level }));
  const meInTop = !!board?.rows.some((r) => r.me);
  const row = (r: Row) => (
    <button key={r.id + (r.me ? '-me' : '')} className={'lbrow' + (r.me ? ' me' : '') + (r.rank <= 3 ? ' top' + r.rank : '')} onClick={() => setOpen(r.id)}>
      <span className="lbrank num">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
      <Medal size={38} avatar={r.avatar} />
      <span className="lbname"><b>{r.me ? `${r.name} (${t('you')})` : r.name}</b><small className="num">{t('menu.lv', { n: r.level })} · {t('menu.wl', { w: r.wins, l: r.losses })}</small></span>
      <span className="lbval num">{value(r)}</span>
    </button>
  );
  return (
    <main className="screen social">
      <header className="mhead">
        <button className="btn small" onClick={() => useStore.setState({ screen: 'menu' })}>{t('mm.back')}</button>
        <h2>🏆 {t('lb.title')}</h2>
        <span />
      </header>
      <div className="mtabs" role="tablist">
        <button role="tab" aria-selected={by === 'rating'} className={by === 'rating' ? 'on' : ''} onClick={() => setBy('rating')}>{t('lb.rating')}</button>
        <button role="tab" aria-selected={by === 'level'} className={by === 'level' ? 'on' : ''} onClick={() => setBy('level')}>{t('lb.level')}</button>
      </div>
      <div className="msort">
        <button className={scope === 'global' ? 'on' : ''} onClick={() => setScope('global')}>{t('lb.global')}</button>
        <button className={scope === 'friends' ? 'on' : ''} onClick={() => setScope('friends')}>{t('lb.friends')}</button>
      </div>
      {by === 'rating' && <p className="mintro muted small">{t('lb.ratingNote')}</p>}
      <section className="mbody">
        {board === undefined && <p className="muted small">{t('museum.loading')}</p>}
        {board === null && <div className="offnote small">{t('acct.needServer')}</div>}
        {board && board.rows.length <= 1 && scope === 'friends' && <p className="muted small">{t('lb.noFriends')}</p>}
        {board && <div className="lblist">{board.rows.map(row)}</div>}
      </section>
      {board && !meInTop && <div className="lbmine">{row(board.me)}</div>}
      {open && <PlayerCard id={open} onClose={() => setOpen(null)} />}
      <Popup />
    </main>
  );
}
