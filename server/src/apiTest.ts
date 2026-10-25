// Accounts / leaderboard / friends API test (npm test). Runs against an in-memory database.
process.env.DB_FILE = ':memory:';
delete process.env.GOOGLE_CLIENT_ID;
import assert from 'node:assert/strict';
import { createServer } from 'http';
import express from 'express';

async function main() {
  const { accountsRouter, applyOnlineResult } = await import('./accounts');
  const { socialRouter } = await import('./social');
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

  server.close();
  console.log(`\n${n} api tests passed`);
}
main().catch((e) => { console.error(e); process.exit(1); });
