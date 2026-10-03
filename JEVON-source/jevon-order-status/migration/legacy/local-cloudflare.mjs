// Next.js-only local bindings. Production continues to use cloudflare:workers.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '.sites-runtime', 'next-local');
mkdirSync(root, { recursive: true });
const sqlite = new DatabaseSync(resolve(root, 'database.sqlite'));
sqlite.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)');
for (const name of readdirSync(resolve(process.cwd(), 'migration/legacy/sqlite')).filter(name => name.endsWith('.sql')).sort()) {
  if (sqlite.prepare('SELECT name FROM _local_migrations WHERE name = ?').get(name)) continue;
  sqlite.exec('BEGIN');
  try {
    sqlite.exec(readFileSync(resolve(process.cwd(), 'migration/legacy/sqlite', name), 'utf8'));
    sqlite.prepare('INSERT INTO _local_migrations (name) VALUES (?)').run(name);
    sqlite.exec('COMMIT');
  } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
}

class Statement {
  constructor(sql, values = []) { this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.sql, values); }
  statement() { return sqlite.prepare(this.sql); }
  async first(column) {
    const row = this.statement().get(...this.values);
    return row ? (column === undefined ? { ...row } : row[column]) : null;
  }
  async all() {
    return { success: true, results: this.statement().all(...this.values).map(row => ({ ...row })), meta: {} };
  }
  async raw(options) {
    const statement = this.statement();
    statement.setReturnArrays(true);
    const rows = statement.all(...this.values);
    return options?.columnNames ? [statement.columns().map(column => column.name), ...rows] : rows;
  }
  async run() {
    const result = this.statement().run(...this.values);
    return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
}
const DB = {
  prepare: sql => new Statement(sql),
  async exec(sql) { sqlite.exec(sql); return { count: 1, duration: 0 }; },
  async batch(statements) {
    sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.all());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  },
};

const objects = resolve(root, 'objects');
mkdirSync(objects, { recursive: true });
const objectPath = key => resolve(objects, createHash('sha256').update(key).digest('hex'));
const BUCKET = {
  async get(key) {
    const path = objectPath(key);
    if (!existsSync(path)) return null;
    const bytes = readFileSync(path);
    const httpMetadata = existsSync(path + '.json') ? JSON.parse(readFileSync(path + '.json', 'utf8')) : {};
    return { key, size: bytes.length, body: new Uint8Array(bytes), httpMetadata,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      writeHttpMetadata: headers => { if (httpMetadata.contentType) headers.set('Content-Type', httpMetadata.contentType); } };
  },
  async head(key) { return this.get(key); },
  async put(key, value, options) {
    if (value instanceof ReadableStream) value = await new Response(value).arrayBuffer();
    const path = objectPath(key);
    writeFileSync(path, typeof value === 'string' ? value : Buffer.from(value));
    writeFileSync(path + '.json', JSON.stringify(options?.httpMetadata ?? {}));
    return this.head(key);
  },
  async delete(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      for (const path of [objectPath(key), objectPath(key) + '.json']) if (existsSync(path)) unlinkSync(path);
    }
  },
};
const secretFile = resolve(root, 'session-secret');
if (!existsSync(secretFile)) {
  try { writeFileSync(secretFile, randomBytes(32).toString('hex'), { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
}
export const env = { ...process.env, DB, BUCKET, BRIDGE_SECRET: process.env.BRIDGE_SECRET || readFileSync(secretFile, 'utf8') };
