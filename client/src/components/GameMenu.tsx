import { useState } from 'react';
import { useT } from '../i18n';
import { useStore } from '../store';

/** One ☰ button instead of separate Help and Resign buttons. */
export function GameMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const settings = useStore((s) => s.settings);
  const close = () => setOpen(false);
  return (
    <>
      <button className="gmenu-btn" onClick={() => setOpen((o) => !o)} aria-label={t('game.menu')} aria-expanded={open}>☰</button>
      {open && (
        <>
          <div className="gmenu-scrim" onClick={close} />
          <div className="gmenu" role="menu">
            <button role="menuitem" onClick={() => { close(); useStore.setState({ showHelp: true }); }}>{t('game.help')}</button>
            <button role="menuitem" onClick={() => useStore.setState({ settings: { ...settings, sound: !settings.sound } })}>{t('menu.sound')}: {settings.sound ? '✓' : '✕'}</button>
            <button role="menuitem" className="danger" onClick={() => { close(); useStore.setState({ confirmResign: true }); }}>{t('game.resign')}</button>
          </div>
        </>
      )}
    </>
  );
}
