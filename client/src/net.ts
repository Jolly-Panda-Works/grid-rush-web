import { Client, Room } from 'colyseus.js';
import { Action, GameState, Seat, eloDelta, levelFromXp, xpForGame } from '../../shared/src';
import { sfx } from './audio';
import { saveProfile, profileLevel } from './profile';
import { pushRibbon, pushToast, resetSel, setSel, useStore } from './store';
import { TRAUMA, addTrauma } from './three/shake';
import { nearestValid } from './three/placement';
import { tr, trErr } from './i18n';
import { LocalSession } from './local';
import { addToCollection } from './museum';
import { matchToken, syncProgress } from './account';
import { GameSummary, newlyUnlocked } from './achievements';
import { BOT_TIER_NAMES } from '../../shared/src';

const HOST = location.hostname || 'localhost';
const SERVER_KEY = 'gridrush.server';
import { isNative } from './device';
export { isNative };
// Build-time default (VITE_SERVER_URL). In a native app there is no sensible default: the player enters the address.
const DEFAULT_WS: string = (import.meta.env.VITE_SERVER_URL as string | undefined) || (isNative() ? '' : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${HOST}:2567`);

export function normalizeServer(input: string): string {
  let v = input.trim().replace(/\/+$/, '');
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) v = v.replace(/^http/i, 'ws');
  else if (!/^wss?:\/\//i.test(v)) v = 'ws://' + v;
  return v;
}
export const getWsUrl = (): string => { try { return localStorage.getItem(SERVER_KEY) || DEFAULT_WS; } catch { return DEFAULT_WS; } };
export const getHttpUrl = (): string => getWsUrl().replace(/^ws/, 'http');
export function setServerUrl(input: string) { try { const v = normalizeServer(input); if (v) localStorage.setItem(SERVER_KEY, v); else localStorage.removeItem(SERVER_KEY); } catch { /* ignore */ } }

export async function pingServer(): Promise<boolean> {
  if (!getWsUrl()) return false;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1800);
    const r = await fetch(`${getHttpUrl()}/health`, { signal: ctl.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}

let client: Client | null = null;
let room: Room | null = null;
let token = 0;            // invalidates stale async work after cancel
let leaving = false;
let lastEventId = 0;
let finalized = false;
let gotFirst = false;
let local: LocalSession | null = null;   // offline game running inside the app
let mine = { treasures: 0, treasureCoins: 0, rewards: 0 }; // my counts in the current game (for stats / achievements)

export async function startSearch(solo: boolean) {
  const my = ++token;
  leaveRoom();
  leaving = false; finalized = false; lastEventId = 0; gotFirst = false; mine = { treasures: 0, treasureCoins: 0, rewards: 0 };
  const st = useStore.getState();
  useStore.setState({
    screen: 'matchmaking', game: null, result: null, connection: 'ok', popups: [], fx: [], pendingFx: {}, drag: null, orient: {}, rotAnim: null,
    match: { status: 'connecting', solo, waitMs: 0, startedAt: Date.now() },
  });
  resetSel();
  // Playing against a bot never needs the server: it runs on this device.
  if (solo) return startLocal(my, false);
  if (!getWsUrl()) return startLocal(my, true);
  try {
    client = new Client(getWsUrl());
    const opts = { name: st.profile.name, level: profileLevel(st.profile), rating: st.profile.rating, solo: false, lang: st.settings.lang, token: matchToken() };
    const r = await client.joinOrCreate('grid_rush', opts);
    if (my !== token) { r.leave(); return; }
    room = r;
    bind(r, my);
  } catch (e) {
    if (my !== token) return;
    console.warn('online server unreachable, playing offline vs bot', e);
    startLocal(my, true);
  }
}

/** Offline bot game. `fallback` = the player asked for an online match but no server could be reached. */
function startLocal(my: number, fallback: boolean) {
  const st = useStore.getState();
  const session = new LocalSession({
    human: { name: st.profile.name, isBot: false, level: profileLevel(st.profile), rating: st.profile.rating },
    lang: st.settings.lang,
    deliver: (g) => onState(g, null),
    onError: (m) => { pushToast(trErr(m), 'bad'); sfx.bad(); },
    onIntent: (seat, action) => useStore.setState({ oppIntent: { seat, action } }),
  });
  local = session;
  onState(session.snapshot(), null);
  useStore.setState((s) => ({
    mySeat: session.humanSeat,
    match: { ...s.match, status: 'found', solo: true, botTierName: BOT_TIER_NAMES[session.botTier - 1] },
  }));
  sfx.turn();
  setTimeout(() => {
    if (my !== token || local !== session) return;
    useStore.setState({ screen: 'game' });
    session.begin();
    if (fallback) pushToast(tr('toast.offlineBot'), 'warn');
  }, 2600);
}

function bind(r: Room, my: number) {
  r.onMessage('lobby', (m: { waitMs: number }) => {
    useStore.setState((s) => ({ match: { ...s.match, status: 'searching', waitMs: m.waitMs, startedAt: Date.now() } }));
  });
  r.onMessage('matched', (m: { seat: Seat; botTierName: string | null }) => {
    useStore.setState((s) => ({ mySeat: m.seat, match: { ...s.match, status: 'found', botTierName: m.botTierName } }));
    sfx.turn();
    setTimeout(() => {
      if (my === token && useStore.getState().match.status === 'found') {
        useStore.setState({ screen: 'game' });
        const g = useStore.getState().game;
      }
    }, 2600);
  });
  r.onMessage('state', (m: { state: GameState; turnLeft: number | null }) => onState(m.state, m.turnLeft));
  r.onMessage('intent', (m: { seat: Seat; action: Action }) => useStore.setState({ oppIntent: m }));
  r.onMessage('notice', (m: { code: string; name: string }) => pushToast(tr('toast.timeout', { name: m.name }), 'warn'));
  // the server owns the rating: take its value after an online match
  r.onMessage('rating', (m: { rating: number; delta: number }) => {
    const s = useStore.getState();
    const profile = { ...s.profile, rating: m.rating };
    saveProfile(profile);
    useStore.setState({ profile, result: s.result ? { ...s.result, ratingAfter: m.rating, delta: m.delta } : s.result });
  });
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
  const first = !gotFirst;
  gotFirst = true;
  const fresh = g.events.filter((e) => e.id > lastEventId);
  lastEventId = g.events.length ? g.events[g.events.length - 1].id : lastEventId;
  let oppLog = st.oppLog;
  if (!first) {
    for (const e of fresh) {
      if (e.k === 'turn' && e.seat !== st.mySeat) oppLog = null;
      const opp = 'seat' in e && e.seat !== st.mySeat ? g.players[e.seat].name : null;
      if (opp && e.k === 'buy') oppLog = tr('log.buy', { name: opp, c: e.coinCost, t: e.timeCost });
      if (opp && e.k === 'advance') oppLog = tr('log.advance', { name: opp, s: e.steps, c: e.coins });
      if (opp && e.k === 'treasure' && e.coins > 0) oppLog = `${oppLog ?? ''} · ${tr('log.treasure', { c: e.coins })}`;
      if (opp && e.k === 'reward') oppLog = `${oppLog ?? ''} · ${tr('log.reward')}`;
      // Notifications only for things the player cannot already see on the screen (board, track, turn pill).
      switch (e.k) {
        case 'buy': sfx.place(); addTrauma(TRAUMA.small); break;
        case 'advance': sfx.advance(); break;
        case 'treasure':
          if (e.seat === st.mySeat) { mine.treasures++; mine.treasureCoins += e.coins; }
          sfx.coin();
          if (e.seat === st.mySeat && e.coins > 0) addTrauma(TRAUMA.medium);
          useStore.getState().pendingFx[`${e.seat}:${e.pos}`] = { kind: 'treasure', coins: e.coins };
          break;
        case 'reward': if (e.seat === st.mySeat) mine.rewards++; useStore.getState().pendingFx[`${e.seat}:${e.pos}`] = { kind: 'reward', coins: 0 }; break;
        case 'bonus7': pushRibbon(tr('rib.bonus7'), 'big', tr('toast.bonus7', { name: nameOf(g, e.seat) })); sfx.bonus(); addTrauma(TRAUMA.large); break;
        case 'turn':
          // the hand-over is the rule players miss most, so it is always announced in words
          // the hand-over is the rule players miss most: a big banner every time
          if (e.seat === st.mySeat) { sfx.turn(); pushRibbon(tr('rib.yourTurn'), 'mine'); }
          else pushRibbon(tr('rib.oppTurn', { name: g.players[e.seat].name }), 'opp', tr('rib.passed'));
          break;
      }
    }
  }
  const myTurnNow = g.current === st.mySeat && g.phase !== 'finished';
  const sel = st.sel;
  useStore.setState({
    game: g, turnLeft, turnRecvAt: performance.now(), oppIntent: null, oppLog,
    sel: myTurnNow ? sel : { offer: null, rot: 0, flip: false, hover: null },
    // a bought tile leaves the offer: drop its remembered orientation
    orient: Object.fromEntries(Object.entries(st.orient).filter(([uid]) => g.offer.some((t) => t.uid === Number(uid)))),
  });
  if (g.phase === 'placing_reward' && g.current === st.mySeat && !useStore.getState().sel.hover) {
    setSel({ hover: nearestValid(g, st.mySeat, useStore.getState().sel) });
  }
  if (g.phase === 'finished' && !finalized) finalize(g);
}

function finalize(g: GameState) {
  finalized = true;
  const st = useStore.getState();
  const me = st.mySeat;
  const won = g.result!.winner === me;
  const p = st.profile;
  const opp = g.players[1 - me];
  const practice = !!local; // offline games against the bot are practice: XP and stats, but no rating change
  const delta = practice ? 0 : eloDelta(p.rating, opp.rating, won);
  const xpGain = xpForGame(won);
  const sc = g.result!.scores[me], my = g.players[me];
  const summary: GameSummary = {
    won, score: sc.total, empty: sc.emptyCells, coins: sc.coins, bonus7: my.bonus7, tiles: my.tiles.length,
    treasures: mine.treasures, vsBotTier: opp.isBot ? opp.botTier : null,
  };
  const s = p.stats;
  const streak = won ? s.streak + 1 : 0;
  const stats = {
    ...s, games: s.games + 1, streak, bestStreak: Math.max(s.bestStreak, streak),
    bestScore: s.bestScore === null ? sc.total : Math.max(s.bestScore, sc.total), totalScore: s.totalScore + sc.total, scoredGames: s.scoredGames + 1,
    bonus7: s.bonus7 + (my.bonus7 ? 1 : 0), fullBoards: s.fullBoards + (sc.emptyCells === 0 ? 1 : 0), tiles: s.tiles + my.tiles.length,
    treasures: s.treasures + mine.treasures, treasureCoins: s.treasureCoins + mine.treasureCoins, rewards: s.rewards + mine.rewards,
    botMasterWins: s.botMasterWins + (won && opp.isBot && opp.botTier >= 5 ? 1 : 0),
  };
  const next = { ...p, rating: Math.max(100, p.rating + delta), xp: p.xp + xpGain, wins: p.wins + (won ? 1 : 0), losses: p.losses + (won ? 0 : 1), stats };
  const fresh = g.result!.reason === 'forfeit' || g.result!.reason === 'timeout' ? newlyUnlocked(next, { ...summary, coins: 0, treasures: 0 }) : newlyUnlocked(next, summary);
  if (fresh.length) next.ach = { ...next.ach, ...Object.fromEntries(fresh.map((id) => [id, Date.now()])) };
  saveProfile(next);
  addToCollection({ tiles: g.players[me].tiles, score: g.result!.scores[me].total, won, opp: opp.name });
  const info = {
    won, ratingBefore: p.rating, ratingAfter: next.rating, delta, xpGain, xpBefore: p.xp, xpAfter: next.xp,
    levelBefore: levelFromXp(p.xp), levelAfter: levelFromXp(next.xp), newAch: fresh, practice,
  };
  useStore.setState({ profile: next, result: info });
  void syncProgress();
  (won ? sfx.win : sfx.lose)();
  setTimeout(() => { if (useStore.getState().game === g || useStore.getState().game?.phase === 'finished') useStore.setState({ screen: 'results' }); }, 1800);
}

export function leaveRoom() {
  leaving = true;
  local?.stop(); local = null;
  try { room?.leave(); } catch { /* ignore */ }
  room = null;
}
export function cancelSearch() { token++; leaveRoom(); useStore.setState({ screen: 'menu', match: { status: 'idle', solo: false, waitMs: 0, startedAt: 0 } }); }
export function backToMenu() { token++; leaveRoom(); useStore.setState({ screen: 'menu', game: null, result: null, confirmResign: false, match: { status: 'idle', solo: false, waitMs: 0, startedAt: 0 } }); resetSel(); }
export function resign() { if (local) local.resign(); else room?.send('resign'); useStore.setState({ confirmResign: false }); }

export const send = {
  advance: () => (local ? local.act({ t: 'advance' }) : room?.send('advance')),
  buy: (offer: number, cells: [number, number][]) => (local ? local.act({ t: 'buy', offer, cells }) : room?.send('buy', { offer, cells })),
  reward: (r: number, c: number) => (local ? local.act({ t: 'reward', r, c }) : room?.send('reward', { r, c })),
};
void levelFromXp;
