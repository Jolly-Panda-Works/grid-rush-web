import { useCallback, useEffect, useState } from 'react';
import { api } from '../account';
import { Icon } from '../art';
import { Medal } from '../components/Medal';
import { PlayerCard, PublicPlayer } from '../components/PlayerCard';
import { Popup } from '../components/Popup';
import { useT } from '../i18n';
import { pushToast, useStore } from '../store';

interface Lists { code: string; friends: PublicPlayer[]; incoming: PublicPlayer[]; outgoing: PublicPlayer[] }

/** Friends: my friend code to share, add a friend by their code, requests to accept, the friends list (online first). */
export default function FriendsScreen() {
  const t = useT();
  const [lists, setLists] = useState<Lists | null | undefined>(undefined);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await api<Lists>('/friends');
    setLists(r?.ok ? r.data : null);
    if (!r) useStore.setState({ serverOnline: false, serverNotice: { what: 'off.what.fr', back: true } }); // the server went away
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    const r = await api<{ accepted: boolean; player: PublicPlayer; error?: string }>('/friends/add', { method: 'POST', body: { code: c } });
    setBusy(false);
    if (!r) { useStore.setState({ serverOnline: false, serverNotice: { what: 'off.what.fr' } }); return; }
    if (r.status === 404) { pushToast(t('fr.noSuchCode'), 'bad'); return; }
    if (r.status === 400) { pushToast(t('fr.ownCode'), 'warn'); return; }
    pushToast(r.data.accepted ? t('fr.nowFriends', { name: r.data.player.name }) : t('fr.sent', { name: r.data.player.name }), 'good');
    setCode('');
    void load();
  };
  const act = async (path: string, id: string) => { await api(path, { method: 'POST', body: { id } }); void load(); };
  const copy = async () => { try { await navigator.clipboard.writeText(lists!.code); pushToast(t('fr.copied'), 'good'); } catch { /* ignore */ } };

  const person = (p: PublicPlayer, actions: React.ReactNode) => (
    <div key={p.id} className="frrow">
      <button className="frwho" onClick={() => setOpen(p.id)}>
        <span className="frav"><Medal size={42} avatar={p.avatar} /><i className={'dot ' + (p.online ? 'on' : 'off')} /></span>
        <span className="lbname"><b>{p.name}</b><small className="num">{t('menu.lv', { n: p.level })} · <Icon id="trophy" size={14} />{p.rating}</small></span>
      </button>
      <span className="fract">{actions}</span>
    </div>
  );

  return (
    <main className="screen social">
      <header className="mhead">
        <button className="btn small" onClick={() => useStore.setState({ screen: 'menu' })}>{t('mm.back')}</button>
        <h2><Icon id="friends" size={30} /> {t('fr.title')}</h2>
        <span />
      </header>
      {lists === null && <div className="offnote small">{t('acct.needServer')}</div>}
      {lists && (
        <section className="mbody">
          <div className="mycode">
            <span className="small">{t('fr.myCode')}</span>
            <b className="num" dir="ltr" data-latin>{lists.code}</b>
            <button className="btn small" onClick={copy}><Icon id="copy" size={20} />{t('fr.copy')}</button>
          </div>
          <div className="addfr">
            <input dir="ltr" value={code} maxLength={8} placeholder={t('fr.codeHint')} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <button className="btn primary" disabled={busy || code.trim().length < 6} onClick={add}><Icon id="add-friend" size={22} />{t('fr.add')}</button>
          </div>
          {lists.incoming.length > 0 && (
            <>
              <h3 className="msec">{t('fr.requests')}</h3>
              {lists.incoming.map((p) => person(p, <>
                <button className="btn small primary" onClick={() => act('/friends/accept', p.id)}>{t('fr.accept')}</button>
                <button className="btn small ghost" onClick={() => act('/friends/remove', p.id)}>{t('fr.decline')}</button>
              </>))}
            </>
          )}
          <h3 className="msec">{t('fr.list')} <span className="num muted small">{lists.friends.length}</span></h3>
          {lists.friends.length === 0 && <p className="muted small">{t('fr.empty')}</p>}
          {[...lists.friends].sort((a, b) => Number(b.online) - Number(a.online)).map((p) => person(p, null))}
          {lists.outgoing.length > 0 && (
            <>
              <h3 className="msec">{t('fr.pending')}</h3>
              {lists.outgoing.map((p) => person(p, <button className="btn small ghost" onClick={() => act('/friends/remove', p.id)}>{t('fr.cancel')}</button>))}
            </>
          )}
        </section>
      )}
      {lists === undefined && <p className="muted small">{t('museum.loading')}</p>}
      {open && (
        <PlayerCard id={open} onClose={() => setOpen(null)}>
          {lists?.friends.some((f) => f.id === open) && (
            <button className="btn ghost small" onClick={() => { void act('/friends/remove', open); setOpen(null); }}>{t('fr.remove')}</button>
          )}
        </PlayerCard>
      )}
      <Popup />
    </main>
  );
}
