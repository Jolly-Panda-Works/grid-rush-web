import { useEffect, useState } from 'react';
import { ACHIEVEMENTS } from '../achievements';
import { api } from '../account';
import { Icon } from '../art';
import { useT } from '../i18n';
import { Medal } from './Medal';

export interface PublicPlayer { id: string; name: string; avatar: number; level: number; rating: number; wins: number; losses: number; online: boolean }
interface FullPlayer extends PublicPlayer { stats: Record<string, number | null>; ach: Record<string, number>; friend: boolean }

/** Another player's public profile (from the leaderboard or the friends list). */
export function PlayerCard({ id, onClose, children }: { id: string; onClose: () => void; children?: React.ReactNode }) {
  const t = useT();
  const [p, setP] = useState<FullPlayer | null | undefined>(undefined);
  useEffect(() => { api<FullPlayer>(`/users/${id}`).then((r) => setP(r?.ok ? r.data : null)); }, [id]);
  const games = p ? p.wins + p.losses : 0;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal small playercard" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{p?.name ?? '…'}</h3>
        <button className="mclose" onClick={onClose} aria-label={t('settings.close')}>✕</button>
        <div className="mscroll">
        {p === null && <p className="muted">{t('museum.offline')}</p>}
        {p && (
          <>
            <div className="pc-top">
              <Medal size={72} avatar={p.avatar} level={p.level} />
              <div className="pc-facts num">
                <span className="gem"><Icon id="trophy" size={18} />{p.rating}</span>
                <span className="gem">{t('menu.wl', { w: p.wins, l: p.losses })}</span>
                <span className={'onl' + (p.online ? ' on' : '')}><i className={'dot ' + (p.online ? 'on' : 'off')} />{p.online ? t('fr.online') : t('fr.offline')}</span>
              </div>
            </div>
            <div className="pc-stats num">
              <div><b>{games}</b><span>{t('prof.games')}</span></div>
              <div><b>{games ? Math.round((p.wins / games) * 100) : 0}%</b><span>{t('prof.wins')}</span></div>
              <div><b>{p.stats.bestScore ?? '—'}</b><span>{t('prof.bestScore')}</span></div>
              <div><b>{p.stats.bonus7 ?? 0}</b><span>{t('prof.bonus7')}</span></div>
            </div>
            <div className="pc-ach">{ACHIEVEMENTS.map((a) => <span key={a.id} className={'pc-a' + (p.ach[a.id] ? ' on' : '')} title={t('ach.' + a.id)}>{a.icon}</span>)}</div>
            {children}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
