import express, { Response, Router } from 'express';
import { levelFromXp } from '../../shared/src';
import { AuthedRequest, UserRow, auth, publicView, userById } from './accounts';
import { db } from './db';

/** Leaderboard (by rating or by level, everyone or just my friends), friends (add by code, accept, remove), public profiles. */

const friendIds = (me: string): string[] =>
  (db.prepare(`SELECT CASE WHEN from_id = ? THEN to_id ELSE from_id END AS id FROM friends
               WHERE status = 'accepted' AND (from_id = ? OR to_id = ?)`).all(me, me, me) as { id: string }[]).map((r) => r.id);

export function socialRouter(): Router {
  const r = express.Router();
  r.use(express.json({ limit: '8kb' }));

  // Top 50 + my own row and rank.
  r.get('/leaderboard', auth, (req: AuthedRequest, res: Response) => {
    const by = req.query.by === 'level' ? 'xp' : 'rating';
    const friendsOnly = req.query.scope === 'friends';
    const me = req.user!;
    const ids = friendsOnly ? [me.id, ...friendIds(me.id)] : null;
    const where = ids ? `WHERE id IN (${ids.map(() => '?').join(',')})` : '';
    // rated players first for the rating board, so brand-new accounts do not crowd it
    const order = by === 'rating' ? 'rated_games > 0 DESC, rating DESC, xp DESC' : 'xp DESC, rating DESC';
    const top = db.prepare(`SELECT * FROM users ${where} ORDER BY ${order}, created_at ASC LIMIT 50`).all(...(ids ?? [])) as unknown as UserRow[];
    const value = (u: UserRow) => (by === 'xp' ? u.xp : u.rating);
    const myRank = 1 + (db.prepare(`SELECT COUNT(*) AS n FROM users ${where ? where + ' AND' : 'WHERE'} ${by} > ?`).get(...(ids ?? []), value(me)) as { n: number }).n;
    res.json({
      by: by === 'xp' ? 'level' : 'rating', scope: friendsOnly ? 'friends' : 'global',
      rows: top.map((u, i) => ({ rank: i + 1, ...publicView(u), xp: u.xp, me: u.id === me.id })),
      me: { rank: myRank, ...publicView(me), xp: me.xp, me: true },
    });
  });

  // My friend code, friends, and pending requests both ways.
  r.get('/friends', auth, (req: AuthedRequest, res: Response) => {
    const me = req.user!.id;
    const rows = db.prepare(`SELECT f.from_id, f.to_id, f.status, u.* FROM friends f
      JOIN users u ON u.id = CASE WHEN f.from_id = ? THEN f.to_id ELSE f.from_id END
      WHERE f.from_id = ? OR f.to_id = ? ORDER BY u.last_seen DESC`).all(me, me, me) as unknown as (UserRow & { from_id: string; to_id: string; status: string })[];
    res.json({
      code: req.user!.friend_code,
      friends: rows.filter((x) => x.status === 'accepted').map(publicView),
      incoming: rows.filter((x) => x.status === 'pending' && x.to_id === me).map(publicView),
      outgoing: rows.filter((x) => x.status === 'pending' && x.from_id === me).map(publicView),
    });
  });

  // Send a request by friend code. If they already asked me, this accepts it.
  r.post('/friends/add', auth, (req: AuthedRequest, res: Response) => {
    const me = req.user!;
    const code = typeof req.body?.code === 'string' ? req.body.code.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
    const other = db.prepare('SELECT * FROM users WHERE friend_code = ?').get(code) as UserRow | undefined;
    if (!other) return res.status(404).json({ error: 'no player with that code' });
    if (other.id === me.id) return res.status(400).json({ error: 'that is your own code' });
    const theirs = db.prepare('SELECT status FROM friends WHERE from_id = ? AND to_id = ?').get(other.id, me.id) as { status: string } | undefined;
    if (theirs) db.prepare(`UPDATE friends SET status = 'accepted' WHERE from_id = ? AND to_id = ?`).run(other.id, me.id);
    else db.prepare(`INSERT OR IGNORE INTO friends (from_id, to_id, status, created_at) VALUES (?, ?, 'pending', ?)`).run(me.id, other.id, Date.now());
    res.json({ ok: true, accepted: !!theirs, player: publicView(other) });
  });

  r.post('/friends/accept', auth, (req: AuthedRequest, res: Response) => {
    const n = db.prepare(`UPDATE friends SET status = 'accepted' WHERE from_id = ? AND to_id = ? AND status = 'pending'`).run(String(req.body?.id ?? ''), req.user!.id).changes;
    res.status(n ? 200 : 404).json({ ok: !!n });
  });

  // Remove a friend, decline a request or cancel my own request.
  r.post('/friends/remove', auth, (req: AuthedRequest, res: Response) => {
    const id = String(req.body?.id ?? ''), me = req.user!.id;
    db.prepare('DELETE FROM friends WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)').run(me, id, id, me);
    res.json({ ok: true });
  });

  // A player's public profile (stats and achievements included; nothing private).
  r.get('/users/:id', auth, (req: AuthedRequest, res: Response) => {
    const u = userById(String(req.params.id));
    if (!u) return res.status(404).json({ error: 'not found' });
    res.json({ ...publicView(u), xp: u.xp, level: levelFromXp(u.xp), stats: JSON.parse(u.stats), ach: JSON.parse(u.ach), friend: friendIds(req.user!.id).includes(u.id) });
  });

  return r;
}
