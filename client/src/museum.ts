import type { PlacedTile } from '../../shared/src';
import { tr } from './i18n';
import { getHttpUrl } from './net';
import { saveProfile } from './profile';
import { pushToast, useStore } from './store';

/** Museum client: a local collection of every finished board + the online museum (exhibit, explore, vote). */

export interface Exhibit {
  id: string; ownerName: string; title: string; tiles: PlacedTile[]; score: number; createdAt: number;
  votes: number; mine: boolean; voted: boolean;
}
export interface CollectionItem { id: string; tiles: PlacedTile[]; score: number; won: boolean; opp: string; at: number }

/** XP for every vote your exhibits receive. */
export const XP_PER_VOTE = 5;
const COLLECTION_MAX = 24;
const PID_KEY = 'gridrush.pid.v1';
const COL_KEY = 'gridrush.collection.v1';

/** Random id of this device's player (the museum has no accounts yet). */
export function playerId(): string {
  try {
    let id = localStorage.getItem(PID_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(PID_KEY, id); }
    return id;
  } catch { return 'anon-' + Math.random().toString(36).slice(2, 12); }
}

export function loadCollection(): CollectionItem[] {
  try { const v = JSON.parse(localStorage.getItem(COL_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
/** Every finished board is kept on the device, so any of them can be exhibited later. */
export function addToCollection(item: Omit<CollectionItem, 'id' | 'at'>) {
  if (!item.tiles.length) return;
  const list = [{ ...item, id: Math.random().toString(36).slice(2, 10), at: Date.now() }, ...loadCollection()].slice(0, COLLECTION_MAX);
  try { localStorage.setItem(COL_KEY, JSON.stringify(list)); } catch { /* storage full or blocked: skip */ }
}

async function api<T>(path: string, init?: RequestInit): Promise<T | null> {
  const base = getHttpUrl();
  if (!base) return null;
  try {
    const r = await fetch(base.replace(/\/$/, '') + '/museum' + path, { ...init, headers: { 'Content-Type': 'application/json' } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

export const fetchExplore = (sort: 'top' | 'new') => api<Exhibit[]>(`/exhibits?sort=${sort}&pid=${encodeURIComponent(playerId())}`);
export const fetchMine = () => api<{ exhibits: Exhibit[]; points: number; max: number }>(`/me?pid=${encodeURIComponent(playerId())}`);
export const removeExhibit = (id: string) => api<{ ok: boolean }>(`/exhibits/${id}?pid=${encodeURIComponent(playerId())}`, { method: 'DELETE' });
export const voteExhibit = (id: string) => api<{ votes: number; voted: boolean }>(`/exhibits/${id}/vote`, { method: 'POST', body: JSON.stringify({ pid: playerId() }) });

export async function publishBoard(tiles: PlacedTile[], score: number, title = ''): Promise<boolean> {
  const name = useStore.getState().profile.name;
  const r = await api<Exhibit>('/exhibits', { method: 'POST', body: JSON.stringify({ pid: playerId(), name, title, tiles, score }) });
  if (r) unlockAchievement('museum');
  return !!r;
}

/** Turn newly received votes into XP (once each). */
export function claimVotes(points: number) {
  const p = useStore.getState().profile;
  const fresh = points - (p.museumSeen ?? 0);
  if (fresh <= 0) return;
  const next = { ...p, museumSeen: points, xp: p.xp + fresh * XP_PER_VOTE };
  saveProfile(next);
  useStore.setState({ profile: next });
  pushToast(tr('museum.newVotes', { n: fresh, xp: fresh * XP_PER_VOTE }), 'good');
}

/** Unlock a one-off achievement (if not unlocked yet) and announce it. */
export function unlockAchievement(id: string) {
  const p = useStore.getState().profile;
  if (p.ach[id]) return;
  const next = { ...p, ach: { ...p.ach, [id]: Date.now() } };
  saveProfile(next);
  useStore.setState({ profile: next });
  pushToast(tr('ach.unlocked', { name: tr('ach.' + id) }), 'good');
}
