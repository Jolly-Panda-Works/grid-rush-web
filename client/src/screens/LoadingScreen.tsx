import { useEffect, useState } from 'react';
import { Logo } from '../components/Logo';
import { Spinner } from '../components/Medal';
import { useT } from '../i18n';
import { pingServer } from '../net';
import { bootstrapAccount } from '../account';
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
      try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2000))]); } catch { /* ignore */ }
      if (!alive) return;
      setP(0.45); setLabel('loading.server');
      const ok = await pingServer();
      if (!alive) return;
      useStore.setState({ serverOnline: ok });
      if (ok) await Promise.race([bootstrapAccount(), new Promise((r) => setTimeout(r, 4000))]); // sign in (guest) in the background of loading
      setP(0.85); setLabel(ok ? 'loading.online' : 'loading.offline');
      await new Promise((r) => setTimeout(r, Math.max(0, 1500 - (performance.now() - t0))));
      if (!alive) return;
      setP(1);
      setTimeout(() => alive && useStore.setState({ screen: 'menu' }), 250);
    })();
    return () => { alive = false; };
  }, []);
  return (
    <main className="screen center loading">
      <Logo size={64} stacked />
      <div className="tagline">{t('tagline')}</div>
      <Spinner size={64} />
      <div className="goldbar"><div style={{ width: `${p * 100}%` }} /></div>
      <div className="muted small">{t(label)}</div>
      <div className="scroll-note small">💡 {t('tip.' + tipIdx)}</div>
    </main>
  );
}
