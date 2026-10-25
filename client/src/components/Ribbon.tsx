import { useEffect, useState } from 'react';
import { useStore } from '../store';

/** Big banner that sweeps across the table for the moments that matter (your turn, their turn, 7x7 bonus),
 *  like the "YOUR TURN" banner of card games. Pops in with an overshoot, holds, sweeps out. Never blocks input. */
export function Ribbon() {
  const r = useStore((s) => s.ribbon);
  const [phase, setPhase] = useState<'in' | 'out' | null>(null);
  useEffect(() => {
    if (!r) return;
    setPhase('in');
    const t1 = setTimeout(() => setPhase('out'), r.tone === 'big' ? 1700 : 1150);
    const t2 = setTimeout(() => { setPhase(null); useStore.setState((s) => (s.ribbon?.id === r.id ? { ribbon: null } : {})); }, r.tone === 'big' ? 2100 : 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [r]);
  if (!r || !phase) return null;
  return (
    <div className={`ribbon-wrap ${phase}`} aria-live="assertive">
      <div className={`ribbon ${r.tone}`}>
        <span className="rib-title">{r.title}</span>
        {r.sub && <span className="rib-sub">{r.sub}</span>}
      </div>
    </div>
  );
}
