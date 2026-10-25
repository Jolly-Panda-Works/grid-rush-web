import { useState } from 'react';
import { Icon } from '../art';
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
      <button className="gmenu-btn" onClick={() => setOpen((o) => !o)} aria-label={t('game.menu')} aria-expanded={open}><Icon id="menu" size={26} /></button>
      {open && (
        <>
          <div className="gmenu-scrim" onClick={close} />
          <div className="gmenu" role="menu">
            <button role="menuitem" onClick={() => { close(); useStore.setState({ showHelp: true }); }}><span className="gi"><Icon id="quests" size={24} /></span>{t('game.help')}</button>
            <button role="menuitem" onClick={() => useStore.setState({ settings: { ...settings, sound: !settings.sound } })}><span className="gi"><Icon id={settings.sound ? 'sound-on' : 'sound-off'} size={24} /></span>{t('menu.sound')}<span className={'tswitch' + (settings.sound ? ' on' : '')}><i /></span></button>
            <button role="menuitem" onClick={() => useStore.setState({ settings: { ...settings, reduceMotion: !settings.reduceMotion } })}><span className="gi"><Icon id="motion" size={24} /></span>{t('menu.reduce')}<span className={'tswitch' + (settings.reduceMotion ? ' on' : '')}><i /></span></button>
            <button role="menuitem" className="danger" onClick={() => { close(); useStore.setState({ confirmResign: true }); }}><span className="gi"><Icon id="resign" size={24} /></span>{t('game.resign')}</button>
          </div>
        </>
      )}
    </>
  );
}
