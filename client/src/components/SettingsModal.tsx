import { useState } from 'react';
import { useT } from '../i18n';
import { openLevel } from '../levelFlow';
import { useStore } from '../store';
import { AccountSection } from './AccountUI';
import { Icon, IconId } from '../art';
import { sfx, vibrate } from '../audio';

/** A tile-styled on/off switch. */
function Toggle({ on, onChange, label, icon }: { on: boolean; onChange: (v: boolean) => void; label: string; icon: IconId }) {
  return (
    <button className={'trow' + (on ? ' on' : '')} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="tr-ico" aria-hidden="true"><Icon id={icon} size={26} /></span>
      <span className="tr-l">{label}</span>
      <span className="tswitch" aria-hidden="true"><i /></span>
    </button>
  );
}

/** A volume slider (0..100 %) in the same row style. */
function Slider({ value, onChange, onRelease, label, icon }: { value: number; onChange: (v: number) => void; onRelease?: () => void; label: string; icon: IconId }) {
  const pct = Math.round(value * 100);
  return (
    <label className="trow slider">
      <span className="tr-ico" aria-hidden="true"><Icon id={icon} size={26} /></span>
      <span className="tr-l">{label}</span>
      <input type="range" min={0} max={100} step={5} value={pct} style={{ '--v': `${pct}%` } as React.CSSProperties} aria-label={label}
        onChange={(e) => onChange(Number(e.target.value) / 100)} onPointerUp={onRelease} onKeyUp={onRelease} />
      <span className="sl-v num">{pct}</span>
    </label>
  );
}

/** Settings, laid out like a game's options panel: how to play and language on top, then sound and music sliders,
 *  vibration / notifications / reduce motion, about us, the account and the version. */
export function SettingsModal() {
  const t = useT();
  const settings = useStore((s) => s.settings);
  const [about, setAbout] = useState(false);
  const close = () => useStore.setState({ showSettings: false });
  const setS = (patch: Partial<typeof settings>) => useStore.setState({ settings: { ...settings, ...patch } });
  const notify = async (on: boolean) => {
    setS({ notifications: on });
    if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { /* ignore */ } }
  };
  if (about) return <AboutUs onBack={() => setAbout(false)} onClose={close} />;
  return (
    <div className="overlay" onClick={close}>
      <div className="modal small settings-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('settings.title')}>
        <h3>{t('settings.title')}</h3>
        <button className="mclose" onClick={close} aria-label={t('settings.close')}>✕</button>
        <div className="mscroll">
          <button className="btn primary wide" onClick={() => { useStore.setState({ showSettings: false, screen: 'map' }); openLevel(1); }}><Icon id="play" size={24} />{t('set.tutorial')}</button>
          <button className="btn wide" onClick={() => useStore.setState({ showSettings: false, showHelp: true })}><Icon id="quests" size={24} />{t('menu.how')}</button>
          <div className="setrow">
            <span className="tr-ico" aria-hidden="true"><Icon id="language" size={26} /></span>
            <div className="seg" role="group" aria-label={t('menu.lang')}>
              <button className={settings.lang === 'fa' ? 'on' : ''} onClick={() => setS({ lang: 'fa' })} lang="fa">فارسی</button>
              <button className={settings.lang === 'en' ? 'on' : ''} onClick={() => setS({ lang: 'en' })} lang="en">English</button>
            </div>
          </div>
          <div className="setgroup">
            <Slider icon="sound-on" label={t('set.sound')} value={settings.soundVol} onChange={(v) => setS({ soundVol: v, sound: true })} onRelease={() => sfx.place()} />
            <Slider icon="tip" label={t('set.music')} value={settings.musicVol} onChange={(v) => setS({ musicVol: v, sound: true })} />
            <Toggle icon="turns" label={t('set.vibration')} on={settings.vibration} onChange={(v) => { setS({ vibration: v }); if (v) setTimeout(() => vibrate(40)); }} />
            <Toggle icon="calendar" label={t('set.notifications')} on={settings.notifications} onChange={notify} />
            <Toggle icon="motion" label={t('menu.reduce')} on={settings.reduceMotion} onChange={(v) => setS({ reduceMotion: v })} />
          </div>
          <button className="btn wide" onClick={() => setAbout(true)}><Icon id="achievement" size={22} />{t('set.about')}</button>
          <h4 className="set-h">{t('acct.title')}</h4>
          <AccountSection />
          <div className="setver num" dir="ltr" data-latin>v{__APP_VERSION__}</div>
        </div>
      </div>
    </div>
  );
}

/** About us: the studio, the game and the credits. */
function AboutUs({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const t = useT();
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal small about-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('set.about')}>
        <h3>{t('set.about')}</h3>
        <button className="mclose" onClick={onClose} aria-label={t('settings.close')}>✕</button>
        <div className="mscroll">
          <img className="about-logo" src={`${import.meta.env.BASE_URL}brand/studio-logo.png`} alt="Jolly Panda Studio" />
          <p>{t('about.text')}</p>
          <dl className="about-credits">
            <dt>{t('about.game')}</dt><dd>Jolly Panda Studio</dd>
            <dt>{t('about.sound')}</dt><dd dir="ltr">The Complete UI Sound Effects Library · CelerisLab</dd>
            <dt>{t('about.version')}</dt><dd className="num" dir="ltr" data-latin>v{__APP_VERSION__}</dd>
          </dl>
        </div>
        <button className="btn" onClick={onBack}>{t('mm.back')}</button>
      </div>
    </div>
  );
}
