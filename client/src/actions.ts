import { sfx } from './audio';
import { tr } from './i18n';
import { send } from './net';
import { pushToast, resetSel, useStore } from './store';
import { previewFor } from './three/placement';

/** Place the tile (or the 1x1 reward) where its ghost currently is. Returns false if it does not fit there. */
export function confirmPlacement(): boolean {
  const st = useStore.getState();
  const g = st.game;
  if (!g || g.current !== st.mySeat) return false;
  const pv = previewFor(g, st.mySeat, st.sel);
  if (!pv || !pv.valid || !st.sel.hover) { sfx.bad(); pushToast(tr('toast.noFit'), 'bad'); return false; }
  if (g.phase === 'placing_reward') send.reward(st.sel.hover[0], st.sel.hover[1]);
  else if (g.phase === 'playing' && st.sel.offer !== null) send.buy(st.sel.offer, pv.abs);
  else return false;
  sfx.place();
  resetSel();
  return true;
}
