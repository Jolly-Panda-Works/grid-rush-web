import { Icon } from '../art';
import { Logo } from '../components/Logo';
import { Medal } from '../components/Medal';
import { levelProgress } from '../../../shared/src';
import { useT } from '../i18n';
import { startSearch } from '../net';
import { profileLevel } from '../profile';
import { needServer, useStore } from '../store';

/** Main menu as a game lobby: profile plate on top (opens the profile), the logo, two big play tiles, and a row of icon tiles.
 *  Fixed layout (never scrolls). Bot games work offline, so no play tile depends on the server. */
export default function MenuScreen() {
  const t = useT();
  const profile = useStore((s) => s.profile);
  const online = useStore((s) => s.serverOnline);
  const lp = levelProgress(profile.xp);
  return (
    <main className="screen menu lobby">
      <button className="profplate" onClick={() => useStore.setState({ screen: 'profile' })} aria-label={t('prof.title')}>
        <Medal size={58} level={profileLevel(profile)} avatar={profile.avatar} />
        <div className="profinfo">
          <span className="namebtn"><span>{profile.name}</span><span className="pen" aria-hidden="true">›</span></span>
          <div className="xpbar" title={`${lp.into}/${lp.needed} XP`}><div style={{ width: `${Math.min(100, lp.ratio * 100)}%` }} /><span className="num">{lp.into}/{lp.needed}</span></div>
          <div className="profstats num"><span className="gem"><Icon id="trophy" size={18} />{profile.rating}</span><span className="gem">{t('menu.wl', { w: profile.wins, l: profile.losses })}</span></div>
        </div>
      </button>

      <div className="lobby-hero">
        <Logo size={56} stacked />
        <div className="tagline">{t('tagline')}</div>
      </div>

      <div className="playtiles">
        <button className="btn primary playtile" onClick={() => startSearch(true)}>
          <span className="pt-ico" aria-hidden="true"><Icon id="play" size={40} /></span>
          <span className="pt-txt"><b>{t('menu.bot')}</b><small>{t('menu.botSub')}</small></span>
        </button>
        <button className="btn playtile" onClick={() => startSearch(false)}>
          <span className="pt-ico" aria-hidden="true"><Icon id="match" size={40} /></span>
          <span className="pt-txt"><b>{t('menu.find')}</b><small><i className={'dot ' + (online ? 'on' : 'off')} />{online ? t('menu.findOn') : t('menu.findOff')}</small></span>
        </button>
      </div>

      <nav className="navtiles">
        <button className={'navtile' + (online ? '' : ' needsrv')} onClick={() => needServer('off.what.lb', () => useStore.setState({ screen: 'leaderboard' }))}><span className="nt-ico"><Icon id="trophy" size={34} /></span><span>{t('lb.short')}</span></button>
        <button className={'navtile' + (online ? '' : ' needsrv')} onClick={() => needServer('off.what.fr', () => useStore.setState({ screen: 'friends' }))}><span className="nt-ico"><Icon id="friends" size={34} /></span><span>{t('fr.title')}</span></button>
        <button className="navtile" onClick={() => useStore.setState({ screen: 'museum' })}><span className="nt-ico"><Icon id="museum" size={34} /></span><span>{t('museum.title')}</span></button>
        <button className="navtile" onClick={() => useStore.setState({ showHelp: true })}><span className="nt-ico"><Icon id="quests" size={34} /></span><span>{t('menu.how')}</span></button>
        <button className="navtile" onClick={() => useStore.setState({ showSettings: true })}><span className="nt-ico"><Icon id="settings" size={34} /></span><span>{t('menu.settings')}</span></button>
      </nav>
      <div className="version num" dir="ltr">v{__APP_VERSION__}</div>
    </main>
  );
}
