import { existsSync } from 'node:fs';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const {pool} = await import('../scripts/postgres-storage.mjs');
try {
  const result = await pool.query('SELECT current_database() AS database, current_user AS user, 1 AS connected');
  console.log(result.rows[0]);
  console.log((await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(row=>row.tablename));
  console.log((await pool.query('SELECT (SELECT count(*) FROM synced_orders) AS orders,(SELECT count(*) FROM employees) AS employees,(SELECT count(*) FROM attendance_events) AS attendance,(SELECT count(*) FROM stored_files) AS files')).rows[0]);
}finally{await pool.end();}
import './config.mjs';
