import { useEffect, useState } from 'react';
import { Logo } from '../components/Logo';
import { pingServer } from '../net';
import { useStore } from '../store';

const TIPS = [
  'Ending the game does not mean winning it. Check the score first.',
  'Advance pays more the further your opponent is ahead.',
  'Treasure cells pay out all the coins engraved on your tiles.',
  'Every empty cell costs you 2 points at the end.',
];

export default function LoadingScreen() {
  const [p, setP] = useState(0.05);
  const [label, setLabel] = useState('Loading fonts');
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  useEffect(() => {
    let alive = true;
    (async () => {
      const t0 = performance.now();
      try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2000))]); } catch { /* ignore */ }
      if (!alive) return;
      setP(0.45); setLabel('Contacting game server');
      const ok = await pingServer();
      if (!alive) return;
      useStore.setState({ serverOnline: ok });
      setP(0.85); setLabel(ok ? 'Server online' : 'Server offline');
      const wait = Math.max(0, 1500 - (performance.now() - t0));
      await new Promise((r) => setTimeout(r, wait));
      if (!alive) return;
      setP(1);
      setTimeout(() => alive && useStore.setState({ screen: 'menu' }), 250);
    })();
    return () => { alive = false; };
  }, []);
  return (
    <main className="screen center loading">
      <Logo size={64} stacked />
      <div className="tagline">Build Your Grid. Beat the Clock.</div>
      <div className="bar"><div style={{ width: `${p * 100}%` }} /></div>
      <div className="muted small">{label}…</div>
      <div className="tip muted small">{tip}</div>
    </main>
  );
}
