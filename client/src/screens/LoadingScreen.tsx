import { useEffect, useState } from 'react';
import { Logo } from '../components/Logo';
import { useT } from '../i18n';
import { pingServer } from '../net';
import { bootstrapAccount } from '../account';
import { refreshStory } from '../story';
import { firstLaunch } from '../levelFlow';
import { Icon, frameUrl, preloadArt, screenArtUrl } from '../art';
import { useStore } from '../store';

export default function LoadingScreen() {
  const t = useT();
  const [p, setP] = useState(0.05);
  const [label, setLabel] = useState('loading.fonts');
  const [tipIdx] = useState(() => Math.floor(Math.random() * 4));
  useEffect(() => {
    let alive = true;
    (async () => {
      const t0 = performance.now();
      try { await Promise.race([Promise.all([document.fonts.ready, preloadArt()]), new Promise((r) => setTimeout(r, 3000))]); } catch { /* ignore */ }
      if (!alive) return;
      setP(0.45); setLabel('loading.server');
      const ok = await pingServer();
      if (!alive) return;
      useStore.setState({ serverOnline: ok });
      if (ok) await Promise.race([bootstrapAccount().then(() => refreshStory()), new Promise((r) => setTimeout(r, 5000))]); // sign in (guest) and the story state
      setP(0.85); setLabel(ok ? 'loading.online' : 'loading.offline');
      await new Promise((r) => setTimeout(r, Math.max(0, 1500 - (performance.now() - t0))));
      if (!alive) return;
      setP(1);
      setTimeout(() => { if (!alive) return; useStore.setState({ screen: 'map' }); firstLaunch(); }, 250);
    })();
    return () => { alive = false; };
  }, []);
  // the painted courtyard; the logo sits in its empty sky, the bar and a tip on the dark ground below
  return (
    <main className="loading-art">
      <div className="ld-art">
        <img className="ld-bg" src={screenArtUrl('loading-bg')} alt="" draggable={false} />
        <div className="ld-logo"><Logo size={64} stacked /><div className="tagline">{t('tagline')}</div></div>
        <div className="lbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)} aria-label={t(label)}>
          <img className="lb-track" src={frameUrl('lbar-track')} alt="" draggable={false} />
          <div className="lb-fill" style={{ '--p': p } as React.CSSProperties}><img src={frameUrl('lbar-fill')} alt="" draggable={false} /></div>
          <img className="lb-frame" src={frameUrl('lbar-frame')} alt="" draggable={false} />
        </div>
        <div className="ld-label small">{t(label)}</div>
        <div className="ld-tip small"><Icon id="tip" size={22} /> {t('tip.' + tipIdx)}</div>
      </div>
    </main>
  );
}
