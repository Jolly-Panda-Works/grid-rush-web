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
            <button role="menuitem" onClick={() => { close(); useStore.setState({ showHelp: true }); }}><span className="gi">📜</span>{t('game.help')}</button>
            <button role="menuitem" onClick={() => useStore.setState({ settings: { ...settings, sound: !settings.sound } })}><span className="gi">{settings.sound ? '🔊' : '🔇'}</span>{t('menu.sound')}<span className={'tswitch' + (settings.sound ? ' on' : '')}><i /></span></button>
            <button role="menuitem" onClick={() => useStore.setState({ settings: { ...settings, reduceMotion: !settings.reduceMotion } })}><span className="gi">✨</span>{t('menu.reduce')}<span className={'tswitch' + (settings.reduceMotion ? ' on' : '')}><i /></span></button>
            <button role="menuitem" className="danger" onClick={() => { close(); useStore.setState({ confirmResign: true }); }}><span className="gi">🏳</span>{t('game.resign')}</button>
          </div>
        </>
      )}
    </>
  );
}
