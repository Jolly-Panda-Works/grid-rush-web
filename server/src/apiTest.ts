// Accounts / leaderboard / friends API test (npm test). Runs against an in-memory database.
process.env.DB_FILE = ':memory:';
delete process.env.GOOGLE_CLIENT_ID;
import assert from 'node:assert/strict';
import { createServer } from 'http';
import express from 'express';

async function main() {
  const { accountsRouter, applyOnlineResult } = await import('./accounts');
  const { socialRouter } = await import('./social');
  const { setMailer } = await import('./mailer');
  const { resetRateLimits } = await import('./accounts');
  const { db, MIGRATIONS } = await import('./db');
  const sent = new Map<string, string>(); // email -> last code "sent"
  setMailer(async (email, code) => { sent.set(email, code); });
  const app = express();
  app.use('/api', accountsRouter());
  app.use('/api', socialRouter());
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

  server.close();
  console.log(`\n${n} api tests passed`);
}
main().catch((e) => { console.error(e); process.exit(1); });
