import { useEffect, useState } from 'react';
import { sfx } from '../audio';
import { bootstrapAccount } from '../account';
import { Icon } from '../art';
import { useT } from '../i18n';
import { pingServer } from '../net';
import { pushToast, useStore } from '../store';

/** Warning shown instead of a screen or action that needs the game server while it cannot be reached. */
export function ServerNotice() {
  const t = useT();
  const notice = useStore((s) => s.serverNotice);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (notice) sfx.warn(); }, [notice]);
  if (!notice) return null;
  const close = () => useStore.setState({ serverNotice: null, ...(notice.back ? { screen: 'menu' as const } : {}) });
  const retry = async () => {
    setBusy(true);
    const ok = await pingServer();
    setBusy(false);
    useStore.setState({ serverOnline: ok });
    if (ok) { void bootstrapAccount(); pushToast(t('off.back'), 'good'); useStore.setState({ serverNotice: null }); }
    else pushToast(t('off.still'), 'warn');
  };
  return (
    <div className="overlay" onClick={close}>
      <div className="modal small srvnote" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={t('off.title')}>
        <h3>{t('off.title')}</h3>
        <Icon id="lock" size={64} className="srv-ico" />
        <p>{t('off.text', { what: t(notice.what) })}</p>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={retry}>{t('off.retry')}</button>
          <button className="btn" onClick={close}>{t('off.ok')}</button>
        </div>
      </div>
    </div>
  );
}
