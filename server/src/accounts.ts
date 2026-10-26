import crypto from 'crypto';
import express, { NextFunction, Request, Response, Router } from 'express';
import { DEFAULT_RATING, eloDelta, levelFromXp } from '../../shared/src';
import { db, tx } from './db';
import { maskEmail, sendLoginCode } from './mailer';

/**
 * Accounts. Every player starts as a guest (a server account bound to a random token kept on the device) and can
 * attach sign-in methods (an email with one-time codes, Google Play Games) so the same profile works on any phone.
 * See docs/accounts.md.
 * The device owns progress (XP, wins, stats, achievements) and sends it here; the rating is owned by the server
 * and only changes in online matches, so the leaderboard cannot be pushed up from a phone.
 */
export interface UserRow {
  id: string; name: string; avatar: number; xp: number; rating: number; rated_games: number; wins: number; losses: number;
  stats: string; ach: string; friend_code: string; google_id: string | null; created_at: number; updated_at: number; last_seen: number;
}

const ONLINE_MS = 2 * 60_000;
const SESSION_IDLE_MS = 180 * 24 * 3600_000; // a session unused for 180 days has expired
const CODE_TTL_MS = 10 * 60_000, CODE_MAX_TRIES = 5, RESEND_S = 60;
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
  return (db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND COALESCE(s.last_used, s.created_at) > ?')
    .get(hash(token), Date.now() - SESSION_IDLE_MS) as UserRow | undefined) ?? null;
}

/** The sign-in methods of an account, as the player may see them (never the full email). */
function logins(userId: string) {
  const rows = db.prepare('SELECT provider, subject FROM identities WHERE user_id = ?').all(userId) as { provider: string; subject: string }[];
  const email = rows.find((r) => r.provider === 'email')?.subject;
  return { ...(email ? { email: maskEmail(email) } : {}), google: rows.some((r) => r.provider === 'google') };
}
const ownerOf = (provider: string, subject: string) =>
  (db.prepare('SELECT u.* FROM identities i JOIN users u ON u.id = i.user_id WHERE i.provider = ? AND i.subject = ?').get(provider, subject) as UserRow | undefined) ?? null;
function attach(provider: string, subject: string, userId: string) {
  tx(() => {
    db.prepare('DELETE FROM identities WHERE provider = ? AND user_id = ?').run(provider, userId); // one email / one Google per account
    db.prepare('INSERT INTO identities (provider, subject, user_id, created_at) VALUES (?, ?, ?, ?)').run(provider, subject, userId, Date.now());
  });
}
export const userById = (id: string) => (db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined) ?? null;

/** What a player may see about themselves. */
export function selfView(u: UserRow) {
  return {
    id: u.id, name: u.name, avatar: u.avatar, xp: u.xp, level: levelFromXp(u.xp), rating: u.rating, ratedGames: u.rated_games,
    wins: u.wins, losses: u.losses, stats: JSON.parse(u.stats), ach: JSON.parse(u.ach), friendCode: u.friend_code, ...withLogins(u.id),
  };
}
function withLogins(userId: string) {
  const l = logins(userId);
  return { logins: l, linked: !!l.email || l.google };
}
/** What other players may see (friends, leaderboard, public profile). */
export function publicView(u: UserRow) {
  return {
    id: u.id, name: u.name, avatar: u.avatar, level: levelFromXp(u.xp), rating: u.rating, wins: u.wins, losses: u.losses,
    online: Date.now() - u.last_seen < ONLINE_MS,
  };
}

export interface AuthedRequest extends Request { user?: UserRow; tokenHash?: string }
/** Requires "Authorization: Bearer <token>". */
export function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
  const u = userByToken(m?.[1]);
  if (!u) return res.status(401).json({ error: 'not signed in' });
  const now = Date.now();
  db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(now, u.id);
  req.tokenHash = hash(m![1]);
  db.prepare('UPDATE sessions SET last_used = ? WHERE token_hash = ?').run(now, req.tokenHash);
  req.user = u;
  next();
}

/** Small in-memory rate limiter (one server is enough; several servers would need it in the database). */
const hits = new Map<string, number[]>();
function limited(req: Request, max: number, perMs: number, key = 'ip:' + (req.ip ?? '?')): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < perMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

/** Tests only: forget the rate-limit counters. */
export function resetRateLimits() { hits.clear(); }

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
      const owner = ownerOf('google', g.id);
      if (owner && owner.id !== req.user!.id) return res.json({ switched: true, token: newSession(owner.id), user: selfView(owner), other: otherView(owner) });
      attach('google', g.id, req.user!.id);
      res.json({ switched: false, user: selfView(userById(req.user!.id)!) });
    } catch (e) {
      res.status((e as { status?: number }).status ?? 500).json({ error: (e as Error).message });
    }
  });

  // ---- email with one-time codes ----
  r.post('/auth/email/start', auth, async (req: AuthedRequest, res: Response) => {
    const email = normEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'bad email' });
    // the same answer whether or not the email has an account, so nobody can probe which emails play
    if (limited(req, 1, 60_000, 'mail1:' + email) || limited(req, 5, 3600_000, 'mailh:' + email) || limited(req, 10, 3600_000, 'mailip:' + (req.ip ?? '?'))) {
      return res.status(429).json({ error: 'too many codes', resendIn: RESEND_S });
    }
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const now = Date.now();
    db.prepare(`INSERT INTO login_codes (email, code_hash, expires_at, attempts, sent_at) VALUES (?, ?, ?, 0, ?)
      ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at`)
      .run(email, hash(email + ':' + code), now + CODE_TTL_MS, now);
    try { await sendLoginCode(email, code, req.body?.lang === 'fa' ? 'fa' : 'en'); } catch (e) {
      console.error('[mail] sending failed', e);
      return res.status(502).json({ error: 'could not send the email' });
    }
    res.json({ ok: true, resendIn: RESEND_S });
  });

  r.post('/auth/email/verify', auth, (req: AuthedRequest, res: Response) => {
    const email = normEmail(req.body?.email);
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'bad code' });
    if (limited(req, 30, 3600_000, 'verify:' + (req.ip ?? '?'))) return res.status(429).json({ error: 'too many tries' });
    const row = db.prepare('SELECT * FROM login_codes WHERE email = ?').get(email) as { code_hash: string; expires_at: number; attempts: number } | undefined;
    if (!row || row.expires_at < Date.now() || row.attempts >= CODE_MAX_TRIES) return res.status(401).json({ error: 'code expired' });
    const ok = crypto.timingSafeEqual(Buffer.from(row.code_hash, 'hex'), Buffer.from(hash(email + ':' + code), 'hex'));
    if (!ok) {
      db.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?').run(email);
      return res.status(401).json({ error: 'wrong code', triesLeft: Math.max(0, CODE_MAX_TRIES - row.attempts - 1) });
    }
    db.prepare('DELETE FROM login_codes WHERE email = ?').run(email); // one use only
    const owner = ownerOf('email', email);
    if (owner && owner.id !== req.user!.id) return res.json({ switched: true, token: newSession(owner.id), user: selfView(owner), other: otherView(owner) });
    attach('email', email, req.user!.id);
    res.json({ switched: false, user: selfView(userById(req.user!.id)!) });
  });

  // ---- unlink, sign out, delete ----
  const unlink = (provider: string) => (req: AuthedRequest, res: Response) => {
    db.prepare('DELETE FROM identities WHERE provider = ? AND user_id = ?').run(provider, req.user!.id); // other sessions stay signed in
    res.json({ user: selfView(userById(req.user!.id)!) });
  };
  r.delete('/auth/email', auth, unlink('email'));
  r.delete('/auth/google', auth, unlink('google'));
  r.post('/auth/logout', auth, (req: AuthedRequest, res: Response) => {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.tokenHash!);
    res.json({ ok: true });
  });
  r.delete('/me', auth, (req: AuthedRequest, res: Response) => {
    if (req.body?.confirm !== 'DELETE') return res.status(400).json({ error: 'confirm with "DELETE"' });
    const id = req.user!.id;
    tx(() => {
      // museum boards are keyed by the device's player id, which the client sends along
      const pid = typeof req.body?.pid === 'string' ? req.body.pid : '';
      if (pid) db.prepare('DELETE FROM exhibits WHERE owner_id = ?').run(pid);
      db.prepare('DELETE FROM users WHERE id = ?').run(id); // sessions, identities and friends go with it (ON DELETE CASCADE)
    });
    res.json({ ok: true });
  });

  return r;
}

/** The profile a sign-in would switch to, for the confirmation (only shown after a correct code / Google sign-in). */
const otherView = (u: UserRow) => ({ name: u.name, level: levelFromXp(u.xp), rating: u.rating });

/** trim + lower case, at most 254 characters, a simple x@y.z check. Gmail dots and "+" are kept (that rule is Gmail's own). */
export function normEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}
