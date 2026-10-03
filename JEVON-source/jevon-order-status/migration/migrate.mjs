import { databaseUrl } from './config.mjs';
import { applyMigrations } from './runner.mjs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
export async function migrate() {
  const client = new pg.Client({ connectionString: databaseUrl(), connectionTimeoutMillis: 5000 });
  try {
    await client.connect();await client.query('BEGIN');
    try { await applyMigrations(client);await client.query('COMMIT'); }
    catch(error) { await client.query('ROLLBACK');throw error; }
    console.log('PostgreSQL migrations are up to date.');
  }finally{await client.end();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)) await migrate();
