import { Suspense, lazy, useEffect } from 'react';
import { TRACK_LENGTH } from '../../../shared/src';
import { OfferPanel, TurnScroll } from '../components/OfferPanel';
import { OppBar } from '../components/Seats';
import { Ribbon } from '../components/Ribbon';
import { useT } from '../i18n';
import { Popup } from '../components/Popup';
import { GameMenu } from '../components/GameMenu';
import { DragGhost } from '../components/DragGhost';
import { resign, send } from '../net';
import { flipHorizontal, flipVertical, resetSel, rotate, selectOffer, useStore } from '../store';
import { confirmPlacement } from '../actions';
import { PlaceBar } from '../components/PlaceBar';

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
      if (!g || g.current !== st.mySeat || g.phase === 'finished') return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      // e.code is the physical key, so shortcuts also work on a Persian keyboard layout
      const c = e.code;
      if (c === 'Enter' || c === 'NumpadEnter') { confirmPlacement(); return; }
      if (g.phase !== 'playing') return;
      if (c === 'KeyR') rotate();
      else if (c === 'KeyF') flipHorizontal();
      else if (c === 'KeyV') flipVertical();
      else if (c === 'Escape') resetSel();
      else if (c === 'KeyA') { resetSel(); send.advance(); }
      else if (/^(Digit|Numpad)[123]$/.test(c)) {
        const i = Number(c.slice(-1)) - 1;
        const me = g.players[st.mySeat];
        if (g.offer[i] && me.coins >= g.offer[i].coinCost) selectOffer(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!game) return <main className="screen center"><p className="muted">{t('game.waiting')}</p></main>;
  return (
    <main className="game">
      <OppBar />
      <section className="stage">
        <Suspense fallback={<div className="center muted">{t('game.loading3d')}</div>}><GameCanvas /></Suspense>
        <PlaceBar />
        <TurnScroll />
        <Ribbon />
        <Popup />
        <GameMenu />
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
