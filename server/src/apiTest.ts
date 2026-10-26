// Accounts / leaderboard / friends API test (npm test). Runs against an in-memory database.
process.env.DB_FILE = ':memory:';
delete process.env.GOOGLE_CLIENT_ID;
import assert from 'node:assert/strict';
import { createServer } from 'http';
import express from 'express';

async function main() {
  const { accountsRouter, applyOnlineResult } = await import('./accounts');
  const { socialRouter } = await import('./social');
  const { storyRouter } = await import('./story');
  const { LEVELS, STORY, applySoloAction, createSoloGame, solveLevel } = await import('../../shared/src');
  const { setMailer } = await import('./mailer');
  const { resetRateLimits } = await import('./accounts');
  const { db, MIGRATIONS } = await import('./db');
  const sent = new Map<string, string>(); // email -> last code "sent"
  setMailer(async (email, code) => { sent.set(email, code); });
  const app = express();
  app.use('/api', accountsRouter());
  app.use('/api', socialRouter());
  app.use('/api', storyRouter());
  const server = createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const call = async (method: string, path: string, body?: unknown, token?: string) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: (await res.json()) as any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  let n = 0;
  const test = async (name: string, fn: () => Promise<void>) => { await fn(); n++; console.log('  ok  ' + name); };
  console.log('api');

  let a = '', b = '', aId = '', bId = '', bCode = '';
  await test('a guest account is created with the device progress, rating stays server-side', async () => {
    const r = await call('POST', '/auth/guest', { name: 'Ana', avatar: 3, xp: 120, wins: 2, losses: 1, stats: { games: 3 }, ach: { first_win: 1 }, rating: 4000 });
    assert.equal(r.status, 200);
    a = r.body.token; aId = r.body.user.id;
    assert.equal(r.body.user.name, 'Ana'); assert.equal(r.body.user.xp, 120); assert.equal(r.body.user.rating, 1000, 'a device cannot set its rating');
    assert.match(r.body.user.friendCode, /^[A-Z2-9]{6}$/);
    const r2 = await call('POST', '/auth/guest', { name: 'Bo' });
    b = r2.body.token; bId = r2.body.user.id; bCode = r2.body.user.friendCode;
  });
  await test('requests without a valid token are refused', async () => {
    assert.equal((await call('GET', '/me')).status, 401);
    assert.equal((await call('GET', '/me', undefined, 'x'.repeat(43))).status, 401);
  });
  await test('progress sync never goes backwards', async () => {
    let r = await call('PUT', '/me', { xp: 300, wins: 5, stats: { games: 8 } }, a);
    assert.equal(r.body.xp, 300); assert.equal(r.body.wins, 5);
    r = await call('PUT', '/me', { xp: 100, wins: 1, name: 'Ana B' }, a); // an older device
    assert.equal(r.body.xp, 300); assert.equal(r.body.wins, 5); assert.equal(r.body.stats.games, 8); assert.equal(r.body.name, 'Ana B');
  });
  await test('online results change the server rating', async () => {
    const r = applyOnlineResult(aId, 1000, true)!;
    assert.ok(r.delta > 0); assert.equal((await call('GET', '/me', undefined, a)).body.rating, r.rating);
  });
  await test('leaderboard by rating and by level, with my rank', async () => {
    let r = await call('GET', '/leaderboard?by=rating', undefined, b);
    assert.equal(r.body.rows[0].id, aId, 'the rated player is first'); assert.equal(r.body.me.id, bId); assert.equal(r.body.me.rank, 2);
    r = await call('GET', '/leaderboard?by=level', undefined, a);
    assert.equal(r.body.rows[0].name, 'Ana B'); assert.equal(r.body.me.rank, 1);
  });
  await test('friends: add by code, accept, friends-only leaderboard, remove', async () => {
    assert.equal((await call('POST', '/friends/add', { code: 'NOPE00' }, a)).status, 404);
    assert.equal((await call('POST', '/friends/add', { code: bCode }, b)).status, 400, 'not your own code');
    let r = await call('POST', '/friends/add', { code: bCode.toLowerCase() }, a);
    assert.equal(r.body.accepted, false);
    r = await call('GET', '/friends', undefined, b);
    assert.equal(r.body.incoming.length, 1); assert.equal(r.body.incoming[0].id, aId);
    assert.equal((await call('POST', '/friends/accept', { id: aId }, b)).status, 200);
    r = await call('GET', '/friends', undefined, a);
    assert.equal(r.body.friends.length, 1); assert.equal(r.body.friends[0].id, bId); assert.equal(r.body.friends[0].online, true);
    r = await call('GET', '/leaderboard?by=rating&scope=friends', undefined, b);
    assert.equal(r.body.rows.length, 2);
    r = await call('GET', `/users/${aId}`, undefined, b);
    assert.equal(r.body.friend, true); assert.equal(r.body.stats.games, 8); assert.equal(r.body.token, undefined);
    await call('POST', '/friends/remove', { id: aId }, b);
    assert.equal((await call('GET', '/friends', undefined, a)).body.friends.length, 0);
  });
  await test('Google link answers "not configured" when the server has no Google credentials', async () => {
    assert.equal((await call('POST', '/auth/google', { code: 'abc' }, a)).status, 501);
  });

  // ---- email sign-in (docs/accounts.md) ----
  const guest = async () => (await call('POST', '/auth/guest', { name: 'G' })).body as { token: string; user: { id: string } };
  await test('email: start then verify with the right code links the email to the guest', async () => {
    const g = await guest();
    let r = await call('POST', '/auth/email/start', { email: ' Alireza@Example.com ' }, g.token);
    assert.equal(r.status, 200); assert.equal(r.body.resendIn, 60);
    r = await call('POST', '/auth/email/verify', { email: 'alireza@example.com', code: sent.get('alireza@example.com') }, g.token);
    assert.equal(r.body.switched, false); assert.equal(r.body.user.logins.email, 'ali•••@example.com'); assert.equal(r.body.user.linked, true);
    assert.equal(JSON.stringify(r.body).includes('alireza@example.com'), false, 'the full email is never sent back');
  });
  await test('email: 5 wrong codes, then even the right one is refused', async () => {
    const g = await guest();
    await call('POST', '/auth/email/start', { email: 'five@x.io' }, g.token);
    const right = sent.get('five@x.io')!, wrong = right === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/auth/email/verify', { email: 'five@x.io', code: wrong }, g.token)).status, 401);
    assert.equal((await call('POST', '/auth/email/verify', { email: 'five@x.io', code: right }, g.token)).status, 401);
  });
  await test('email: an expired code is refused', async () => {
    const g = await guest();
    await call('POST', '/auth/email/start', { email: 'old@x.io' }, g.token);
    db.prepare('UPDATE login_codes SET expires_at = ? WHERE email = ?').run(Date.now() - 1, 'old@x.io');
    assert.equal((await call('POST', '/auth/email/verify', { email: 'old@x.io', code: sent.get('old@x.io') }, g.token)).status, 401);
  });
  await test('email: a code works only once', async () => {
    const g = await guest(), h = await guest();
    await call('POST', '/auth/email/start', { email: 'once@x.io' }, g.token);
    const code = sent.get('once@x.io');
    assert.equal((await call('POST', '/auth/email/verify', { email: 'once@x.io', code }, g.token)).status, 200);
    assert.equal((await call('POST', '/auth/email/verify', { email: 'once@x.io', code }, h.token)).status, 401);
  });
  await test('email: a second account with the same email switches to the first, with its name/level/rating', async () => {
    const first = await guest();
    await call('PUT', '/me', { name: 'Owner', xp: 900 }, first.token);
    await call('POST', '/auth/email/start', { email: 'same@x.io' }, first.token);
    await call('POST', '/auth/email/verify', { email: 'same@x.io', code: sent.get('same@x.io') }, first.token);
    const second = await guest();
    db.prepare('DELETE FROM login_codes').run();
    resetRateLimits();
    await call('POST', '/auth/email/start', { email: 'same@x.io' }, second.token);
    const r = await call('POST', '/auth/email/verify', { email: 'same@x.io', code: sent.get('same@x.io') }, second.token);
    assert.equal(r.body.switched, true); assert.equal(r.body.user.id, first.user.id);
    assert.equal(r.body.other.name, 'Owner'); assert.ok(r.body.other.level > 1); assert.equal(typeof r.body.other.rating, 'number');
    assert.equal((await call('GET', '/me', undefined, r.body.token)).body.id, first.user.id, 'the new token signs in to the first profile');
  });
  await test('email: start answers the same for a known and an unknown email', async () => {
    const g = await guest();
    const known = await call('POST', '/auth/email/start', { email: 'alireza@example.com' }, g.token);
    const unknown = await call('POST', '/auth/email/start', { email: 'nobody@example.com' }, g.token);
    assert.equal(known.status, unknown.status); assert.deepEqual(known.body, unknown.body);
  });
  await test('email: one code per email per minute', async () => {
    const g = await guest();
    assert.equal((await call('POST', '/auth/email/start', { email: 'rate@x.io' }, g.token)).status, 200);
    assert.equal((await call('POST', '/auth/email/start', { email: 'rate@x.io' }, g.token)).status, 429);
  });
  await test('email: unlink, then link it to another account', async () => {
    const g = await guest(), h = await guest();
    resetRateLimits();
    await call('POST', '/auth/email/start', { email: 'move@x.io' }, g.token);
    await call('POST', '/auth/email/verify', { email: 'move@x.io', code: sent.get('move@x.io') }, g.token);
    const r = await call('DELETE', '/auth/email', undefined, g.token);
    assert.equal(r.body.user.logins.email, undefined); assert.equal(r.body.user.linked, false);
    resetRateLimits();
    await call('POST', '/auth/email/start', { email: 'move@x.io' }, h.token);
    const v = await call('POST', '/auth/email/verify', { email: 'move@x.io', code: sent.get('move@x.io') }, h.token);
    assert.equal(v.body.switched, false); assert.equal(v.body.user.id, h.user.id);
  });
  await test('logout ends only this session', async () => {
    const g = await guest();
    assert.equal((await call('POST', '/auth/logout', undefined, g.token)).status, 200);
    assert.equal((await call('GET', '/me', undefined, g.token)).status, 401);
  });
  await test('deleting the account removes its sign-in methods, sessions and museum boards', async () => {
    const g = await guest();
    resetRateLimits();
    await call('POST', '/auth/email/start', { email: 'bye@x.io' }, g.token);
    await call('POST', '/auth/email/verify', { email: 'bye@x.io', code: sent.get('bye@x.io') }, g.token);
    db.prepare("INSERT INTO exhibits (id, owner_id, owner_name, tiles, created_at) VALUES ('ex1', 'device-pid-1', 'G', '[]', 0)").run();
    assert.equal((await call('DELETE', '/me', { confirm: 'nope' }, g.token)).status, 400);
    assert.equal((await call('DELETE', '/me', { confirm: 'DELETE', pid: 'device-pid-1' }, g.token)).status, 200);
    assert.equal((await call('GET', '/me', undefined, g.token)).status, 401);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM identities WHERE user_id = ?').get(g.user.id)!.n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(g.user.id)!.n, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM exhibits WHERE id = 'ex1'").get()!.n, 0);
  });
  await test('migration 4: a user with google_id gets an identities row', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const d = new DatabaseSync(':memory:');
    d.exec(MIGRATIONS[0]);
    d.prepare("INSERT INTO users (id, name, friend_code, google_id, created_at, updated_at, last_seen) VALUES ('u1', 'G', 'ABCDEF', 'g-123', 1, 1, 1)").run();
    for (const m of MIGRATIONS.slice(1)) d.exec(m);
    const row = d.prepare("SELECT user_id FROM identities WHERE provider = 'google' AND subject = 'g-123'").get() as { user_id: string };
    assert.equal(row.user_id, 'u1');
  });
  await test('a session unused for 180 days has expired', async () => {
    const g = await guest();
    db.prepare('UPDATE sessions SET last_used = ?, created_at = ? WHERE user_id = ?').run(Date.now() - 181 * 86400_000, Date.now() - 181 * 86400_000, g.user.id);
    assert.equal((await call('GET', '/me', undefined, g.token)).status, 401);
  });

  console.log('story');
  const winActions = (id: number) => { const r = solveLevel(LEVELS[id - 1]); assert.ok(r.won, `the solver wins level ${id}`); return r.actions; };
  const loseActions = (id: number) => {
    const g = createSoloGame(LEVELS[id - 1]);
    const out: ({ t: 'advance' } | { t: 'reward'; r: number; c: number })[] = [];
    while (!g.solo!.outcome) {
      const i = g.players[0].board.indexOf(0);
      const a = g.phase === 'placing_reward' ? { t: 'reward' as const, r: Math.floor(i / 9), c: i % 9 } : { t: 'advance' as const };
      assert.equal(applySoloAction(g, a), null); out.push(a);
    }
    assert.equal(g.solo!.outcome, 'lost');
    return out;
  };
  const setLevel = (userId: string, level: number) => db.prepare('UPDATE story_progress SET level = ? WHERE user_id = ?').run(level, userId);
  let st = { token: '', user: { id: '' } };
  await test('a new player starts at level 1 with everything locked; one who already played is unlocked', async () => {
    st = await guest();
    const r = await call('GET', '/story', undefined, st.token);
    assert.equal(r.body.level, 1); assert.equal(r.body.unlocked, false); assert.equal(r.body.lives, STORY.LIVES_MAX); assert.equal(r.body.coins, 0);
    const old = await call('POST', '/auth/guest', { name: 'Old', xp: 500 });
    assert.equal((await call('GET', '/story', undefined, old.body.token)).body.unlocked, true);
  });
  await test('a tutorial level is replayed by the server: a win gives one brick and coins, a replay no brick', async () => {
    const actions = winActions(1);
    const r = await call('POST', '/story/level/finish', { level: 1, actions }, st.token);
    assert.equal(r.status, 200); assert.equal(r.body.won, true); assert.equal(r.body.bricks, 1); assert.ok(r.body.coins >= STORY.WIN_COINS[0]);
    assert.equal(r.body.story.level, 2); assert.equal(r.body.story.bricks, 1);
    const again = await call('POST', '/story/level/finish', { level: 1, actions }, st.token);
    assert.equal(again.body.bricks, 0); assert.equal(again.body.coins, 0, 'no coins without more stars'); assert.equal(again.body.story.bricks, 1);
  });
  await test('made-up results and locked levels are refused', async () => {
    assert.equal((await call('POST', '/story/level/finish', { level: 2, actions: [{ t: 'finish' }] }, st.token)).status, 400);
    assert.equal((await call('POST', '/story/level/finish', { level: 5, actions: winActions(5) }, st.token)).status, 403);
    assert.equal((await call('POST', '/story/level/start', { level: 9 }, st.token)).status, 403);
    setLevel(st.user.id, 11);
    assert.equal((await call('POST', '/story/level/finish', { level: 11, actions: [] }, st.token)).status, 400, 'after the tutorial a level needs an attempt');
  });
  await test('after the tutorial: a loss costs a life (refilled on server time), a win gives it back', async () => {
    let r = await call('POST', '/story/level/start', { level: 11 }, st.token);
    assert.equal(r.status, 200); assert.equal(r.body.story.lives, STORY.LIVES_MAX - 1);
    r = await call('POST', '/story/level/finish', { attemptId: r.body.attemptId, actions: loseActions(11) }, st.token);
    assert.equal(r.body.won, false); assert.equal(r.body.story.lives, STORY.LIVES_MAX - 1); assert.ok(r.body.story.livesIn > 0);
    const start = await call('POST', '/story/level/start', { level: 11 }, st.token);
    r = await call('POST', '/story/level/finish', { attemptId: start.body.attemptId, actions: winActions(11) }, st.token);
    assert.equal(r.body.won, true); assert.equal(r.body.story.lives, STORY.LIVES_MAX - 1); assert.equal(r.body.story.level, 12);
    assert.equal((await call('POST', '/story/level/finish', { attemptId: start.body.attemptId, actions: [] }, st.token)).status, 404, 'an attempt ends once');
    db.prepare('UPDATE wallets SET lives = 0, lives_at = ? WHERE user_id = ?').run(Date.now() - 1, st.user.id);
    assert.equal((await call('GET', '/story', undefined, st.token)).body.lives, 1, 'the clock refilled a life');
    db.prepare('UPDATE wallets SET lives = 0, lives_at = ? WHERE user_id = ?').run(Date.now() + 60_000, st.user.id);
    assert.equal((await call('POST', '/story/level/start', { level: 12 }, st.token)).body.error, 'no_lives');
    db.prepare('UPDATE wallets SET lives = 5, lives_at = NULL WHERE user_id = ?').run(st.user.id);
  });
  await test('tools: only the ones owned (plus the free sample) can be used, and they are used up', async () => {
    db.prepare('UPDATE wallets SET coins = 1000, tools = ? WHERE user_id = ?').run('{}', st.user.id);
    let r = await call('POST', '/story/shop', { item: 'wheel' }, st.token);
    assert.equal(r.body.tools.wheel, 1); assert.equal(r.body.coins, 1000 - STORY.TOOL_PRICE.wheel);
    const start = await call('POST', '/story/level/start', { level: 12 }, st.token);
    const three = [{ t: 'wheel' }, { t: 'wheel' }, { t: 'wheel' }];
    assert.equal((await call('POST', '/story/level/finish', { attemptId: start.body.attemptId, actions: three }, st.token)).body.error, 'replay');
    const s2 = await call('POST', '/story/level/start', { level: 12 }, st.token);
    r = await call('POST', '/story/level/finish', { attemptId: s2.body.attemptId, actions: [{ t: 'wheel' }, { t: 'wheel' }] }, st.token);
    assert.equal(r.status, 200); assert.equal(r.body.story.tools.wheel, 0, 'one free sample + the bought one');
  });
  await test('a continue must be paid before it is played', async () => {
    db.prepare('UPDATE wallets SET coins = 2000 WHERE user_id = ?').run(st.user.id);
    const start = await call('POST', '/story/level/start', { level: 12 }, st.token);
    const lose = loseActions(12);
    assert.equal((await call('POST', '/story/level/finish', { attemptId: start.body.attemptId, actions: [...lose, { t: 'continue' }] }, st.token)).body.error, 'unpaid_continue');
    const s2 = await call('POST', '/story/level/start', { level: 12 }, st.token);
    const c = await call('POST', '/story/continue', { attemptId: s2.body.attemptId }, st.token);
    assert.equal(c.body.price, STORY.CONTINUE_PRICE); assert.equal(c.body.story.coins, 2000 - STORY.CONTINUE_PRICE);
    const r = await call('POST', '/story/level/finish', { attemptId: s2.body.attemptId, actions: [...lose, { t: 'continue' }] }, st.token);
    assert.equal(r.status, 200);
  });
  await test('restoration steps cost bricks, in order; designs can be changed for free', async () => {
    db.prepare('UPDATE story_progress SET bricks = 3, steps = ? WHERE user_id = ?').run('{}', st.user.id);
    assert.equal((await call('POST', '/story/step', { space: 'museum', step: 2, choice: 0 }, st.token)).body.error, 'order');
    let r = await call('POST', '/story/step', { space: 'museum', step: 1 }, st.token);
    assert.equal(r.body.bricks, 2); assert.equal(r.body.steps.museum.done, 1);
    assert.equal((await call('POST', '/story/step', { space: 'museum', step: 2 }, st.token)).body.error, 'choice');
    r = await call('POST', '/story/step', { space: 'museum', step: 2, choice: 1 }, st.token);
    assert.equal(r.body.bricks, 0); assert.equal(r.body.steps.museum.choices.door, 1);
    r = await call('POST', '/story/step', { space: 'museum', step: 2, choice: 2 }, st.token);
    assert.equal(r.body.bricks, 0); assert.equal(r.body.steps.museum.choices.door, 2);
    assert.equal((await call('POST', '/story/step', { space: 'museum', step: 3, choice: 0 }, st.token)).body.error, 'bricks');
  });
  await test('winning level 10 opens PvP and the museum, with the gift', async () => {
    const g = await guest();
    await call('GET', '/story', undefined, g.token);
    setLevel(g.user.id, 10);
    const r = await call('POST', '/story/level/finish', { level: 10, actions: winActions(10) }, g.token);
    assert.equal(r.body.won, true); assert.equal(r.body.unlockedNow, true); assert.equal(r.body.story.unlocked, true);
    assert.ok(r.body.story.coins >= STORY.UNLOCK_GIFT.coins); assert.equal(r.body.story.tools.chisel, 2);
  });
  await test('migration 5: players who already played are unlocked', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const d = new DatabaseSync(':memory:');
    for (const m of MIGRATIONS.slice(0, 4)) d.exec(m);
    d.prepare("INSERT INTO users (id, name, friend_code, xp, created_at, updated_at, last_seen) VALUES ('u1', 'A', 'ABCDEF', 90, 1, 1, 1), ('u2', 'B', 'ABCDEG', 0, 1, 1, 1)").run();
    d.exec(MIGRATIONS[4]);
    assert.deepEqual(d.prepare('SELECT user_id, unlocked FROM story_progress').all().map((r) => ({ ...r })), [{ user_id: 'u1', unlocked: 1 }]);
  });

  server.close();
  console.log(`\n${n} api tests passed`);
}
main().catch((e) => { console.error(e); process.exit(1); });
