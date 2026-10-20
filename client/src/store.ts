import { create } from 'zustand';
import type { GameState, Seat } from '../../shared/src';
import { Profile, Settings, loadProfile, loadSettings } from './profile';

export type Screen = 'loading' | 'menu' | 'matchmaking' | 'game' | 'results';
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
  showHelp: boolean;
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
  showHelp: false,
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

/** Screen-space mirrors of the currently shown orientation (shown = rotate(rot) after flip). */
export const flipHorizontal = () => useStore.setState((st) => ({ sel: { ...st.sel, rot: (4 - st.sel.rot) % 4, flip: !st.sel.flip } }));
export const flipVertical = () => useStore.setState((st) => ({ sel: { ...st.sel, rot: (6 - st.sel.rot) % 4, flip: !st.sel.flip } }));
