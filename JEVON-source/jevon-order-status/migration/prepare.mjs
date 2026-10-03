import {fileURLToPath} from 'node:url';
import {createDatabase} from './create-database.mjs';
import {setup} from './setup-postgres.mjs';
import {pool} from '../scripts/postgres-storage.mjs';
export async function prepareDatabase(){
  await createDatabase();
  await setup();
  await pool.query('SELECT 1');
  console.log('Database check completed. Tables and initial settings are ready.');
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  try{await prepareDatabase();}finally{await pool.end();}
}
