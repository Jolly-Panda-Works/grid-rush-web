import { tr } from './i18n';
import { getHttpUrl } from './net';
import { Profile, emptyStats, saveProfile } from './profile';
import { pushToast, useStore } from './store';

/**
 * The player's server account. Everyone is signed in as a guest automatically (a token kept on the device) as soon
 * as the game server is reachable; a Google Play Games account can be linked so the profile follows the player.
 * The device keeps playing offline; progress is synced whenever the server is reachable.
 */
const TOKEN_KEY = 'gridrush.token.v1';
const PLAY_GAMES_CLIENT_ID = import.meta.env.VITE_PLAY_GAMES_CLIENT_ID || '';

export interface Account { id: string; friendCode: string; linked: boolean; rating: number; ratedGames: number }
interface ServerUser extends Account { name: string; avatar: number; xp: number; wins: number; losses: number; stats: Profile['stats']; ach: Record<string, number> }

const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const setToken = (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } };

/** Call the game server's account API; null when it cannot be reached. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ ok: boolean; status: number; data: T } | null> {
  const base = getHttpUrl();
  if (!base) return null;
  try {
    const token = getToken();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(base.replace(/\/$/, '') + '/api' + path, {
      method: init.method ?? 'GET', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    clearTimeout(timer);
    return { ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as T };
  } catch { return null; }
}

const progressOf = (p: Profile) => ({ name: p.name, avatar: p.avatar, xp: p.xp, wins: p.wins, losses: p.losses, stats: p.stats, ach: p.ach });

/** Bring the server's view of me into the local profile (rating always; the rest if the server is further along). */
function adopt(u: ServerUser, preferServer: boolean) {
  const p = useStore.getState().profile;
  const next: Profile = preferServer
    ? { ...p, name: u.name, avatar: u.avatar, xp: u.xp, wins: u.wins, losses: u.losses, stats: { ...emptyStats(), ...u.stats }, ach: { ...p.ach, ...u.ach }, rating: u.rating }
    : { ...p, rating: u.rating, ach: { ...u.ach, ...p.ach } };
  saveProfile(next);
  useStore.setState({ profile: next, account: { id: u.id, friendCode: u.friendCode, linked: u.linked, rating: u.rating, ratedGames: u.ratedGames } });
}

/** At launch: create the guest account the first time, otherwise reconcile with the server. */
export async function bootstrapAccount(): Promise<void> {
  const p = useStore.getState().profile;
  if (!getToken()) {
    const r = await api<{ token: string; user: ServerUser }>('/auth/guest', { method: 'POST', body: progressOf(p) });
    if (r?.ok) { setToken(r.data.token); adopt(r.data.user, false); }
    return;
  }
  const r = await api<ServerUser>('/me');
  if (!r) return; // offline: keep playing locally
  if (r.status === 401) { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } return bootstrapAccount(); } // server lost the session
  if (!r.ok) return;
  if (r.data.xp > p.xp) adopt(r.data, true); // another device of mine is further along
  else { adopt(r.data, false); if (p.xp > r.data.xp || p.name !== r.data.name || p.avatar !== r.data.avatar) void syncProgress(); }
}

let syncing: Promise<void> | null = null;
/** Send my progress to the server (after a game, after editing the profile). */
export function syncProgress(): Promise<void> {
  if (!getToken()) return Promise.resolve();
  syncing = (syncing ?? Promise.resolve()).then(async () => {
    const r = await api<ServerUser>('/me', { method: 'PUT', body: progressOf(useStore.getState().profile) });
    if (r?.ok) adopt(r.data, false);
  });
  return syncing;
}

/** The token for online matches (the server then uses my server profile and updates my rating). */
export const matchToken = () => getToken() ?? undefined;

interface PlayGamesPlugin { serverAuthCode(o: { clientId: string }): Promise<{ code: string }> }
const playGames = (): PlayGamesPlugin | null =>
  ((window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor?.Plugins?.PlayGamesAuth as PlayGamesPlugin | undefined) ?? null;
export const canLinkGoogle = () => !!playGames() && !!PLAY_GAMES_CLIENT_ID;

/** Link Google Play Games. If that Google account already has a profile, switch to it (after asking). */
export async function linkGoogle(confirmSwitch: () => boolean): Promise<void> {
  const plugin = playGames();
  if (!plugin || !PLAY_GAMES_CLIENT_ID) { pushToast(tr('acct.googleUnavailable'), 'warn'); return; }
  let code = '';
  try { code = (await plugin.serverAuthCode({ clientId: PLAY_GAMES_CLIENT_ID })).code; } catch { pushToast(tr('acct.googleFailed'), 'bad'); return; }
  const r = await api<{ switched: boolean; token?: string; user: ServerUser; error?: string }>('/auth/google', { method: 'POST', body: { code } });
  if (!r) { pushToast(tr('museum.offline'), 'warn'); return; }
  if (!r.ok) { pushToast(r.status === 501 ? tr('acct.googleNotConfigured') : tr('acct.googleFailed'), 'bad'); return; }
  if (r.data.switched && r.data.token) {
    if (!confirmSwitch()) return;
    setToken(r.data.token);
    adopt(r.data.user, true);
  } else adopt(r.data.user, false);
  pushToast(tr('acct.linked'), 'good');
}
