import { Logo } from '../components/Logo';
import { levelProgress } from '../../../shared/src';
import { useT } from '../i18n';
import { useState } from 'react';
import { getWsUrl, isNative, normalizeServer, pingServer, setServerUrl, startSearch } from '../net';
import { profileLevel, saveProfile } from '../profile';
import { useStore } from '../store';

export default function MenuScreen() {
  const t = useT();
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const online = useStore((s) => s.serverOnline);
  const lp = levelProgress(profile.xp);
  const [srv, setSrv] = useState(getWsUrl());
  const saveServer = async () => { setServerUrl(srv); setSrv(normalizeServer(srv)); useStore.setState({ serverOnline: await pingServer() }); };
  const setName = (name: string) => { const p = { ...profile, name: name.slice(0, 16) }; saveProfile(p); useStore.setState({ profile: p }); };
  const recheck = async () => useStore.setState({ serverOnline: await pingServer() });
  const setS = (patch: Partial<typeof settings>) => useStore.setState({ settings: { ...settings, ...patch } });
  return (
    <main className="screen menu">
      <div className="langswitch" role="group" aria-label={t('menu.lang')}>
        <button className={settings.lang === 'fa' ? 'on' : ''} onClick={() => setS({ lang: 'fa' })} lang="fa">فارسی</button>
        <button className={settings.lang === 'en' ? 'on' : ''} onClick={() => setS({ lang: 'en' })} lang="en">English</button>
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

        {online === false && (
          <div className="banner warnb">{t('menu.offline')} <button className="link" onClick={recheck}>{t('menu.retry')}</button></div>
        )}
        {(online === false || isNative()) && (
          <div className="serverbox">
            <label className="field"><span className="muted small">{t('menu.server')}</span>
              <input dir="ltr" value={srv} placeholder={t('menu.serverHint')} onChange={(e) => setSrv(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveServer()} />
            </label>
            <button className="btn" onClick={saveServer}>{t('menu.serverSave')}</button>
          </div>
        )}
        <div className="menu-actions">
          <button className="btn primary big" disabled={online === false} onClick={() => startSearch(false)}>{t('menu.find')}</button>
          <button className="btn big" disabled={online === false} onClick={() => startSearch(true)}>{t('menu.bot')}</button>
          <button className="btn ghost" onClick={() => useStore.setState({ showHelp: true })}>{t('menu.how')}</button>
        </div>
        <div className="settings">
          <label><input type="checkbox" checked={settings.sound} onChange={(e) => setS({ sound: e.target.checked })} /> {t('menu.sound')}</label>
          <label><input type="checkbox" checked={settings.reduceMotion} onChange={(e) => setS({ reduceMotion: e.target.checked })} /> {t('menu.reduce')}</label>
        </div>
      </div>
    </main>
  );
}
