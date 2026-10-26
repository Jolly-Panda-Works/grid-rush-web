import crypto from 'crypto';
import express, { Response, Router } from 'express';
import {
  STORY, TOOL_IDS, continuePrice, levelById, replaySolo, soloScore, spaceById, starsOf, winCoins,
} from '../../shared/src';
import type { SoloAction, StepsProgress, ToolCounts, ToolId } from '../../shared/src';
import { AuthedRequest, UserRow, auth } from './accounts';
import { db, tx } from './db';

/**
 * Story mode economy (docs/story-mode.md). The server owns everything that is worth something: bricks, coins,
 * lives, tools and level progress. A level is played on the device; at the end the device sends the action list
 * and the server replays it with the same engine, so a result cannot be made up.
 */

interface ProgressRow { user_id: string; level: number; bricks: number; steps: string; unlocked: number; updated_at: number }
interface WalletRow { user_id: string; coins: number; lives: number; lives_at: number | null; tools: string }
interface AttemptRow { id: string; user_id: string; level: number; coin_bag: number; tools: string; life: number; continues_paid: number; started_at: number; finished_at: number | null }

const MAX_ACTIONS = 600;

function ensure(u: UserRow) {
  const now = Date.now();
  db.prepare('INSERT OR IGNORE INTO story_progress (user_id, unlocked, updated_at) VALUES (?, ?, ?)').run(u.id, u.xp > 0 ? 1 : 0, now);
  db.prepare('INSERT OR IGNORE INTO wallets (user_id) VALUES (?)').run(u.id);
}
const progressOf = (id: string) => db.prepare('SELECT * FROM story_progress WHERE user_id = ?').get(id) as unknown as ProgressRow;

/** The wallet with the lives refilled up to now (server time: changing the phone clock does nothing). */
function walletOf(id: string): WalletRow {
  const w = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(id) as unknown as WalletRow;
  const now = Date.now();
  let { lives, lives_at } = w;
  while (lives < STORY.LIVES_MAX && lives_at !== null && now >= lives_at) { lives++; lives_at += STORY.LIFE_MS; }
  if (lives >= STORY.LIVES_MAX) lives_at = null;
  if (lives !== w.lives || lives_at !== w.lives_at) db.prepare('UPDATE wallets SET lives = ?, lives_at = ? WHERE user_id = ?').run(lives, lives_at, id);
  return { ...w, lives, lives_at };
}

function addCoins(id: string, delta: number, reason: string) {
  if (!delta) return;
  db.prepare('UPDATE wallets SET coins = coins + ? WHERE user_id = ?').run(delta, id);
  db.prepare('INSERT INTO wallet_log (user_id, delta_coins, reason, at) VALUES (?, ?, ?, ?)').run(id, delta, reason, Date.now());
}
function setTools(id: string, tools: ToolCounts) {
  db.prepare('UPDATE wallets SET tools = ? WHERE user_id = ?').run(JSON.stringify(tools), id);
}
function loseLife(id: string) {
  const w = walletOf(id);
  const lives = Math.max(0, w.lives - 1);
  db.prepare('UPDATE wallets SET lives = ?, lives_at = ? WHERE user_id = ?').run(lives, w.lives_at ?? Date.now() + STORY.LIFE_MS, id);
}
function giveLife(id: string) {
  const w = walletOf(id);
  if (w.lives >= STORY.LIVES_MAX) return;
  const lives = w.lives + 1;
  db.prepare('UPDATE wallets SET lives = ?, lives_at = ? WHERE user_id = ?').run(lives, lives >= STORY.LIVES_MAX ? null : w.lives_at, id);
}

/** Everything the story screens need. */
export function storyView(u: UserRow) {
  ensure(u);
  const p = progressOf(u.id);
  const w = walletOf(u.id);
  const results = db.prepare('SELECT level, best_stars, best_score FROM level_results WHERE user_id = ?').all(u.id) as { level: number; best_stars: number; best_score: number }[];
  return {
    level: p.level, bricks: p.bricks, steps: JSON.parse(p.steps) as StepsProgress, unlocked: !!p.unlocked,
    coins: w.coins, lives: w.lives, livesIn: w.lives_at === null ? 0 : Math.max(0, w.lives_at - Date.now()), tools: JSON.parse(w.tools) as ToolCounts,
    results: Object.fromEntries(results.map((r) => [r.level, { stars: r.best_stars, score: r.best_score }])),
  };
}

const livesUsed = (level: number) => level > STORY.TUTORIAL_LEVELS;

export function storyRouter(): Router {
  const r = express.Router();
  r.use(express.json({ limit: '64kb' }));

  r.get('/story', auth, (req: AuthedRequest, res: Response) => res.json(storyView(req.user!)));

  // Starting a level: checks it is open, takes a life (given back on a win) and pays for the coin bag.
  r.post('/story/level/start', auth, (req: AuthedRequest, res: Response) => {
    const u = req.user!;
    ensure(u);
    const id = Number(req.body?.level);
    const level = levelById(id);
    if (!level) return res.status(400).json({ error: 'no_level' });
    const p = progressOf(u.id);
    if (id > p.level) return res.status(403).json({ error: 'locked' });
    const coinBag = !!req.body?.coinBag && id > STORY.TUTORIAL_LEVELS;
    const out = tx(() => {
      const w = walletOf(u.id);
      const life = livesUsed(id);
      if (life && w.lives <= 0) return { error: 'no_lives' as const };
      if (coinBag && w.coins < STORY.COIN_BAG_PRICE) return { error: 'coins' as const };
      if (coinBag) addCoins(u.id, -STORY.COIN_BAG_PRICE, 'coinbag:' + id);
      if (life) loseLife(u.id);
      const attemptId = crypto.randomBytes(12).toString('base64url');
      db.prepare('INSERT INTO level_attempts (id, user_id, level, coin_bag, tools, life, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(attemptId, u.id, id, coinBag ? 1 : 0, w.tools, life ? 1 : 0, Date.now());
      return { attemptId, tools: JSON.parse(w.tools) as ToolCounts, coinBag };
    });
    if ('error' in out) return res.status(409).json(out);
    res.json({ ...out, story: storyView(u) });
  });

  // A classic continue (more track, a few coins) is paid here, before the device plays on.
  r.post('/story/continue', auth, (req: AuthedRequest, res: Response) => {
    const u = req.user!;
    const a = db.prepare('SELECT * FROM level_attempts WHERE id = ? AND user_id = ?').get(String(req.body?.attemptId), u.id) as AttemptRow | undefined;
    if (!a || a.finished_at) return res.status(404).json({ error: 'no_attempt' });
    if (a.continues_paid >= STORY.CONTINUE_MULT.length) return res.status(409).json({ error: 'max' });
    const price = continuePrice(a.level, a.continues_paid);
    const out = tx(() => {
      if (walletOf(u.id).coins < price) return false;
      addCoins(u.id, -price, 'continue:' + a.level);
      db.prepare('UPDATE level_attempts SET continues_paid = continues_paid + 1 WHERE id = ?').run(a.id);
      return true;
    });
    if (!out) return res.status(409).json({ error: 'coins' });
    res.json({ price, story: storyView(u) });
  });

  // The end of a level: the action list is replayed; a win pays one brick (first win only) and coins.
  // Tutorial levels (no lives, tools or coin bag) may come without an attempt, from the offline queue.
  r.post('/story/level/finish', auth, (req: AuthedRequest, res: Response) => {
    const u = req.user!;
    ensure(u);
    const actions = req.body?.actions as SoloAction[];
    if (!Array.isArray(actions) || actions.length > MAX_ACTIONS) return res.status(400).json({ error: 'bad_actions' });
    let attempt: AttemptRow | undefined;
    let id: number;
    if (req.body?.attemptId) {
      attempt = db.prepare('SELECT * FROM level_attempts WHERE id = ? AND user_id = ?').get(String(req.body.attemptId), u.id) as AttemptRow | undefined;
      if (!attempt || attempt.finished_at) return res.status(404).json({ error: 'no_attempt' });
      id = attempt.level;
    } else {
      id = Number(req.body?.level);
      if (!(id >= 1 && id <= STORY.TUTORIAL_LEVELS)) return res.status(400).json({ error: 'no_attempt' });
    }
    const level = levelById(id);
    if (!level) return res.status(400).json({ error: 'no_level' });
    const p = progressOf(u.id);
    if (id > p.level) return res.status(403).json({ error: 'locked' });

    const own: ToolCounts = attempt ? JSON.parse(attempt.tools) : {};
    const { state, error } = replaySolo(level, { tools: own, coinBag: !!attempt?.coin_bag }, actions);
    if (error) return res.status(400).json({ error: 'replay', detail: error });
    const solo = state.solo!;
    const continues = actions.filter((a) => a?.t === 'continue').length;
    if (continues > (attempt ? attempt.continues_paid : id <= STORY.TUTORIAL_LEVELS ? 3 : 0)) return res.status(400).json({ error: 'unpaid_continue' });

    const won = solo.outcome === 'won';
    const stars = starsOf(state);
    const score = soloScore(state).total;
    const firstWin = won && id === p.level;
    const prev = db.prepare('SELECT best_stars FROM level_results WHERE user_id = ? AND level = ?').get(u.id, id) as { best_stars: number } | undefined;
    const better = won && stars > (prev?.best_stars ?? 0);
    let coins = 0, bricks = 0, unlockedNow = false;

    tx(() => {
      if (attempt) db.prepare('UPDATE level_attempts SET finished_at = ? WHERE id = ?').run(Date.now(), attempt.id);
      // tools used from the player's own stock (the level's free samples come first)
      const w = walletOf(u.id);
      const stock: ToolCounts = JSON.parse(w.tools);
      for (const t of TOOL_IDS as ToolId[]) {
        const fromStock = Math.max(0, (solo.used[t] ?? 0) - (level.freeTools?.[t] ?? 0));
        if (fromStock) stock[t] = Math.max(0, (stock[t] ?? 0) - fromStock);
      }
      setTools(u.id, stock);
      if (attempt?.life && (won || actions.length === 0)) giveLife(u.id); // a win, or leaving before the first move, costs no life
      if (actions.length === 0) return;
      db.prepare(`INSERT INTO level_results (user_id, level, best_stars, best_score, attempts) VALUES (?, ?, ?, ?, 1)
        ON CONFLICT(user_id, level) DO UPDATE SET best_stars = MAX(best_stars, excluded.best_stars), best_score = MAX(best_score, excluded.best_score), attempts = attempts + 1`)
        .run(u.id, id, stars, won ? score : 0);
      if (!won) return;
      coins = firstWin || better ? winCoins(level, state, firstWin) : 0;
      addCoins(u.id, coins, 'level:' + id);
      if (firstWin) {
        bricks = 1;
        db.prepare('UPDATE story_progress SET level = level + 1, bricks = bricks + 1, updated_at = ? WHERE user_id = ?').run(Date.now(), u.id);
        if (id === STORY.TUTORIAL_LEVELS && !p.unlocked) {
          unlockedNow = true;
          db.prepare('UPDATE story_progress SET unlocked = 1 WHERE user_id = ?').run(u.id);
          addCoins(u.id, STORY.UNLOCK_GIFT.coins, 'unlock_gift');
          const s2: ToolCounts = JSON.parse(walletOf(u.id).tools);
          for (const [t, n] of Object.entries(STORY.UNLOCK_GIFT.tools)) s2[t as ToolId] = (s2[t as ToolId] ?? 0) + (n ?? 0);
          setTools(u.id, s2);
        }
      }
    });
    res.json({ won, stars, score, coins, bricks, unlockedNow, story: storyView(u) });
  });

  // A restoration step (paid with bricks), or a new design for a step that is already done (free).
  r.post('/story/step', auth, (req: AuthedRequest, res: Response) => {
    const u = req.user!;
    ensure(u);
    const space = spaceById(String(req.body?.space));
    const stepNo = Number(req.body?.step); // 1-based
    if (!space || !(stepNo >= 1 && stepNo <= space.steps.length)) return res.status(400).json({ error: 'no_step' });
    const step = space.steps[stepNo - 1];
    const choice = req.body?.choice === undefined ? undefined : Number(req.body.choice);
    if (step.choices ? !(Number.isInteger(choice) && choice! >= 0 && choice! < step.choices) : choice !== undefined) return res.status(400).json({ error: 'choice' });
    const out = tx(() => {
      const p = progressOf(u.id);
      const steps = JSON.parse(p.steps) as StepsProgress;
      const sp = steps[space.id] ?? { done: 0, choices: {} };
      if (stepNo <= sp.done) {
        if (choice === undefined) return 'done';
      } else {
        if (stepNo !== sp.done + 1) return 'order';
        if (p.bricks < step.cost) return 'bricks';
        sp.done = stepNo;
        db.prepare('UPDATE story_progress SET bricks = bricks - ? WHERE user_id = ?').run(step.cost, u.id);
      }
      if (choice !== undefined) sp.choices[step.id] = choice;
      steps[space.id] = sp;
      db.prepare('UPDATE story_progress SET steps = ?, updated_at = ? WHERE user_id = ?').run(JSON.stringify(steps), Date.now(), u.id);
      return null;
    });
    if (out) return res.status(409).json({ error: out });
    res.json(storyView(u));
  });

  // The tool shop (coins only) and refilling the lives.
  r.post('/story/shop', auth, (req: AuthedRequest, res: Response) => {
    const u = req.user!;
    ensure(u);
    const item = String(req.body?.item);
    const price = item === 'lives' ? STORY.REFILL_LIVES_PRICE : (STORY.TOOL_PRICE as Record<string, number>)[item];
    if (!price) return res.status(400).json({ error: 'no_item' });
    const ok = tx(() => {
      const w = walletOf(u.id);
      if (w.coins < price) return false;
      if (item === 'lives' && w.lives >= STORY.LIVES_MAX) return false;
      addCoins(u.id, -price, 'shop:' + item);
      if (item === 'lives') db.prepare('UPDATE wallets SET lives = ?, lives_at = NULL WHERE user_id = ?').run(STORY.LIVES_MAX, u.id);
      else { const t: ToolCounts = JSON.parse(w.tools); t[item as ToolId] = (t[item as ToolId] ?? 0) + 1; setTools(u.id, t); }
      return true;
    });
    if (!ok) return res.status(409).json({ error: 'coins' });
    res.json(storyView(u));
  });

  return r;
}

