import crypto from 'crypto';
import express, { NextFunction, Request, Response, Router } from 'express';
import { DEFAULT_RATING, eloDelta, levelFromXp } from '../../shared/src';
import { db, tx } from './db';

/**
 * Accounts. Every player starts as a guest (a server account bound to a random token kept on the device) and can
 * link a Google Play Games account so the same profile works on any phone.
 * The device owns progress (XP, wins, stats, achievements) and sends it here; the rating is owned by the server
 * and only changes in online matches, so the leaderboard cannot be pushed up from a phone.
 */
export interface UserRow {
  id: string; name: string; avatar: number; xp: number; rating: number; rated_games: number; wins: number; losses: number;
  stats: string; ach: string; friend_code: string; google_id: string | null; created_at: number; updated_at: number; last_seen: number;
}

const ONLINE_MS = 2 * 60_000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I

const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
const cleanName = (v: unknown) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 16) : '') || 'Player';
const int = (v: unknown, lo: number, hi: number, dflt: number) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v as number))) : dflt);
const jsonObj = (v: unknown, maxLen: number) => { try { const s = JSON.stringify(v && typeof v === 'object' ? v : {}); return s.length <= maxLen ? s : '{}'; } catch { return '{}'; } };

function newFriendCode(): string {
  for (;;) {
    const code = Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
    if (!db.prepare('SELECT 1 FROM users WHERE friend_code = ?').get(code)) return code;
  }
}

export function newSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)').run(hash(token), userId, Date.now());
  return token;
}

export function userByToken(token: unknown): UserRow | null {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  return (db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?').get(hash(token)) as UserRow | undefined) ?? null;
}
export const userById = (id: string) => (db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined) ?? null;

/** What a player may see about themselves. */
export function selfView(u: UserRow) {
  return {
    id: u.id, name: u.name, avatar: u.avatar, xp: u.xp, level: levelFromXp(u.xp), rating: u.rating, ratedGames: u.rated_games,
    wins: u.wins, losses: u.losses, stats: JSON.parse(u.stats), ach: JSON.parse(u.ach), friendCode: u.friend_code, linked: !!u.google_id,
  };
}
/** What other players may see (friends, leaderboard, public profile). */
export function publicView(u: UserRow) {
  return {
    id: u.id, name: u.name, avatar: u.avatar, level: levelFromXp(u.xp), rating: u.rating, wins: u.wins, losses: u.losses,
    online: Date.now() - u.last_seen < ONLINE_MS,
  };
}

export interface AuthedRequest extends Request { user?: UserRow }
/** Requires "Authorization: Bearer <token>". */
export function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
  const u = userByToken(m?.[1]);
  if (!u) return res.status(401).json({ error: 'not signed in' });
  db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(Date.now(), u.id);
  req.user = u;
  next();
}

/** Small per-IP limiter for account creation. */
const hits = new Map<string, number[]>();
function limited(req: Request, max: number, perMs: number): boolean {
  const key = req.ip ?? '?', now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < perMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

/** Progress a device reports. Values never go backwards (another device may have an older copy). */
function applyProgress(u: UserRow, body: Record<string, unknown>) {
  const xp = int(body.xp, 0, 10_000_000, u.xp);
  const newer = xp >= u.xp;
  db.prepare(`UPDATE users SET name = ?, avatar = ?, xp = ?, wins = ?, losses = ?, stats = ?, ach = ?, updated_at = ? WHERE id = ?`).run(
    body.name !== undefined ? cleanName(body.name) : u.name,
    body.avatar !== undefined ? int(body.avatar, 0, 63, u.avatar) : u.avatar,
    Math.max(u.xp, xp),
    newer ? Math.max(u.wins, int(body.wins, 0, 1e7, u.wins)) : u.wins,
    newer ? Math.max(u.losses, int(body.losses, 0, 1e7, u.losses)) : u.losses,
    newer && body.stats !== undefined ? jsonObj(body.stats, 4000) : u.stats,
    body.ach !== undefined ? jsonObj({ ...JSON.parse(u.ach), ...(body.ach as object) }, 4000) : u.ach,
    Date.now(), u.id,
  );
}

/** Online match finished: update the server-side rating of a signed-in player (Elo, the same formula as the client). */
export function applyOnlineResult(userId: string, opponentRating: number, won: boolean): { rating: number; delta: number } | null {
  const u = userById(userId);
  if (!u) return null;
  const delta = eloDelta(u.rating, opponentRating, won);
  const rating = Math.max(100, u.rating + delta);
  db.prepare('UPDATE users SET rating = ?, rated_games = rated_games + 1, updated_at = ? WHERE id = ?').run(rating, Date.now(), userId);
  return { rating, delta };
}

/** Google Play Games: exchange the one-time server auth code for the player's id. Needs GOOGLE_CLIENT_ID / _SECRET. */
async function googlePlayerId(code: string): Promise<{ id: string; name: string } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID, secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !secret) throw Object.assign(new Error('Google sign-in is not configured on the server'), { status: 501 });
  const tok = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: secret, grant_type: 'authorization_code', redirect_uri: '' }),
  });
  if (!tok.ok) return null;
  const { access_token } = (await tok.json()) as { access_token?: string };
  if (!access_token) return null;
  const me = await fetch('https://games.googleapis.com/games/v1/players/me', { headers: { Authorization: `Bearer ${access_token}` } });
  if (!me.ok) return null;
  const p = (await me.json()) as { playerId?: string; displayName?: string };
  return p.playerId ? { id: p.playerId, name: p.displayName ?? '' } : null;
}

export function accountsRouter(): Router {
  const r = express.Router();
  r.use(express.json({ limit: '32kb' }));

  // A new guest account, seeded with whatever progress the device already has.
  r.post('/auth/guest', (req: Request, res: Response) => {
    if (limited(req, 20, 60 * 60_000)) return res.status(429).json({ error: 'too many accounts' });
    const now = Date.now(), id = crypto.randomUUID();
    tx(() => {
      db.prepare(`INSERT INTO users (id, name, avatar, rating, friend_code, created_at, updated_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, cleanName(req.body?.name), int(req.body?.avatar, 0, 63, 0), DEFAULT_RATING, newFriendCode(), now, now, now);
      applyProgress(userById(id)!, req.body ?? {});
    });
    res.json({ token: newSession(id), user: selfView(userById(id)!) });
  });

  r.get('/me', auth, (req: AuthedRequest, res: Response) => res.json(selfView(req.user!)));
  r.put('/me', auth, (req: AuthedRequest, res: Response) => { applyProgress(req.user!, req.body ?? {}); res.json(selfView(userById(req.user!.id)!)); });

  // Link Google Play Games. If that Google account already has a profile, sign in to it instead (the reply says so).
  r.post('/auth/google', auth, async (req: AuthedRequest, res: Response) => {
    try {
      const code = typeof req.body?.code === 'string' ? req.body.code : '';
      if (!code) return res.status(400).json({ error: 'missing code' });
      const g = await googlePlayerId(code);
      if (!g) return res.status(401).json({ error: 'Google rejected the sign-in' });
      const owner = db.prepare('SELECT * FROM users WHERE google_id = ?').get(g.id) as UserRow | undefined;
      if (owner && owner.id !== req.user!.id) return res.json({ switched: true, token: newSession(owner.id), user: selfView(owner) });
      db.prepare('UPDATE users SET google_id = ?, updated_at = ? WHERE id = ?').run(g.id, Date.now(), req.user!.id);
      res.json({ switched: false, user: selfView(userById(req.user!.id)!) });
    } catch (e) {
      res.status((e as { status?: number }).status ?? 500).json({ error: (e as Error).message });
    }
  });

  return r;
}
