import { spawn } from 'node:child_process';
import {createConnection} from 'node:net';
import { prepareDatabase } from '../migration/prepare.mjs';
const { pool } = await import('./postgres-storage.mjs');
try{await prepareDatabase();}
catch(error){console.error('Database preparation failed:',error.message);await pool.end();process.exit(1);}
await pool.end();
const command = process.argv[2] ?? 'dev';
if(['dev','start'].includes(command)){
  const occupied=await new Promise(resolve=>{
    const socket=createConnection({host:'127.0.0.1',port:8080});
    socket.setTimeout(1500);
    const finish=value=>{socket.destroy();resolve(value);};
    socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));socket.once('timeout',()=>finish(false));
  });
  if(occupied){console.log('Port 8080 is already in use. Open http://127.0.0.1:8080 .');process.exit(0);}
}
const args = ['dev','start'].includes(command) ? ['--hostname','127.0.0.1','--port','8080'] : [];
const child = spawn(process.execPath,['node_modules/next/dist/bin/next',command,...args],{stdio:'inherit',env:{...process.env,JEVON_LOCAL:'1'}});
child.on('exit', code => process.exit(code ?? 1));
child.on('error', error => { console.error(error); process.exit(1); });
process.on('SIGINT',()=>child.kill('SIGINT'));
process.on('SIGTERM',()=>child.kill('SIGTERM'));
