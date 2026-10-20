import { Logo } from '../components/Logo';
import { levelProgress } from '../../../shared/src';
import { pingServer, startSearch } from '../net';
import { profileLevel, saveProfile } from '../profile';
import { useStore } from '../store';

export default function MenuScreen() {
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const online = useStore((s) => s.serverOnline);
  const lp = levelProgress(profile.xp);
  const setName = (name: string) => { const p = { ...profile, name: name.slice(0, 16) }; saveProfile(p); useStore.setState({ profile: p }); };
  const recheck = async () => useStore.setState({ serverOnline: await pingServer() });
  return (
    <main className="screen menu">
      <div className="menu-card">
        <Logo size={56} stacked />
        <div className="tagline">Build Your Grid. Beat the Clock.</div>

        <section className="pprofile">
          <label className="field">
            <span className="muted small">Your name</span>
            <input value={profile.name} maxLength={16} onChange={(e) => setName(e.target.value)} onBlur={() => !profile.name.trim() && setName('Player')} />
          </label>
          <div className="pstat num"><b>Lv {profileLevel(profile)}</b><span className="muted">Rating {profile.rating}</span><span className="muted">{profile.wins}W · {profile.losses}L</span></div>
          <div className="xp" title={`${lp.into}/${lp.needed} XP`}><div style={{ width: `${Math.min(100, lp.ratio * 100)}%` }} /></div>
        </section>

        {online === false && (
          <div className="banner warnb">
            Game server is offline. Run <code>npm run dev</code> in the project folder. <button className="link" onClick={recheck}>Retry</button>
          </div>
        )}
        <div className="menu-actions">
          <button className="btn primary big" disabled={online === false} onClick={() => startSearch(false)}>Find match</button>
          <button className="btn big" disabled={online === false} onClick={() => startSearch(true)}>Play vs bot</button>
          <button className="btn ghost" onClick={() => useStore.setState({ showHelp: true })}>How to play</button>
        </div>
        <div className="settings">
          <label><input type="checkbox" checked={settings.sound} onChange={(e) => useStore.setState({ settings: { ...settings, sound: e.target.checked } })} /> Sound</label>
          <label><input type="checkbox" checked={settings.reduceMotion} onChange={(e) => useStore.setState({ settings: { ...settings, reduceMotion: e.target.checked } })} /> Reduce motion</label>
        </div>
      </div>
    </main>
  );
}
