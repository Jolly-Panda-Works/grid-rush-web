import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import express, { Request, Response, Router } from 'express';
import { BOARD_SIZE, Cell, PlacedTile, SHAPE_IDS } from '../../shared/src';
import { db, tx } from './db';

/**
 * Museum: players exhibit finished boards, other players vote for them; every vote is a museum point for the owner.
 * Stored in the server database (an older museum.json is imported once). Players are identified by a random id
 * their device generates (not an account: good enough for a first version, not tamper-proof).
 */
export const MAX_EXHIBITS_PER_PLAYER = 6;

// one-time import of the museum.json file used before the database existed
const OLD_FILE = process.env.MUSEUM_FILE || path.resolve(__dirname, '../data/museum.json');
if (fs.existsSync(OLD_FILE) && !db.prepare('SELECT 1 FROM exhibits LIMIT 1').get()) {
  try {
    const old = JSON.parse(fs.readFileSync(OLD_FILE, 'utf8')) as { id: string; ownerId: string; ownerName: string; title: string; tiles: PlacedTile[]; score: number; createdAt: number; voters: string[] }[];
    tx(() => {
      for (const e of old) {
        db.prepare('INSERT OR IGNORE INTO exhibits (id, owner_id, owner_name, title, tiles, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(e.id, e.ownerId, e.ownerName, e.title, JSON.stringify(e.tiles), e.score, e.createdAt);
        for (const v of e.voters) db.prepare('INSERT OR IGNORE INTO votes (exhibit_id, voter_id) VALUES (?, ?)').run(e.id, v);
      }
    });
    fs.renameSync(OLD_FILE, OLD_FILE + '.imported');
  } catch (err) { console.warn('[museum] could not import', OLD_FILE, err); }
}

interface Row { id: string; owner_id: string; owner_name: string; title: string; tiles: string; score: number; created_at: number; votes: number; voted: number }
/** Exhibits with their vote count and whether the viewer (first parameter) voted. */
const SELECT = `SELECT e.*, (SELECT COUNT(*) FROM votes v WHERE v.exhibit_id = e.id) AS votes,
  (SELECT COUNT(*) FROM votes v WHERE v.exhibit_id = e.id AND v.voter_id = ?) AS voted FROM exhibits e`;

const validPid = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9-]{8,64}$/i.test(v);
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, max) : '');

/** A board must be real: known shapes, cells on the board, no overlaps. */
function validTiles(v: unknown): PlacedTile[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > BOARD_SIZE * BOARD_SIZE) return null;
  const used = new Set<number>();
  const out: PlacedTile[] = [];
  for (const t of v) {
    if (!t || !Number.isInteger(t.uid) || !SHAPE_IDS.includes(t.shape) || !Array.isArray(t.cells) || t.cells.length === 0 || t.cells.length > 5) return null;
    const cells: Cell[] = [];
    for (const c of t.cells) {
      if (!Array.isArray(c) || !Number.isInteger(c[0]) || !Number.isInteger(c[1])) return null;
      const [r, col] = c;
      if (r < 0 || col < 0 || r >= BOARD_SIZE || col >= BOARD_SIZE || used.has(r * BOARD_SIZE + col)) return null;
      used.add(r * BOARD_SIZE + col);
      cells.push([r, col]);
    }
    const engraved = Number.isInteger(t.engraved) ? Math.max(0, Math.min(5, t.engraved)) : 0;
    out.push({ uid: t.uid, shape: t.shape, engraved, cells });
  }
  return out;
}

const view = (e: Row, pid?: string) => ({
  id: e.id, ownerName: e.owner_name, title: e.title, tiles: JSON.parse(e.tiles), score: e.score, createdAt: e.created_at,
  votes: e.votes, mine: !!pid && e.owner_id === pid, voted: !!e.voted,
});

export function museumRouter(): Router {
  const r = express.Router();
  r.use(express.json({ limit: '64kb' }));

  // Explore: everybody's exhibits, best first or newest first
  r.get('/exhibits', (req: Request, res: Response) => {
    const pid = validPid(req.query.pid) ? req.query.pid : '';
    const order = req.query.sort === 'new' ? 'e.created_at DESC' : 'votes DESC, e.created_at DESC';
    const limit = Math.max(1, Math.min(60, Number(req.query.limit) || 30));
    res.json((db.prepare(`${SELECT} ORDER BY ${order} LIMIT ?`).all(pid, limit) as unknown as Row[]).map((e) => view(e, pid)));
  });

  // My museum + my museum points (= votes received)
  r.get('/me', (req: Request, res: Response) => {
    if (!validPid(req.query.pid)) return res.status(400).json({ error: 'bad player id' });
    const pid = req.query.pid;
    const mine = db.prepare(`${SELECT} WHERE e.owner_id = ? ORDER BY e.created_at DESC`).all(pid, pid) as unknown as Row[];
    res.json({ exhibits: mine.map((e) => view(e, pid)), points: mine.reduce((n, e) => n + e.votes, 0), max: MAX_EXHIBITS_PER_PLAYER });
  });

  r.post('/exhibits', (req: Request, res: Response) => {
    const { pid } = req.body ?? {};
    if (!validPid(pid)) return res.status(400).json({ error: 'bad player id' });
    const tiles = validTiles(req.body.tiles);
    if (!tiles) return res.status(400).json({ error: 'bad board' });
    const count = (db.prepare('SELECT COUNT(*) AS n FROM exhibits WHERE owner_id = ?').get(pid) as { n: number }).n;
    if (count >= MAX_EXHIBITS_PER_PLAYER) return res.status(409).json({ error: 'museum full' });
    const id = randomUUID();
    db.prepare('INSERT INTO exhibits (id, owner_id, owner_name, title, tiles, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, pid, clean(req.body.name, 16) || 'Player', clean(req.body.title, 40), JSON.stringify(tiles), Number.isFinite(req.body.score) ? Math.round(req.body.score) : 0, Date.now());
    res.json(view(db.prepare(`${SELECT} WHERE e.id = ?`).get(pid, id) as unknown as Row, pid));
  });

  r.delete('/exhibits/:id', (req: Request, res: Response) => {
    const e = db.prepare('SELECT owner_id FROM exhibits WHERE id = ?').get(req.params.id) as { owner_id: string } | undefined;
    if (!e) return res.status(404).json({ error: 'not found' });
    if (e.owner_id !== req.query.pid) return res.status(403).json({ error: 'not yours' });
    db.prepare('DELETE FROM exhibits WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // One vote per player per exhibit (tap again to take it back); you cannot vote for yourself
  r.post('/exhibits/:id/vote', (req: Request, res: Response) => {
    const { pid } = req.body ?? {};
    if (!validPid(pid)) return res.status(400).json({ error: 'bad player id' });
    const e = db.prepare('SELECT owner_id FROM exhibits WHERE id = ?').get(req.params.id) as { owner_id: string } | undefined;
    if (!e) return res.status(404).json({ error: 'not found' });
    if (e.owner_id === pid) return res.status(403).json({ error: 'own exhibit' });
    const had = db.prepare('DELETE FROM votes WHERE exhibit_id = ? AND voter_id = ?').run(req.params.id, pid).changes > 0;
    if (!had) db.prepare('INSERT INTO votes (exhibit_id, voter_id) VALUES (?, ?)').run(req.params.id, pid);
    const votes = (db.prepare('SELECT COUNT(*) AS n FROM votes WHERE exhibit_id = ?').get(req.params.id) as { n: number }).n;
    res.json({ votes, voted: !had });
  });

  return r;
}
