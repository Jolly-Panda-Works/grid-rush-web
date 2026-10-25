import { useState } from 'react';
import { useT } from '../i18n';
import { getWsUrl, normalizeServer, pingServer, setServerUrl } from '../net';
import { useStore } from '../store';
import { bootstrapAccount, canLinkGoogle, linkGoogle } from '../account';
import { Icon, IconId } from '../art';

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

export function SettingsModal() {
  const t = useT();
  const settings = useStore((s) => s.settings);
  const online = useStore((s) => s.serverOnline);
  const account = useStore((s) => s.account);
  const [srv, setSrv] = useState(getWsUrl());
  const close = () => useStore.setState({ showSettings: false });
  const setS = (patch: Partial<typeof settings>) => useStore.setState({ settings: { ...settings, ...patch } });
  const save = async () => { setServerUrl(srv); setSrv(normalizeServer(srv)); const ok = await pingServer(); useStore.setState({ serverOnline: ok }); if (ok) void bootstrapAccount(); };
  const status = !getWsUrl() ? t('settings.none') : online ? t('settings.on') : t('settings.off');
  return (
    <div className="overlay" onClick={close}>
      <div className="modal small settings-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('settings.title')}>
        <h3>{t('settings.title')}</h3>
        <button className="mclose" onClick={close} aria-label={t('settings.close')}>✕</button>
        <div className="mscroll">
        <div className="seg" role="group" aria-label={t('menu.lang')}>
          <button className={settings.lang === 'fa' ? 'on' : ''} onClick={() => setS({ lang: 'fa' })} lang="fa">فارسی</button>
          <button className={settings.lang === 'en' ? 'on' : ''} onClick={() => setS({ lang: 'en' })} lang="en">English</button>
        </div>
        <Toggle icon={settings.sound ? 'sound-on' : 'sound-off'} label={t('menu.sound')} on={settings.sound} onChange={(v) => setS({ sound: v })} />
        <Toggle icon="motion" label={t('menu.reduce')} on={settings.reduceMotion} onChange={(v) => setS({ reduceMotion: v })} />
        <div className="acctbox">
          <span className="muted small">{t('acct.title')}</span>
          {account
            ? <>
                <div className="acctline"><b>{account.linked ? t('acct.linkedGoogle') : t('acct.guest')}</b><span className="num small" dir="ltr">{account.friendCode}</span></div>
                {!account.linked && <button className="btn" disabled={!canLinkGoogle()} onClick={() => linkGoogle(() => confirm(t('acct.switchConfirm')))}>{t('acct.linkGoogle')}</button>}
                {!account.linked && !canLinkGoogle() && <span className="muted small">{t('acct.googleUnavailable')}</span>}
              </>
            : <span className="muted small">{t('acct.needServer')}</span>}
        </div>
        <div className="serverbox">
          <span className="muted small">{t('settings.server')}</span>
          <input dir="ltr" value={srv} placeholder={t('menu.serverHint')} onChange={(e) => setSrv(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
          <div className={'sstatus ' + (online ? 'on' : 'off')}><i className={'dot ' + (online ? 'on' : 'off')} />{status}</div>
          <button className="btn" onClick={save}>{t('menu.serverSave')}</button>
        </div>
        </div>
      </div>
    </div>
  );
}
