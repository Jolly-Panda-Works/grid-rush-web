import { useState } from 'react';
import { useT } from '../i18n';
import { getWsUrl, normalizeServer, pingServer, setServerUrl } from '../net';
import { useStore } from '../store';

export function SettingsModal() {
  const t = useT();
  const settings = useStore((s) => s.settings);
  const online = useStore((s) => s.serverOnline);
  const [srv, setSrv] = useState(getWsUrl());
  const close = () => useStore.setState({ showSettings: false });
  const setS = (patch: Partial<typeof settings>) => useStore.setState({ settings: { ...settings, ...patch } });
  const save = async () => { setServerUrl(srv); setSrv(normalizeServer(srv)); useStore.setState({ serverOnline: await pingServer() }); };
  const status = !getWsUrl() ? t('settings.none') : online ? t('settings.on') : t('settings.off');
  return (
    <div className="overlay" onClick={close}>
      <div className="modal small settings-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('settings.title')}>
        <h3>{t('settings.title')}</h3>
        <label className="srow"><input type="checkbox" checked={settings.sound} onChange={(e) => setS({ sound: e.target.checked })} /> {t('menu.sound')}</label>
        <label className="srow"><input type="checkbox" checked={settings.reduceMotion} onChange={(e) => setS({ reduceMotion: e.target.checked })} /> {t('menu.reduce')}</label>
        <div className="serverbox">
          <span className="muted small">{t('settings.server')}</span>
          <input dir="ltr" value={srv} placeholder={t('menu.serverHint')} onChange={(e) => setSrv(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
          <div className={'sstatus ' + (online ? 'on' : 'off')}>{status}</div>
          <button className="btn" onClick={save}>{t('menu.serverSave')}</button>
        </div>
        <button className="btn primary" onClick={close}>{t('settings.close')}</button>
      </div>
    </div>
  );
}
