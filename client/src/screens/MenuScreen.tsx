import { useState } from 'react';
import { Logo } from '../components/Logo';
import { Medal } from '../components/Medal';
import { levelProgress } from '../../../shared/src';
import { useT } from '../i18n';
import { startSearch } from '../net';
import { profileLevel, saveProfile } from '../profile';
import { useStore } from '../store';

/** Main menu as a game lobby: profile plate on top, the logo, two big play tiles, and a row of icon tiles.
 *  Fixed layout (never scrolls). Bot games work offline, so no play tile depends on the server. */
export default function MenuScreen() {
  const t = useT();
  const profile = useStore((s) => s.profile);
  const online = useStore((s) => s.serverOnline);
  const [editing, setEditing] = useState(false);
  const lp = levelProgress(profile.xp);
  const setName = (name: string) => { const p = { ...profile, name: name.slice(0, 16) }; saveProfile(p); useStore.setState({ profile: p }); };
  const finishEdit = () => { if (!profile.name.trim()) setName('Player'); setEditing(false); };
  return (
    <main className="screen menu lobby">
      <header className="profplate">
        <Medal seat={0} size={58} level={profileLevel(profile)} />
        <div className="profinfo">
          {editing
            ? <input className="nameedit" autoFocus value={profile.name} maxLength={16} aria-label={t('menu.name')}
                onChange={(e) => setName(e.target.value)} onBlur={finishEdit} onKeyDown={(e) => e.key === 'Enter' && finishEdit()} />
            : <button className="namebtn" onClick={() => setEditing(true)} title={t('menu.editName')}><span>{profile.name}</span><span className="pen" aria-hidden="true">✎</span></button>}
          <div className="xpbar" title={`${lp.into}/${lp.needed} XP`}><div style={{ width: `${Math.min(100, lp.ratio * 100)}%` }} /><span className="num">{lp.into}/{lp.needed}</span></div>
          <div className="profstats num"><span className="gem">🏆 {profile.rating}</span><span className="gem">{t('menu.wl', { w: profile.wins, l: profile.losses })}</span></div>
        </div>
      </header>

      <div className="lobby-hero">
        <Logo size={56} stacked />
        <div className="tagline">{t('tagline')}</div>
      </div>

      <div className="playtiles">
        <button className="btn primary playtile" onClick={() => startSearch(true)}>
          <span className="pt-ico" aria-hidden="true">▶</span>
          <span className="pt-txt"><b>{t('menu.bot')}</b><small>{t('menu.botSub')}</small></span>
        </button>
        <button className="btn playtile" onClick={() => startSearch(false)}>
          <span className="pt-ico" aria-hidden="true">⚔</span>
          <span className="pt-txt"><b>{t('menu.find')}</b><small><i className={'dot ' + (online ? 'on' : 'off')} />{online ? t('menu.findOn') : t('menu.findOff')}</small></span>
        </button>
      </div>

      <nav className="navtiles">
        <button className="navtile" onClick={() => useStore.setState({ screen: 'museum' })}><span className="nt-ico">🏛</span><span>{t('museum.title')}</span></button>
        <button className="navtile" onClick={() => useStore.setState({ showHelp: true })}><span className="nt-ico">📜</span><span>{t('menu.how')}</span></button>
        <button className="navtile" onClick={() => useStore.setState({ showSettings: true })}><span className="nt-ico">⚙</span><span>{t('menu.settings')}</span></button>
      </nav>
      <div className="version num" dir="ltr">v{__APP_VERSION__}</div>
    </main>
  );
}
