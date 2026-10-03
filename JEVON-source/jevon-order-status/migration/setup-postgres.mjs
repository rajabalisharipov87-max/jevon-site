import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import ts from 'typescript';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const { initializeDatabase, pool, transaction } = await import('../scripts/postgres-storage.mjs');
export async function setup() {
  await initializeDatabase();
  await transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(80800801)');
    const done = await client.query("SELECT 1 FROM app_settings WHERE key='sqlite_import_v1'");
    if (!done.rowCount) {
      const source = resolve('.sites-runtime/next-local/database.sqlite');
      if (existsSync(source)) {
        const { DatabaseSync } = await import('node:sqlite');
        const sqlite = new DatabaseSync(source, { readOnly: true });
        try {
          const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_local_%' ORDER BY CASE name WHEN 'workshop_project_items' THEN 1 ELSE 0 END,name").all();
          for (const { name } of tables) {
            const quote = value => '"' + value.replaceAll('"', '""') + '"';
            for (const row of sqlite.prepare(`SELECT * FROM ${quote(name)}`).all()) {
              const fields = Object.keys(row);
              await client.query(`INSERT INTO ${quote(name)} (${fields.map(quote).join(',')}) VALUES (${fields.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT DO NOTHING`, Object.values(row));
            }
          }
        } finally { sqlite.close(); }
      }
      const objects = resolve('.sites-runtime/next-local/objects');
      // Original object filenames are hashes; preserve their bytes in the database.
      if (existsSync(objects)) for (const name of readdirSync(objects).filter(name => /^[a-f0-9]{64}$/.test(name))) {
        const metadataPath = resolve(objects, name + '.json');
        const type = existsSync(metadataPath) ? JSON.parse(readFileSync(metadataPath,'utf8')).contentType : 'application/octet-stream';
        await client.query('INSERT INTO stored_files(key,data,content_type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', ['legacy-hash/'+name,readFileSync(resolve(objects,name)),type ?? 'application/octet-stream']);
      }
      for (const source of ['order-catalog','order-supplement']) {
        const js = ts.transpileModule(readFileSync(resolve('app', source + '.ts'),'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
        const data = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
        for (const order of Object.values(data).flat()) await client.query('INSERT INTO synced_orders(id,data,updated_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [order.id,JSON.stringify(order),new Date().toISOString()]);
      }
      for (const name of ['order_materials','workshop_projects','workshop_project_items']) await client.query(`SELECT setval(pg_get_serial_sequence('${name}','id'), COALESCE((SELECT MAX(id) FROM ${name}),1), EXISTS(SELECT 1 FROM ${name}))`);
      await client.query("INSERT INTO app_settings(key,value) VALUES ('sqlite_import_v1','complete')");
    }
  });
  const secret = (await pool.query("SELECT value FROM app_settings WHERE key='session_secret'")).rows[0].value;
  process.env.BRIDGE_SECRET ||= secret;
  const roles = [['1001','Начальник цеха','Начальник цеха'],['1101','Менеджер','Менеджер'],['2202','Производство','Производство'],['3303','Снабжение','Снабжение'],['5505','Далер','Конструктор'],['6606','Умед','Конструктор'],['7707','Озод','Конструктор'],['8808','Анвар','Конструктор']];
  if (!(await pool.query("SELECT 1 FROM app_settings WHERE key='employees_seed_v1'")).rowCount) await transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(80800801)');
    for (const [code,name,department] of roles) await client.query('INSERT INTO employees(name,department,code_hash) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',[name,department,createHmac('sha256',process.env.BRIDGE_SECRET).update(code).digest('hex')]);
    await client.query("INSERT INTO app_settings(key,value) VALUES ('employees_seed_v1','complete') ON CONFLICT DO NOTHING");
  });
  console.log('PostgreSQL: connected; schema, orders, employees and file storage ready.');
}
if (process.argv[1]?.endsWith('setup-postgres.mjs')) { try { await setup(); } finally { await pool.end(); } }
import './config.mjs';
