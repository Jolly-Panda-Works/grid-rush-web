import { create } from 'zustand';
import type { Action, GameState, Seat } from '../../shared/src';
import { Profile, Settings, loadProfile, loadSettings } from './profile';
import { nearestValid, previewFor } from './three/placement';

export type Screen = 'loading' | 'menu' | 'matchmaking' | 'game' | 'results' | 'museum';
export interface Popup { id: number; text: string; tone: 'info' | 'good' | 'warn' | 'bad' }
export interface Fx { id: number; kind: 'coins' | 'tile'; x: number; y: number; tx?: number; ty?: number; count?: number; color?: string }
export interface PendingFx { kind: 'treasure' | 'reward'; coins: number }
export interface MatchState {
  status: 'idle' | 'connecting' | 'searching' | 'found' | 'error';
  solo: boolean; waitMs: number; startedAt: number; error?: string; botTierName?: string | null;
}
export interface ResultInfo {
  won: boolean; ratingBefore: number; ratingAfter: number; delta: number;
  xpGain: number; xpBefore: number; xpAfter: number; levelBefore: number; levelAfter: number;
}
export interface Selection { offer: number | null; rot: number; flip: boolean; hover: [number, number] | null }

interface Store {
  screen: Screen;
  profile: Profile;
  settings: Settings;
  serverOnline: boolean | null;
  match: MatchState;
  game: GameState | null;
  mySeat: Seat;
  turnLeft: number | null;
  turnRecvAt: number;
  connection: 'ok' | 'reconnecting';
  sel: Selection;
  popups: Popup[];
  flashes: Record<number, number>;
  fx: Fx[];
  pendingFx: Record<string, PendingFx>;
  drag: { x: number; y: number } | null;
  advPreview: boolean; // finger / mouse on the Advance button: preview its move on the track
  oppIntent: { seat: Seat; action: Action } | null; // what the bot is about to do (shown before it plays)
  oppLog: string | null; // plain-language summary of the opponent's last action
  showHelp: boolean;
  showSettings: boolean;
  confirmResign: boolean;
  result: ResultInfo | null;
}

export const useStore = create<Store>(() => ({
  screen: 'loading',
  profile: loadProfile(),
  settings: loadSettings(),
  serverOnline: null,
  match: { status: 'idle', solo: false, waitMs: 0, startedAt: 0 },
  game: null,
  mySeat: 0,
  turnLeft: null,
  turnRecvAt: 0,
  connection: 'ok',
  sel: { offer: null, rot: 0, flip: false, hover: null },
  popups: [],
  flashes: {},
  fx: [],
  pendingFx: {},
  drag: null,
  advPreview: false,
  oppIntent: null,
  oppLog: null,
  showHelp: false,
  showSettings: false,
  confirmResign: false,
  result: null,
}));

let popupId = 1;
/** Notifications are shown one by one in a popup in the middle of the stage. */
export function pushToast(text: string, tone: Popup['tone'] = 'info') {
  const id = popupId++;
  useStore.setState((s) => ({ popups: [...s.popups.slice(-5), { id, text, tone }] }));
}
let fxId = 1;
export function spawnFx(fx: Omit<Fx, 'id'>) {
  const id = fxId++;
  useStore.setState((s) => ({ fx: [...s.fx.slice(-12), { ...fx, id }] }));
}
export const removeFx = (id: number) => useStore.setState((s) => ({ fx: s.fx.filter((f) => f.id !== id) }));
export const setSel = (p: Partial<Selection>) => useStore.setState((s) => ({ sel: { ...s.sel, ...p } }));
export const resetSel = () => useStore.setState({ sel: { offer: null, rot: 0, flip: false, hover: null } });

/** After the orientation changes, slide the ghost to the nearest spot where the tile still fits. */
function refit() {
  const st = useStore.getState();
  if (!st.game || st.sel.offer === null) return;
  const ok = previewFor(st.game, st.mySeat, st.sel)?.valid;
  if (!ok) setSel({ hover: nearestValid(st.game, st.mySeat, st.sel, st.sel.hover ?? undefined) ?? st.sel.hover });
}
export const rotate = () => { useStore.setState((st) => ({ sel: { ...st.sel, rot: (st.sel.rot + 1) % 4 } })); refit(); };
/** Screen-space mirrors of the currently shown orientation (shown = rotate(rot) after flip). */
export const flipHorizontal = () => { useStore.setState((st) => ({ sel: { ...st.sel, rot: (4 - st.sel.rot) % 4, flip: !st.sel.flip } })); refit(); };
export const flipVertical = () => { useStore.setState((st) => ({ sel: { ...st.sel, rot: (6 - st.sel.rot) % 4, flip: !st.sel.flip } })); refit(); };
/** Select an offer card: the tile appears on the board at the nearest place where it fits. */
export const selectOffer = (i: number) => {
  const st = useStore.getState();
  if (!st.game) return;
  const sel = { ...st.sel, offer: i };
  setSel({ offer: i, hover: nearestValid(st.game, st.mySeat, sel, st.sel.hover ?? undefined) });
};
