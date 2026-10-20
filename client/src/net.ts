import { Client, Room } from 'colyseus.js';
import { GameState, Seat, eloDelta, levelFromXp, xpForGame } from '../../shared/src';
import { sfx } from './audio';
import { saveProfile, profileLevel } from './profile';
import { pushToast, resetSel, useStore } from './store';
import { tr, trErr } from './i18n';

const HOST = location.hostname || 'localhost';
export const WS_URL: string = (import.meta.env.VITE_SERVER_URL as string | undefined) || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${HOST}:2567`;
export const HTTP_URL = WS_URL.replace(/^ws/, 'http');

let client: Client | null = null;
let room: Room | null = null;
let token = 0;            // invalidates stale async work after cancel
let leaving = false;
let lastEventId = 0;
let finalized = false;

export async function pingServer(): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(`${HTTP_URL}/health`, { signal: ctl.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}

export async function startSearch(solo: boolean) {
  const my = ++token;
  leaveRoom();
  leaving = false; finalized = false; lastEventId = 0;
  const st = useStore.getState();
  useStore.setState({
    screen: 'matchmaking', game: null, result: null, connection: 'ok', toasts: [],
    match: { status: 'connecting', solo, waitMs: 0, startedAt: Date.now() },
  });
  resetSel();
  try {
    client = new Client(WS_URL);
    const opts = { name: st.profile.name, level: profileLevel(st.profile), rating: st.profile.rating, solo, lang: st.settings.lang };
    const r = solo ? await client.create('grid_rush', opts) : await client.joinOrCreate('grid_rush', opts);
    if (my !== token) { r.leave(); return; }
    room = r;
    bind(r, my);
  } catch (e) {
    if (my !== token) return;
    console.error(e);
    useStore.setState((s) => ({ match: { ...s.match, status: 'error', error: 'connect' } }));
  }
}

function bind(r: Room, my: number) {
  r.onMessage('lobby', (m: { waitMs: number }) => {
    useStore.setState((s) => ({ match: { ...s.match, status: 'searching', waitMs: m.waitMs, startedAt: Date.now() } }));
  });
  r.onMessage('matched', (m: { seat: Seat; botTierName: string | null }) => {
    useStore.setState((s) => ({ mySeat: m.seat, match: { ...s.match, status: 'found', botTierName: m.botTierName } }));
    sfx.turn();
    setTimeout(() => {
      if (my === token && useStore.getState().match.status === 'found') useStore.setState({ screen: 'game' });
    }, 2600);
  });
  r.onMessage('state', (m: { state: GameState; turnLeft: number | null }) => onState(m.state, m.turnLeft));
  r.onMessage('notice', (m: { code: string; name: string }) => pushToast(tr('toast.timeout', { name: m.name }), 'warn'));
  r.onMessage('error', (m: { msg: string }) => { pushToast(trErr(m.msg), 'bad'); sfx.bad(); });
  r.onLeave(async (code: number) => {
    if (my !== token || leaving) return;
    const g = useStore.getState().game;
    if (!g || g.phase === 'finished') return;
    if (code === 1000) return;
    useStore.setState({ connection: 'reconnecting' });
    for (let i = 0; i < 6; i++) {
      try {
        const rr = await client!.reconnect(r.reconnectionToken);
        if (my !== token) { rr.leave(); return; }
        room = rr; bind(rr, my);
        useStore.setState({ connection: 'ok' });
        return;
      } catch { await new Promise((res) => setTimeout(res, 2000)); }
    }
    pushToast(tr('toast.lost'), 'bad');
    useStore.setState({ connection: 'ok', screen: 'menu', game: null });
  });
}

function nameOf(g: GameState, seat: Seat) { return seat === useStore.getState().mySeat ? tr('you') : g.players[seat].name; }

function onState(g: GameState, turnLeft: number | null) {
  const st = useStore.getState();
  const first = lastEventId === 0;
  const fresh = g.events.filter((e) => e.id > lastEventId);
  lastEventId = g.events.length ? g.events[g.events.length - 1].id : lastEventId;
  if (!first) {
    for (const e of fresh) {
      switch (e.k) {
        case 'buy': pushToast(tr('toast.buy', { name: nameOf(g, e.seat), c: e.coinCost, t: e.timeCost }), e.seat === st.mySeat ? 'good' : 'info'); sfx.place(); break;
        case 'advance': pushToast(tr('toast.advance', { name: nameOf(g, e.seat), s: e.steps, c: e.coins }), 'info'); sfx.advance(); break;
        case 'treasure': pushToast(tr('toast.treasure', { name: nameOf(g, e.seat), c: e.coins }), 'good'); sfx.coin(); useStore.setState((s) => ({ flashes: { ...s.flashes, [e.pos]: performance.now() } })); break;
        case 'reward': pushToast(tr('toast.reward', { name: nameOf(g, e.seat) }), 'good'); useStore.setState((s) => ({ flashes: { ...s.flashes, [e.pos]: performance.now() } })); break;
        case 'bonus7': pushToast(tr('toast.bonus7', { name: nameOf(g, e.seat) }), 'good'); sfx.bonus(); break;
        case 'turn': if (e.seat === st.mySeat) sfx.turn(); break;
      }
    }
  }
  const myTurnNow = g.current === st.mySeat && g.phase !== 'finished';
  const sel = st.sel;
  useStore.setState({
    game: g, turnLeft, turnRecvAt: performance.now(),
    sel: myTurnNow ? sel : { offer: null, rot: 0, flip: false, hover: null },
  });
  if (g.phase === 'finished' && !finalized) finalize(g);
}

function finalize(g: GameState) {
  finalized = true;
  const st = useStore.getState();
  const me = st.mySeat;
  const won = g.result!.winner === me;
  const p = st.profile;
  const opp = g.players[1 - me];
  const delta = eloDelta(p.rating, opp.rating, won);
  const xpGain = xpForGame(won);
  const next = { ...p, rating: Math.max(100, p.rating + delta), xp: p.xp + xpGain, wins: p.wins + (won ? 1 : 0), losses: p.losses + (won ? 0 : 1) };
  saveProfile(next);
  const info = {
    won, ratingBefore: p.rating, ratingAfter: next.rating, delta, xpGain, xpBefore: p.xp, xpAfter: next.xp,
    levelBefore: levelFromXp(p.xp), levelAfter: levelFromXp(next.xp),
  };
  useStore.setState({ profile: next, result: info });
  (won ? sfx.win : sfx.lose)();
  setTimeout(() => { if (useStore.getState().game === g || useStore.getState().game?.phase === 'finished') useStore.setState({ screen: 'results' }); }, 1800);
}

export function leaveRoom() {
  leaving = true;
  try { room?.leave(); } catch { /* ignore */ }
  room = null;
}
export function cancelSearch() { token++; leaveRoom(); useStore.setState({ screen: 'menu', match: { status: 'idle', solo: false, waitMs: 0, startedAt: 0 } }); }
export function backToMenu() { token++; leaveRoom(); useStore.setState({ screen: 'menu', game: null, result: null, confirmResign: false, match: { status: 'idle', solo: false, waitMs: 0, startedAt: 0 } }); resetSel(); }
export function resign() { room?.send('resign'); useStore.setState({ confirmResign: false }); }

export const send = {
  advance: () => room?.send('advance'),
  buy: (offer: number, cells: [number, number][]) => room?.send('buy', { offer, cells }),
  reward: (r: number, c: number) => room?.send('reward', { r, c }),
};
void levelFromXp;
