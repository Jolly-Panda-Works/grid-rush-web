import { create } from 'zustand';
import type { Action, GameState, Seat } from '../../shared/src';
import type { UpdateInfo } from './update';
import type { Account } from './account';
import { Profile, Settings, loadProfile, loadSettings } from './profile';
import { bestFit, hoverKeeping, placedCells } from './three/placement';
import { tr } from './i18n';

export type Screen = 'splash' | 'loading' | 'profile' | 'leaderboard' | 'friends' | 'menu' | 'matchmaking' | 'game' | 'results' | 'museum';
export interface Popup { id: number; text: string; tone: 'info' | 'good' | 'warn' | 'bad' }
export interface RibbonMsg { id: number; title: string; sub?: string; tone: 'mine' | 'opp' | 'big' }
export interface Fx { id: number; kind: 'coins' | 'tile'; x: number; y: number; tx?: number; ty?: number; count?: number; color?: string }
export interface PendingFx { kind: 'treasure' | 'reward'; coins: number }
export interface MatchState {
  status: 'idle' | 'connecting' | 'searching' | 'found' | 'error';
  solo: boolean; waitMs: number; startedAt: number; error?: string; botTierName?: string | null;
}
export interface ResultInfo {
  won: boolean; ratingBefore: number; ratingAfter: number; delta: number;
  xpGain: number; xpBefore: number; xpAfter: number; levelBefore: number; levelAfter: number; newAch?: string[]; practice?: boolean;
}
export interface Selection { offer: number | null; rot: number; flip: boolean; hover: [number, number] | null }
export interface Orient { rot: number; flip: boolean }
/** The last turn / flip of the ghost, for its animation around `pivot` (a board cell). */
export interface RotAnim { id: number; kind: 'rot' | 'rotBack' | 'flipH' | 'flipV' | 'set'; pivot: [number, number]; t0: number }

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
  orient: Record<number, Orient>; // each offered tile (by uid) keeps its own orientation
  rotAnim: RotAnim | null;
  layoutTick: number; // bumps when the 3D layout changes (DOM overlays re-measure)
  popups: Popup[];
  flashes: Record<number, number>;
  fx: Fx[];
  pendingFx: Record<string, PendingFx>;
  drag: { x: number; y: number } | null;
  advPreview: boolean; // finger / mouse on the Advance button: preview its move on the track
  oppIntent: { seat: Seat; action: Action } | null; // what the bot is about to do (shown before it plays)
  oppLog: string | null; // plain-language summary of the opponent's last action
  ribbon: RibbonMsg | null; // big banner for important moments (turn change, bonus)
  rewardCard: { id: number; seat: Seat } | null; // a 1x1 tile was just collected: show it as a card
  update: UpdateInfo | null; // a newer release was found at launch
  account: Account | null; // my server account (null while offline / not signed in yet)
  showHelp: boolean;
  showSettings: boolean;
  confirmResign: boolean;
  result: ResultInfo | null;
}

export const useStore = create<Store>(() => ({
  screen: 'splash',
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
  orient: {},
  rotAnim: null,
  layoutTick: 0,
  popups: [],
  flashes: {},
  fx: [],
  pendingFx: {},
  drag: null,
  advPreview: false,
  oppIntent: null,
  oppLog: null,
  ribbon: null,
  rewardCard: null,
  update: null,
  account: null,
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
let ribbonId = 1;
export function pushRibbon(title: string, tone: RibbonMsg['tone'], sub?: string) {
  useStore.setState({ ribbon: { id: ribbonId++, title, sub, tone } });
}
let rewardId = 1;
/** Show the "you got a 1x1 tile" card (or the opponent's version) right when the marker reaches the reward cell. */
export function pushRewardCard(seat: Seat) {
  useStore.setState({ rewardCard: { id: rewardId++, seat } });
}
let fxId = 1;
export function spawnFx(fx: Omit<Fx, 'id'>) {
  const id = fxId++;
  useStore.setState((s) => ({ fx: [...s.fx.slice(-12), { ...fx, id }] }));
}
export const removeFx = (id: number) => useStore.setState((s) => ({ fx: s.fx.filter((f) => f.id !== id) }));
export const setSel = (p: Partial<Selection>) => useStore.setState((s) => ({ sel: { ...s.sel, ...p } }));
export const resetSel = () => useStore.setState({ sel: { offer: null, rot: 0, flip: false, hover: null }, rotAnim: null });

let animId = 1;
/**
 * Change the ghost's orientation without moving it away: the tile cell under `pivot` (the cell the player touched,
 * or the cell nearest to the ghost's centre) stays where it is. If the turned tile no longer fits there it simply
 * shows red; it never jumps somewhere else. The orientation is remembered for that card.
 */
function reorient(rot: number, flip: boolean, kind: RotAnim['kind'], pivot?: [number, number]) {
  const st = useStore.getState();
  const g = st.game, sel = st.sel;
  if (!g || sel.offer === null || !g.offer[sel.offer]) return;
  const tile = g.offer[sel.offer];
  let hover = sel.hover;
  let at: [number, number] | null = pivot ?? hover;
  if (hover && at) {
    const now = placedCells(tile.cells, sel.rot, sel.flip, hover);
    let k = now.findIndex(([r, c]) => r === at![0] && c === at![1]);
    if (k < 0) { // pivot is not on the tile (e.g. the ⟳ button): use the tile cell closest to it
      let best = Infinity;
      now.forEach(([r, c], i) => { const d = (r - at![0]) ** 2 + (c - at![1]) ** 2; if (d < best) { best = d; k = i; } });
    }
    at = now[k];
    hover = hoverKeeping(tile.cells, rot, flip, k, at);
  }
  useStore.setState({
    sel: { ...sel, rot, flip, hover },
    orient: { ...st.orient, [tile.uid]: { rot, flip } },
    rotAnim: at ? { id: animId++, kind, pivot: at, t0: performance.now() } : null,
  });
}
/** Turn the ghost 90° clockwise (counter-clockwise with dir = -1) around `pivot`. */
export const rotate = (pivot?: [number, number], dir: 1 | -1 = 1) => { const s = useStore.getState().sel; reorient((s.rot + (dir === 1 ? 1 : 3)) % 4, s.flip, dir === 1 ? 'rot' : 'rotBack', pivot); };
/** Screen-space mirrors of the currently shown orientation (shown = rotate(rot) after flip). */
export const flipHorizontal = (pivot?: [number, number]) => { const s = useStore.getState().sel; reorient((4 - s.rot) % 4, !s.flip, 'flipH', pivot); };
export const flipVertical = (pivot?: [number, number]) => { const s = useStore.getState().sel; reorient((6 - s.rot) % 4, !s.flip, 'flipV', pivot); };
/** Pick one orientation directly (orientation strip). */
export const setOrientation = (o: Orient) => reorient(o.rot, o.flip, 'set');

/** Take an offer card with the orientation it had last time (drag start: no ghost yet). */
export const pickOffer = (i: number, hover: [number, number] | null = null) => {
  const st = useStore.getState();
  const tile = st.game?.offer[i];
  const o = (tile && st.orient[tile.uid]) || { rot: 0, flip: false };
  setSel({ offer: i, rot: o.rot, flip: o.flip, hover });
};
/** Select an offer card: the tile appears on the board, in its own orientation, at the nearest place where it fits. */
export const selectOffer = (i: number) => {
  const st = useStore.getState();
  if (!st.game) return;
  const tile = st.game.offer[i];
  const o = (tile && st.orient[tile.uid]) || { rot: 0, flip: false };
  const sel = { ...st.sel, offer: i, rot: o.rot, flip: o.flip };
  const fit = bestFit(st.game, st.mySeat, sel, st.sel.hover ?? undefined);
  if (!fit) { setSel({ offer: i, rot: o.rot, flip: o.flip, hover: null }); return; }
  applyFit(i, fit);
};

/** Show the ghost where bestFit put it; if it had to turn the tile to make it fit, say so and remember that orientation. */
export function applyFit(i: number, fit: { rot: number; flip: boolean; hover: [number, number]; turned: boolean }) {
  const st = useStore.getState();
  const tile = st.game?.offer[i];
  useStore.setState({
    sel: { ...st.sel, offer: i, rot: fit.rot, flip: fit.flip, hover: fit.hover },
    orient: tile ? { ...st.orient, [tile.uid]: { rot: fit.rot, flip: fit.flip } } : st.orient,
    rotAnim: fit.turned ? { id: animId++, kind: 'set', pivot: fit.hover, t0: performance.now() } : st.rotAnim,
  });
  if (fit.turned) pushToast(tr('toast.turnedToFit'), 'info');
}
