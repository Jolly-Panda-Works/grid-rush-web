import { useState } from 'react';
import { levelProgress } from '../../../shared/src';
import { ACHIEVEMENTS, progressOf } from '../achievements';
import { AVATARS, Medal, avatarUrl } from '../components/Medal';
import { Popup } from '../components/Popup';
import { useT } from '../i18n';
import { profileLevel, saveProfile } from '../profile';
import { useStore } from '../store';
import { syncProgress } from '../account';
import { Icon } from '../art';

/** Profile: avatar (tap to change), name (tap to edit), level with XP, rating, then stats and achievements. */
export default function ProfileScreen() {
  const t = useT();
  const profile = useStore((s) => s.profile);
  const lang = useStore((s) => s.settings.lang);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const lp = levelProgress(profile.xp);
  const s = profile.stats;
  const update = (patch: Partial<typeof profile>) => { const p = { ...profile, ...patch }; saveProfile(p); useStore.setState({ profile: p }); if (patch.avatar !== undefined) void syncProgress(); };
  const finishEdit = () => { if (!profile.name.trim()) update({ name: 'Player' }); setEditing(false); void syncProgress(); };
  const games = s.games;
  const pct = (n: number) => (games ? Math.round((n / games) * 100) : 0);
  const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const stats: [React.ReactNode, string, string][] = [
    ['🎲', t('prof.games'), String(games)],
    [<Icon id="trophy" size={26} />, t('prof.wins'), `${profile.wins} · ${pct(profile.wins)}%`],
    ['🔥', t('prof.bestStreak'), String(s.bestStreak)],
    ['⭐', t('prof.bestScore'), s.bestScore === null ? '—' : String(s.bestScore)],
    ['⚖', t('prof.avgScore'), s.scoredGames ? (s.totalScore / s.scoredGames).toFixed(1) : '—'],
    ['▦', t('prof.bonus7'), String(s.bonus7)],
    ['🧩', t('prof.fullBoards'), String(s.fullBoards)],
    [<Icon id="museum" size={26} />, t('prof.tiles'), String(s.tiles)],
    [<Icon id="treasure" size={26} />, t('prof.treasures'), `${s.treasures} · +${s.treasureCoins}`],
    [<Icon id="gift" size={26} />, t('prof.rewards'), String(s.rewards)],
  ];
  const unlocked = ACHIEVEMENTS.filter((a) => profile.ach[a.id]).length;
  return (
    <main className="screen profile">
      <header className="mhead">
        <button className="btn small" onClick={() => useStore.setState({ screen: 'menu' })}>{t('mm.back')}</button>
        <h2>{t('prof.title')}</h2>
        <span className="mpoints num"><Icon id="trophy" size={18} />{profile.rating}</span>
      </header>

      <section className="profhero">
        <button className="avbtn" onClick={() => setPicking(true)} aria-label={t('prof.changeAvatar')}>
          <Medal size={92} avatar={profile.avatar} level={profileLevel(profile)} />
          <span className="avedit" aria-hidden="true">✎</span>
        </button>
        <div className="profmain">
          {editing
            ? <input className="nameedit" autoFocus value={profile.name} maxLength={16} aria-label={t('menu.name')}
                onChange={(e) => update({ name: e.target.value.slice(0, 16) })} onBlur={finishEdit} onKeyDown={(e) => e.key === 'Enter' && finishEdit()} />
            : <button className="namebtn big" onClick={() => setEditing(true)} title={t('menu.editName')}><span>{profile.name}</span><span className="pen" aria-hidden="true">✎</span></button>}
          <div className="lvline num"><span className="lvtag">{t('menu.lv', { n: profileLevel(profile) })}</span><span className="muted small">{lp.into}/{lp.needed} XP</span></div>
          <div className="xpbar"><div style={{ width: `${Math.min(100, lp.ratio * 100)}%` }} /></div>
          <div className="profstats num"><span className="gem">{t('menu.wl', { w: profile.wins, l: profile.losses })}</span></div>
        </div>
      </section>

      <section className="mbody">
        <h3 className="msec">{t('prof.stats')}</h3>
        <div className="statgrid">
          {stats.map(([ic, label, value]) => (
            <div key={label} className="statcard"><span className="sc-ico" aria-hidden="true">{ic}</span><b className="num">{value}</b><span className="small">{label}</span></div>
          ))}
        </div>

        <h3 className="msec">{t('prof.achievements')} <span className="num muted small">{unlocked}/{ACHIEVEMENTS.length}</span></h3>
        <div className="achgrid">
          {ACHIEVEMENTS.map((a) => {
            const pr = progressOf(profile, a);
            return (
              <div key={a.id} className={'achcard' + (pr.done ? ' done' : '')}>
                <span className="ach-ico" aria-hidden="true">{pr.done ? a.icon : <Icon id="lock" size={30} />}</span>
                <div className="ach-body">
                  <b>{t('ach.' + a.id)}</b>
                  <span className="small">{t('ach.' + a.id + '.d')}</span>
                  {pr.done
                    ? <span className="ach-date small num">✓ {fmtDate(profile.ach[a.id])}</span>
                    : a.goal > 1 && <span className="ach-prog"><i style={{ width: `${(pr.now / pr.goal) * 100}%` }} /><em className="num">{pr.now}/{pr.goal}</em></span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {picking && (
        <div className="overlay" onClick={() => setPicking(false)}>
          <div className="modal small" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('prof.changeAvatar')}>
            <h3>{t('prof.changeAvatar')}</h3>
            <button className="mclose" onClick={() => setPicking(false)} aria-label={t('settings.close')}>✕</button>
            <div className="mscroll"><div className="avgrid">
              {AVATARS.map((_, i) => (
                <button key={i} className={'avpick' + (i === profile.avatar ? ' on' : '')} onClick={() => { update({ avatar: i }); setPicking(false); }}>
                  <span style={{ backgroundImage: `url(${avatarUrl(i)})` }} />
                </button>
              ))}
            </div></div>
          </div>
        </div>
      )}
      <Popup />
    </main>
  );
}
