import { Logo } from '../components/Logo';
import { levelProgress } from '../../../shared/src';
import { useT } from '../i18n';
import { startSearch } from '../net';
import { profileLevel, saveProfile } from '../profile';
import { useStore } from '../store';

/** Fixed (non-scrolling) main menu. Bot games work offline, so no button depends on the server. */
export default function MenuScreen() {
  const t = useT();
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const online = useStore((s) => s.serverOnline);
  const lp = levelProgress(profile.xp);
  const setName = (name: string) => { const p = { ...profile, name: name.slice(0, 16) }; saveProfile(p); useStore.setState({ profile: p }); };
  const setLang = (lang: 'en' | 'fa') => useStore.setState({ settings: { ...settings, lang } });
  return (
    <main className="screen menu">
      <button className="gear" onClick={() => useStore.setState({ showSettings: true })} aria-label={t('menu.settings')} title={t('menu.settings')}>⚙</button>
      <div className="langswitch" role="group" aria-label={t('menu.lang')}>
        <button className={settings.lang === 'fa' ? 'on' : ''} onClick={() => setLang('fa')} lang="fa">فارسی</button>
        <button className={settings.lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} lang="en">English</button>
      </div>
      <div className="menu-card">
        <Logo size={56} stacked />
        <div className="tagline">{t('tagline')}</div>

        <section className="pprofile">
          <label className="field">
            <span className="muted small">{t('menu.name')}</span>
            <input value={profile.name} maxLength={16} onChange={(e) => setName(e.target.value)} onBlur={() => !profile.name.trim() && setName('Player')} />
          </label>
          <div className="pstat num"><b>{t('menu.lv', { n: profileLevel(profile) })}</b><span className="muted">{t('menu.rating', { n: profile.rating })}</span><span className="muted">{t('menu.wl', { w: profile.wins, l: profile.losses })}</span></div>
          <div className="xp" title={`${lp.into}/${lp.needed} XP`}><div style={{ width: `${Math.min(100, lp.ratio * 100)}%` }} /></div>
        </section>

        <div className="menu-actions">
          <button className="btn primary big" onClick={() => startSearch(true)}>{t('menu.bot')}</button>
          <button className="btn big" onClick={() => startSearch(false)}>{t('menu.find')}</button>
          {online === false && <div className="offnote small">{t('menu.offlineNote')}</div>}
          <div className="row2">
            <button className="btn" onClick={() => useStore.setState({ screen: 'museum' })}>🏛 {t('museum.title')}</button>
            <button className="btn ghost" onClick={() => useStore.setState({ showHelp: true })}>{t('menu.how')}</button>
          </div>
        </div>
        <div className="version num" dir="ltr">v{__APP_VERSION__}</div>
      </div>
    </main>
  );
}
