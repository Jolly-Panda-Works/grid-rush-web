import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

/**
 * The game server's database: one SQLite file (Node's built-in SQLite, so no native add-on to install).
 * DB_FILE overrides the location; ':memory:' is used by the tests. Migrations run in order, once each.
 */
const FILE = process.env.DB_FILE || path.resolve(__dirname, '../data/gridrush.db');
if (FILE !== ':memory:') fs.mkdirSync(path.dirname(FILE), { recursive: true });

export const db = new DatabaseSync(FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

const MIGRATIONS: string[] = [
  // 1: accounts
  `CREATE TABLE users (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     avatar INTEGER NOT NULL DEFAULT 0,
     xp INTEGER NOT NULL DEFAULT 0,
     rating INTEGER NOT NULL DEFAULT 1000,
     rated_games INTEGER NOT NULL DEFAULT 0,
     wins INTEGER NOT NULL DEFAULT 0,
     losses INTEGER NOT NULL DEFAULT 0,
     stats TEXT NOT NULL DEFAULT '{}',
     ach TEXT NOT NULL DEFAULT '{}',
     friend_code TEXT NOT NULL UNIQUE,
     google_id TEXT UNIQUE,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     last_seen INTEGER NOT NULL
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL
   );
   CREATE INDEX users_rating ON users(rating DESC);
   CREATE INDEX users_xp ON users(xp DESC);`,
  // 2: friends (one row per request; accepted = friends both ways)
  `CREATE TABLE friends (
     from_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     to_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
     created_at INTEGER NOT NULL,
     PRIMARY KEY (from_id, to_id)
   );
   CREATE INDEX friends_to ON friends(to_id);`,
  // 3: museum (moved out of the JSON file)
  `CREATE TABLE exhibits (
     id TEXT PRIMARY KEY,
     owner_id TEXT NOT NULL,
     owner_name TEXT NOT NULL,
     title TEXT NOT NULL DEFAULT '',
     tiles TEXT NOT NULL,
     score INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL
   );
   CREATE TABLE votes (
     exhibit_id TEXT NOT NULL REFERENCES exhibits(id) ON DELETE CASCADE,
     voter_id TEXT NOT NULL,
     PRIMARY KEY (exhibit_id, voter_id)
   );
   CREATE INDEX exhibits_owner ON exhibits(owner_id);`,
];

db.exec('CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
const row = db.prepare('SELECT v FROM schema_version').get() as { v: number } | undefined;
let version = row?.v ?? 0;
if (!row) db.prepare('INSERT INTO schema_version (v) VALUES (0)').run();
for (; version < MIGRATIONS.length; version++) {
  db.exec('BEGIN');
  try {
    db.exec(MIGRATIONS[version]);
    db.prepare('UPDATE schema_version SET v = ?').run(version + 1);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

/** Run `fn` in a transaction. */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}
