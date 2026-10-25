import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import express, { Request, Response, Router } from 'express';
import { BOARD_SIZE, Cell, PlacedTile, SHAPE_IDS } from '../../shared/src';

/**
 * Museum: players exhibit finished boards, other players vote for them; every vote is a museum point for the owner.
 * Storage is a single JSON file (no database yet). Players are identified by a random id their device generates
 * (not an account: good enough for a first version, not tamper-proof).
 */
export const MAX_EXHIBITS_PER_PLAYER = 6;

interface Exhibit {
  id: string; ownerId: string; ownerName: string; title: string;
  tiles: PlacedTile[]; score: number; createdAt: number; voters: string[];
}

const FILE = process.env.MUSEUM_FILE || path.resolve(__dirname, '../data/museum.json');
let exhibits: Exhibit[] = [];
try { exhibits = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { exhibits = []; }

let saveTimer: NodeJS.Timeout | null = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(exhibits));
    fs.renameSync(tmp, FILE);
  }, 300);
}

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

const view = (e: Exhibit, pid?: string) => ({
  id: e.id, ownerName: e.ownerName, title: e.title, tiles: e.tiles, score: e.score, createdAt: e.createdAt,
  votes: e.voters.length, mine: !!pid && e.ownerId === pid, voted: !!pid && e.voters.includes(pid),
});

export function museumRouter(): Router {
  const r = express.Router();
  r.use(express.json({ limit: '64kb' }));

  // Explore: everybody's exhibits, best first or newest first
  r.get('/exhibits', (req: Request, res: Response) => {
    const pid = validPid(req.query.pid) ? req.query.pid : undefined;
    const sort = req.query.sort === 'new' ? 'new' : 'top';
    const limit = Math.max(1, Math.min(60, Number(req.query.limit) || 30));
    const list = [...exhibits].sort((a, b) => (sort === 'new' ? b.createdAt - a.createdAt : b.voters.length - a.voters.length || b.createdAt - a.createdAt));
    res.json(list.slice(0, limit).map((e) => view(e, pid)));
  });

  // My museum + my museum points (= votes received)
  r.get('/me', (req: Request, res: Response) => {
    if (!validPid(req.query.pid)) return res.status(400).json({ error: 'bad player id' });
    const pid = req.query.pid;
    const mine = exhibits.filter((e) => e.ownerId === pid).sort((a, b) => b.createdAt - a.createdAt);
    res.json({ exhibits: mine.map((e) => view(e, pid)), points: mine.reduce((n, e) => n + e.voters.length, 0), max: MAX_EXHIBITS_PER_PLAYER });
  });

  r.post('/exhibits', (req: Request, res: Response) => {
    const { pid } = req.body ?? {};
    if (!validPid(pid)) return res.status(400).json({ error: 'bad player id' });
    const tiles = validTiles(req.body.tiles);
    if (!tiles) return res.status(400).json({ error: 'bad board' });
    if (exhibits.filter((e) => e.ownerId === pid).length >= MAX_EXHIBITS_PER_PLAYER) return res.status(409).json({ error: 'museum full' });
    const e: Exhibit = {
      id: randomUUID(), ownerId: pid, ownerName: clean(req.body.name, 16) || 'Player', title: clean(req.body.title, 40),
      tiles, score: Number.isFinite(req.body.score) ? Math.round(req.body.score) : 0, createdAt: Date.now(), voters: [],
    };
    exhibits.push(e);
    save();
    res.json(view(e, pid));
  });

  r.delete('/exhibits/:id', (req: Request, res: Response) => {
    const i = exhibits.findIndex((e) => e.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'not found' });
    if (exhibits[i].ownerId !== req.query.pid) return res.status(403).json({ error: 'not yours' });
    exhibits.splice(i, 1);
    save();
    res.json({ ok: true });
  });

  // One vote per player per exhibit (tap again to take it back); you cannot vote for yourself
  r.post('/exhibits/:id/vote', (req: Request, res: Response) => {
    const { pid } = req.body ?? {};
    if (!validPid(pid)) return res.status(400).json({ error: 'bad player id' });
    const e = exhibits.find((x) => x.id === req.params.id);
    if (!e) return res.status(404).json({ error: 'not found' });
    if (e.ownerId === pid) return res.status(403).json({ error: 'own exhibit' });
    const k = e.voters.indexOf(pid);
    if (k >= 0) e.voters.splice(k, 1); else e.voters.push(pid);
    save();
    res.json({ votes: e.voters.length, voted: k < 0 });
  });

  return r;
}
