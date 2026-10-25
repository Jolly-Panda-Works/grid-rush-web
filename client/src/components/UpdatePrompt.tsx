import { useT } from '../i18n';
import { useStore } from '../store';
import { applyUpdate, skipUpdate } from '../update';

/** "A new version is ready" card, shown on the menu when the launch check found a newer release. */
export function UpdatePrompt() {
  const t = useT();
  const u = useStore((s) => s.update);
  const screen = useStore((s) => s.screen);
  if (!u || (screen !== 'menu' && screen !== 'loading')) return null;
  return (
    <div className="overlay">
      <div className="modal small update" role="dialog" aria-modal="true" aria-label={t('update.title')}>
        <div className="update-badge num" dir="ltr" data-latin>v{u.version}</div>
        <h3>{t('update.title')}</h3>
        <div className="mscroll">
        <p className="muted small">{t(u.kind === 'store' ? 'update.store' : u.kind === 'apk' ? 'update.apk' : 'update.reload')}</p>
        {u.notes.length > 0 && <ul className="update-notes">{u.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        </div>
        <div className="row">
          <button className="btn primary big" onClick={() => applyUpdate(u)}>{t('update.now')}</button>
          <button className="btn ghost" onClick={() => skipUpdate(u)}>{t('update.later')}</button>
        </div>
      </div>
    </div>
  );
}
