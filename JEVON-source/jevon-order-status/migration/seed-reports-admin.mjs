import './config.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {pool,transaction,initializeDatabase} from '../scripts/postgres-storage.mjs';
import {hashPassword} from '../scripts/reports-password.mjs';
export async function seedReportsAdmin(){
  await transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(80800801)');
    if((await client.query('SELECT 1 FROM reports_users LIMIT 1')).rowCount)return;
    const username=(process.env.REPORTS_ADMIN_LOGIN||'admin').trim().toLowerCase();
    if(!/^[a-z0-9_.@-]{3,80}$/.test(username))throw Error('Invalid REPORTS_ADMIN_LOGIN');
    const password=process.env.REPORTS_ADMIN_PASSWORD||randomBytes(18).toString('base64url');
    if(password.length<12||password.length>128)throw Error('REPORTS_ADMIN_PASSWORD must contain 12 to 128 characters');
    const passwordHash=await hashPassword(password);
    if(!process.env.REPORTS_ADMIN_PASSWORD){
      mkdirSync('.sites-runtime',{recursive:true});
      // Write before commit so a filesystem error cannot create an inaccessible account.
      writeFileSync('.sites-runtime/reports-admin.json',JSON.stringify({login:username,password},null,2)+'\n',{mode:0o600});
      console.log('Reports administrator credentials: .sites-runtime/reports-admin.json (ignored by Git).');
    }
    await client.query('INSERT INTO reports_users(username,full_name,password_hash,role) VALUES ($1,$2,$3,$4)',[username,'Администратор портала',passwordHash,'admin']);
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){try{await initializeDatabase();await seedReportsAdmin();}finally{await pool.end();}}
