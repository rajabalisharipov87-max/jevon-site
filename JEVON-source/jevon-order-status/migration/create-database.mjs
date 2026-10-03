import { databaseUrl } from './config.mjs';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
export async function createDatabase() {
  const url = new URL(databaseUrl());
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!name || Buffer.byteLength(name)>63) throw new Error('DATABASE_URL must contain a database name of up to 63 bytes');
  url.pathname = '/postgres';
  const client = new pg.Client({ connectionString: process.env.ADMIN_DATABASE_URL || url.toString(), connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname=$1',[name]);
    if (exists.rowCount) { console.log(`Database ${name} already exists.`); return; }
    const identifier = '"' + name.replaceAll('"','""') + '"';
    const owner = '"' + decodeURIComponent(new URL(databaseUrl()).username).replaceAll('"','""') + '"';
    if (owner==='""') throw new Error('DATABASE_URL must specify the application database user');
    try { await client.query(`CREATE DATABASE ${identifier} OWNER ${owner} ENCODING 'UTF8'`); }
    catch(error) { if(error.code!=='42P04') throw error; }
    console.log(`Database ${name} is ready.`);
  } finally { await client.end(); }
}
if(process.argv[1]===fileURLToPath(import.meta.url)) await createDatabase();
