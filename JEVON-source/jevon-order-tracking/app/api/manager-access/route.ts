import {env} from 'cloudflare:workers';
import {normalizePhone,passwordHash,sign,same,noStore} from '../../client-session';
const authorized=(r:Request)=>{const secret=(env as unknown as {BRIDGE_SECRET?:string}).BRIDGE_SECRET;return !!secret&&r.headers.get('Authorization')===`Bearer ${secret}`};
export async function GET(request:Request){if(!authorized(request))return Response.json({error:'Доступ запрещён'},{status:403});const rows=await env.DB!.prepare('SELECT phone FROM client_accounts').all<{phone:string}>();return Response.json({phones:rows.results.map(r=>r.phone)},{headers:noStore})}
export async function POST(request:Request){
 if(!authorized(request))return Response.json({error:'Доступ запрещён'},{status:403});
 try{
 const {phone:value}=await request.json() as {phone?:unknown};const phone=normalizePhone(value);if(!phone)return Response.json({error:'Некорректный телефон'},{status:400});
 const account=await env.DB!.prepare('SELECT phone FROM client_accounts WHERE phone=?').bind(phone).first();if(!account)return Response.json({error:'Клиент ещё не зарегистрирован'},{status:404});
 const legacy=await env.DB!.prepare('SELECT salt,password_hash AS hash FROM client_accounts WHERE code_hash IS NULL').all<{salt:string;hash:string}>();
 for(let i=0;i<30;i++){
 const random=crypto.getRandomValues(new Uint32Array(1))[0];if(random>=4294890000)continue;
 const code=String(10000+random%90000),hash=await sign('client-code:'+code);
 if(await env.DB!.prepare('SELECT phone FROM client_accounts WHERE code_hash=?').bind(hash).first())continue;
 let collision=false;for(const old of legacy.results){if(same(old.hash,await passwordHash(code,old.salt))){collision=true;break}}if(collision)continue;
 const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
 const changed=await env.DB!.prepare('UPDATE OR IGNORE client_accounts SET salt=?,password_hash=?,code_hash=? WHERE phone=?').bind(salt,await passwordHash(code,salt),hash,phone).run();
 if(changed.meta.changes)return Response.json({code,phone:'+'+phone},{headers:noStore});
 }
 throw Error('Code allocation failed');
 }catch{return Response.json({error:'Не удалось выдать код. Попробуйте позже.'},{status:503,headers:noStore})}
}
