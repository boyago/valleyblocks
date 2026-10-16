import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { advanceSession, ACTIVE_TTL_MS, RETENTION_DAYS, dayKey } from '../usage-policy.mjs';

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS labs_usage_sessions (
    visitor_hash VARCHAR(64) PRIMARY KEY, session_id VARCHAR(36) NOT NULL,
    game VARCHAR(64) NOT NULL, active INTEGER NOT NULL, updated_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS labs_usage_daily (
    day_key VARCHAR(10) NOT NULL, game VARCHAR(64) NOT NULL, visitor_hash VARCHAR(64) NOT NULL,
    active_ms BIGINT NOT NULL DEFAULT 0, starts INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day_key, game, visitor_hash)
  )`,
];

export function createUsageStore(database) {
  let lastCleanup = 0;
  const cleanup = async (now) => {
    const cutoff = now - RETENTION_DAYS * 86400000;
    await database.transaction(async query => {
      await query('DELETE FROM labs_usage_sessions WHERE updated_at<?', [cutoff]);
      await query('DELETE FROM labs_usage_daily WHERE day_key<?', [dayKey(now - (RETENTION_DAYS - 1) * 86400000)]);
    });
    lastCleanup = now;
  };
  return {
    async record(visitor, input, now = Date.now()) {
      if (now - lastCleanup > 3600000) await cleanup(now);
      return database.transaction(async query => {
        // Insert the owner row before locking; its unique key serializes tabs/processes.
        const insert = database.dialect === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';
        await query(`${insert} INTO labs_usage_sessions (visitor_hash,session_id,game,active,updated_at) VALUES (?,?,?,0,?)`, [visitor, '', input.game, now]);
        const lock = database.dialect === 'mysql' ? ' FOR UPDATE' : '';
        const rows = await query(`SELECT * FROM labs_usage_sessions WHERE visitor_hash=?${lock}`, [visitor]);
        const previous = rows[0];
        const result = advanceSession(previous, input, now);
        if (!result.accepted) return { accepted: false };
        const add = async (day, game, ms, starts) => {
          await query(`${insert} INTO labs_usage_daily (day_key,game,visitor_hash,active_ms,starts) VALUES (?,?,?,0,0)`, [day, game, visitor]);
          await query('UPDATE labs_usage_daily SET active_ms=active_ms+?, starts=starts+? WHERE day_key=? AND game=? AND visitor_hash=?', [ms, starts, day, game, visitor]);
        };
        for (const part of result.segments) await add(part.day, previous.game, part.ms, 0);
        if (input.active) await add(dayKey(now), input.game, 0, result.newSession ? 1 : 0);
        await query('UPDATE labs_usage_sessions SET session_id=?,game=?,active=?,updated_at=? WHERE visitor_hash=?', [result.row.session_id, input.game, result.row.active, result.row.updated_at, visitor]);
        return { accepted: true };
      });
    },
    async report(now = Date.now()) {
      const cutoff = now - (RETENTION_DAYS - 1) * 86400000;
      if (now - lastCleanup > 3600000) await cleanup(now);
      const active = await database.query('SELECT game, COUNT(*) AS players FROM labs_usage_sessions WHERE active=1 AND updated_at>? GROUP BY game', [now - ACTIVE_TTL_MS]);
      const days = await database.query('SELECT day_key, game, COUNT(*) AS browsers, SUM(starts) AS sessions, SUM(active_ms) AS active_ms FROM labs_usage_daily WHERE day_key>=? GROUP BY day_key,game ORDER BY day_key DESC', [dayKey(cutoff)]);
      return { generatedAt: new Date(now).toISOString(), timezone: 'America/Sao_Paulo', coverage: 'consenting-browsers', retentionDays: RETENTION_DAYS, active, days };
    },
    async cleanup(now = Date.now()) { await cleanup(now); },
  };
}

export async function openDatabase(env = process.env) {
  if (env.LABS_USAGE_SQLITE_PATH) {
    if (env.NODE_ENV === 'production') throw new Error('SQLite usage preview is development-only');
    // Explicit local preview; production always uses the configured MySQL database.
    const { DatabaseSync } = await import('node:sqlite');
    const file = resolve(env.LABS_USAGE_SQLITE_PATH);
    await mkdir(dirname(file), { recursive: true });
    const db = new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    const query = async (sql, args = []) => /^SELECT/i.test(sql) ? db.prepare(sql).all(...args) : (db.prepare(sql).run(...args), []);
    let tail = Promise.resolve();
    const transaction = fn => {
      const job = tail.then(async () => {
        db.exec('BEGIN IMMEDIATE');
        try { const result = await fn(query); db.exec('COMMIT'); return result; }
        catch (error) { db.exec('ROLLBACK'); throw error; }
      });
      tail = job.catch(() => {});return job;
    };
    return { dialect: 'sqlite', query, transaction, close: () => db.close() };
  }
  if (!env.LABS_MYSQL_HOST || !env.LABS_MYSQL_DATABASE || !env.LABS_MYSQL_USER || !env.LABS_MYSQL_PASSWORD) throw new Error('MySQL usage configuration is missing');
  for (const key of ["LABS_MYSQL_PASSWORD","LABS_MYSQL_HOST","LABS_MYSQL_USER","LABS_MYSQL_DATABASE"]) {
    if (/^["'].*["']$/.test(env[key]||"") || /\s$/.test(env[key]||"")) console.warn("[labs] "+key+" parece conter aspas ou espaço no final; confira a variável no painel.");
  }
  const { createPool } = await import("mysql2/promise");
  const pool = createPool({ host: env.LABS_MYSQL_HOST, port: Number(env.LABS_MYSQL_PORT || 3306), database: env.LABS_MYSQL_DATABASE,
    user: env.LABS_MYSQL_USER, password: env.LABS_MYSQL_PASSWORD, connectionLimit: 3, connectTimeout: 5000,
    ssl: env.LABS_MYSQL_TLS === 'true' ? { rejectUnauthorized: true } : undefined });
  const query = async (sql, args = []) => { const [rows] = await pool.execute(sql, args); return Array.isArray(rows) ? rows : []; };
  return { dialect: 'mysql', query, async transaction(fn) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await fn(async (sql, args = []) => { const [rows] = await connection.execute(sql, args); return Array.isArray(rows) ? rows : []; });
      await connection.commit();return result;
    } catch (error) { await connection.rollback();throw error; } finally { connection.release(); }
  }, close: () => pool.end() };
}

const state = globalThis[Symbol.for('labs.usage.database')] ||= {};
export async function getDatabase() {
  if (!state.connection) state.connection = openDatabase().catch(error => { state.connection = null;throw error; });
  return state.connection;
}
export async function getUsageStore() {
  if (process.env.LABS_USAGE_ENABLED !== 'true') return null;
  if (!state.promise) state.promise = getDatabase().then(db => createUsageStore(db)).catch(error => { state.promise = null; throw error; });
  return state.promise;
}
