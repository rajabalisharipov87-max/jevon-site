import pg from 'pg';
import { applyMigrations } from '../migration/runner.mjs';
import { randomBytes } from 'node:crypto';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in .env.local');
const key = Symbol.for('jevon.postgres.pool');
export const pool = globalThis[key] ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
pool.on('error', error => console.error('PostgreSQL pool:', error.message));
// Preserve the D1 interface used by the existing routes while using PostgreSQL.
export function sqlForPostgres(sql) {
  sql = sql.replace(/datetime\('now'\)/gi, "to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')")
    .replace(/json_extract\((\w+\.\w+),\s*'\$\.(\w+)'\)\s+IS NOT\s+'([^']*)'/gi, "($1::jsonb ->> '$2') IS DISTINCT FROM '$3'")
    .replace(/\bAS\s+([a-zA-Z_]\w*)/gi, (_, alias) => ['INTEGER','TEXT','REAL','NUMERIC'].includes(alias.toUpperCase()) ? `AS ${alias}` : `AS "${alias}"`);
  let n = 0;
  return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|`([^`]+)`|\?/g, (token, identifier) =>
    token === '?' ? `$${++n}` : identifier ? `"${identifier}"` : token);
}
export async function transaction(fn) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const value = await fn(client); await client.query('COMMIT'); return value; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function initializeDatabase() {
  await transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(80800801)');
    await applyMigrations(client);
    await client.query('INSERT INTO app_settings(key,value) VALUES ($1,$2) ON CONFLICT DO NOTHING', ['session_secret', randomBytes(32).toString('hex')]);
  });
}
class Statement {
  constructor(sql, values = []) { this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.sql, values); }
  query(client = pool, rowMode) { return client.query({ text: sqlForPostgres(this.sql), values: this.values, rowMode }); }
  async first(column) { const row = (await this.query()).rows[0]; return row ? (column === undefined ? row : row[column]) : null; }
  async all() { const r = await this.query(); return { success: true, results: r.rows, meta: { changes: r.rowCount } }; }
  async raw(options) { const r = await this.query(pool, 'array'); return options?.columnNames ? [r.fields.map(f => f.name), ...r.rows] : r.rows; }
  async run() { return this.all(); }
}
export const DB = {
  prepare: sql => new Statement(sql),
  async exec(sql) { await pool.query(sqlForPostgres(sql)); return { count: 1, duration: 0 }; },
  async batch(statements) { return transaction(async client => {
    const results = [];
    for (const s of statements) { const r = await s.query(client); results.push({ success: true, results: r.rows, meta: { changes: r.rowCount } }); }
    return results;
  }); },
};
export const BUCKET = {
  async get(key) {
    const { rows } = await pool.query('SELECT data,content_type FROM stored_files WHERE key=$1', [key]);
    if (!rows.length && !key.startsWith('legacy-hash/')) {
      const { createHash } = await import('node:crypto');
      return this.get('legacy-hash/' + createHash('sha256').update(key).digest('hex'));
    }
    if (!rows.length) return null;
    const bytes = rows[0].data;
    return { key, size: bytes.length, body: new Uint8Array(bytes), httpMetadata: { contentType: rows[0].content_type },
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      writeHttpMetadata: headers => headers.set('Content-Type', rows[0].content_type) };
  },
  async head(key) {
    const { rows } = await pool.query('SELECT key,octet_length(data) AS size FROM stored_files WHERE key=$1', [key]);
    if (rows[0]) return rows[0];
    if (key.startsWith('legacy-hash/')) return null;
    const { createHash } = await import('node:crypto');
    return this.head('legacy-hash/' + createHash('sha256').update(key).digest('hex'));
  },
  async put(key, value, options) {
    if (value instanceof ReadableStream) value = await new Response(value).arrayBuffer();
    const bytes = typeof value === 'string' ? Buffer.from(value) : Buffer.from(value);
    await pool.query('INSERT INTO stored_files(key,data,content_type) VALUES ($1,$2,$3) ON CONFLICT(key) DO UPDATE SET data=excluded.data,content_type=excluded.content_type,updated_at=now()', [key, bytes, options?.httpMetadata?.contentType ?? 'application/octet-stream']);
    return this.head(key);
  },
  async delete(keys) {
    const { createHash } = await import('node:crypto');
    const all = (Array.isArray(keys) ? keys : [keys]).flatMap(key => [key,'legacy-hash/' + createHash('sha256').update(key).digest('hex')]);
    await pool.query('DELETE FROM stored_files WHERE key=ANY($1::text[])', [all]);
  },
};
pg.types.setTypeParser(20, Number); // SQLite returned numeric COUNT/SUM values.
export const env = { ...process.env, DB, BUCKET, get BRIDGE_SECRET() { return process.env.BRIDGE_SECRET; } };
