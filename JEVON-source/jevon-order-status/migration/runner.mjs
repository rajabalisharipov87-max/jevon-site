import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
export async function applyMigrations(client) {
  // Called inside a transaction, serializes concurrent deployments and startups.
  await client.query('SELECT pg_advisory_xact_lock(80800801)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const sqlFolder = resolve(process.cwd(), 'migration/sql');
  const files = readdirSync(sqlFolder).filter(name=>name.endsWith('.sql')).sort();
  if(!files.length) throw new Error('No SQL migrations found');
  for(const name of files) {
    if(!/^\d{4}_[a-zA-Z0-9_-]+\.sql$/.test(name)) throw new Error(`Invalid migration name: ${name}`);
    const sql = readFileSync(resolve(sqlFolder,name),'utf8').replaceAll('\r\n','\n');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const record = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1',[name]);
    if(record.rowCount) {
      if(record.rows[0].checksum!==checksum) throw new Error(`Applied migration ${name} was changed. Restore it and add a new migration.`);
      continue;
    }
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(name,checksum) VALUES ($1,$2)',[name,checksum]);
    console.log(`Applied ${name}`);
  }
  const applied = await client.query('SELECT name FROM schema_migrations');
  for(const {name} of applied.rows) if(!files.includes(name))throw new Error(`Applied migration ${name} is missing from this checkout.`);
}
