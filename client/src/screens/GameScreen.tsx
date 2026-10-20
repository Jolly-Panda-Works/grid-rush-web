import { Suspense, lazy, useEffect } from 'react';
import { TRACK_LENGTH } from '../../../shared/src';
import { Hud } from '../components/Hud';
import { OfferPanel } from '../components/OfferPanel';
import { Toasts } from '../components/Toasts';
import { resign, send } from '../net';
import { resetSel, setSel, useStore } from '../store';

const GameCanvas = lazy(() => import('../three/GameCanvas'));
void TRACK_LENGTH;

export default function GameScreen() {
  const conn = useStore((s) => s.connection);
  const confirm = useStore((s) => s.confirmResign);
  const game = useStore((s) => s.game);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      const g = st.game;
      if (!g || g.current !== st.mySeat || g.phase !== 'playing') return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'r') setSel({ rot: (st.sel.rot + 1) % 4 });
      else if (k === 'f') setSel({ flip: !st.sel.flip });
      else if (k === 'escape') resetSel();
      else if (k === 'a') { resetSel(); send.advance(); }
      else if (['1', '2', '3'].includes(k)) {
        const i = Number(k) - 1;
        const me = g.players[st.mySeat];
        if (g.offer[i] && me.coins >= g.offer[i].coinCost) setSel({ offer: i, rot: 0, flip: false, hover: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!game) return <main className="screen center"><p className="muted">Waiting for game state…</p></main>;
  return (
    <main className="game">
      <Hud />
      <section className="stage">
        <Suspense fallback={<div className="center muted">Loading 3D…</div>}><GameCanvas /></Suspense>
        <Toasts />
        <button className="resign" onClick={() => useStore.setState({ confirmResign: true })}>Resign</button>
        {conn === 'reconnecting' && <div className="overlay soft"><div className="modal small">Connection lost. Reconnecting…</div></div>}
        {game.phase === 'finished' && <div className="overlay soft"><div className="modal small">Game over. Calculating results…</div></div>}
      </section>
      <OfferPanel />
      {confirm && (
        <div className="overlay" onClick={() => useStore.setState({ confirmResign: false })}>
          <div className="modal small" onClick={(e) => e.stopPropagation()}>
            <h3>Resign this game?</h3>
            <p className="muted">Your opponent wins and your rating drops.</p>
            <div className="row"><button className="btn danger" onClick={resign}>Resign</button><button className="btn ghost" onClick={() => useStore.setState({ confirmResign: false })}>Keep playing</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
