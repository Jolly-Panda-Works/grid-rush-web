import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { getWsUrl, cancelSearch, startSearch } from '../net';
import { profileLevel } from '../profile';
import { useStore } from '../store';
import { Medal, Spinner, avatarFor } from '../components/Medal';

export default function MatchmakingScreen() {
  const t = useT();
  const m = useStore((s) => s.match);
  const game = useStore((s) => s.game);
  const mySeat = useStore((s) => s.mySeat);
  const profile = useStore((s) => s.profile);
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 250); return () => clearInterval(i); }, []);
  const left = Math.max(0, Math.ceil((m.waitMs - (Date.now() - m.startedAt)) / 1000));

  if (m.status === 'error') {
    return (
      <main className="screen center">
        <h2>{t('mm.errTitle')}</h2>
        <p className="muted">{t('mm.err', { url: getWsUrl() || '-' })}</p>
        <div className="row"><button className="btn primary" onClick={() => startSearch(m.solo)}>{t('mm.again')}</button><button className="btn ghost" onClick={cancelSearch}>{t('mm.back')}</button></div>
      </main>
    );
  }
  if (m.status === 'found' && game) {
    const me = game.players[mySeat], opp = game.players[1 - mySeat];
    return (
      <main className="screen center found">
        <div className="vs">
          <div className="vcard opp">
            <Medal seat={(1 - mySeat) as 0 | 1} size={64} level={opp.level} avatar={avatarFor(opp.name)} />
            <div className="vtext">
              <h3>{opp.name}</h3>
              <div className="muted num">{t('hud.lv', { n: opp.level })} · {opp.rating}</div>
            </div>
          </div>
          <div className="vsmark"><span>VS</span></div>
          <div className="vcard me">
            <Medal seat={mySeat} size={64} level={profileLevel(profile)} avatar={profile.avatar} />
            <div className="vtext">
              <h3>{me.name}</h3>
              <div className="muted num">{t('hud.lv', { n: profileLevel(profile) })} · {me.rating}</div>
            </div>
          </div>
        </div>
        <p className="scroll-note">{game.current === mySeat ? t('mm.youStart') : t('mm.oppStarts', { name: opp.name })} {t('mm.ready')}</p>
      </main>
    );
  }
  return (
    <main className="screen center">
      <Spinner size={96} />
      <h2>{m.status === 'connecting' ? t('mm.connecting') : m.solo ? t('mm.prepBot') : t('mm.finding')}</h2>
      {m.status === 'searching' && !m.solo && <p className="muted">{t('mm.wait', { s: left })}</p>}
      <button className="btn ghost" onClick={cancelSearch}>{t('mm.cancel')}</button>
    </main>
  );
}
