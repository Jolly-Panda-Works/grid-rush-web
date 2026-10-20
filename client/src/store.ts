import { create } from 'zustand';
import type { GameState, Seat } from '../../shared/src';
import { Profile, Settings, loadProfile, loadSettings } from './profile';

export type Screen = 'loading' | 'menu' | 'matchmaking' | 'game' | 'results';
export interface Toast { id: number; text: string; tone: 'info' | 'good' | 'warn' | 'bad' }
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
  toasts: Toast[];
  flashes: Record<number, number>;
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
  toasts: [],
  flashes: {},
  showHelp: false,
  confirmResign: false,
  result: null,
}));

let toastId = 1;
export function pushToast(text: string, tone: Toast['tone'] = 'info') {
  const id = toastId++;
  useStore.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
  setTimeout(() => useStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3400);
}
export const setSel = (p: Partial<Selection>) => useStore.setState((s) => ({ sel: { ...s.sel, ...p } }));
export const resetSel = () => useStore.setState({ sel: { offer: null, rot: 0, flip: false, hover: null } });
