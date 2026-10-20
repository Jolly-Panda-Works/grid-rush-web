import { Suspense, lazy, useEffect } from 'react';
import { TRACK_LENGTH } from '../../../shared/src';
import { Hud } from '../components/Hud';
import { OfferPanel } from '../components/OfferPanel';
import { useT } from '../i18n';
import { Popup } from '../components/Popup';
import { DragGhost } from '../components/DragGhost';
import { resign, send } from '../net';
import { flipHorizontal, flipVertical, resetSel, setSel, useStore } from '../store';

const GameCanvas = lazy(() => import('../three/GameCanvas'));
void TRACK_LENGTH;

export default function GameScreen() {
  const t = useT();
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
      else if (k === 'f') flipHorizontal();
      else if (k === 'v') flipVertical();
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

  if (!game) return <main className="screen center"><p className="muted">{t('game.waiting')}</p></main>;
  return (
    <main className="game">
      <Hud />
      <section className="stage">
        <Suspense fallback={<div className="center muted">{t('game.loading3d')}</div>}><GameCanvas /></Suspense>
        <Popup />
        <button className="resign" onClick={() => useStore.setState({ confirmResign: true })}>{t('game.resign')}</button>
        {conn === 'reconnecting' && <div className="overlay soft"><div className="modal small">{t('game.reconnecting')}</div></div>}
        {game.phase === 'finished' && <div className="overlay soft"><div className="modal small">{t('game.over')}</div></div>}
      </section>
      <OfferPanel />
      <DragGhost />
      {confirm && (
        <div className="overlay" onClick={() => useStore.setState({ confirmResign: false })}>
          <div className="modal small" onClick={(e) => e.stopPropagation()}>
            <h3>{t('game.resignTitle')}</h3>
            <p className="muted">{t('game.resignText')}</p>
            <div className="row"><button className="btn danger" onClick={resign}>{t('game.resign')}</button><button className="btn ghost" onClick={() => useStore.setState({ confirmResign: false })}>Keep playing</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
