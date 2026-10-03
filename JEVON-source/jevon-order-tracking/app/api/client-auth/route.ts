import {env} from 'cloudflare:workers';
import {ClientLinkError,clientPhone,normalizePhone,passwordHash,sessionCookie,sign,same,syncClientOrders,noStore} from '../../client-session';
export async function GET(request:Request){const phone=await clientPhone(request);return Response.json({authenticated:!!phone,phone:phone?'+'+phone:null},{headers:noStore})}
export async function DELETE(){return Response.json({ok:true},{headers:{...noStore,'Set-Cookie':'jevon_client=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}})}
export async function POST(request:Request){
 let attemptKey:string|null=null;
 try{
  const {phone:value,pin,token,action='login'}=await request.json() as {phone?:unknown;pin?:unknown;token?:unknown;action?:string};let phone=normalizePhone(value);
  if(!['register','login'].includes(action))return Response.json({error:'Некорректный запрос'},{status:400,headers:noStore});
  if(action==='register'&&!phone)return Response.json({error:'Введите телефон: 9 цифр, +992 и 9 цифр или +7 и 10 цифр'},{status:400,headers:noStore});
  const scope='client-auth-ip:'+request.headers.get('CF-Connecting-IP');
  const key=await sign(scope),now=Date.now();attemptKey=key;
  await env.DB!.prepare('INSERT INTO client_attempts (key,count,until) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN CAST(until AS INTEGER) < ? THEN 1 ELSE CAST(count AS INTEGER)+1 END, until=CASE WHEN CAST(until AS INTEGER) < ? THEN excluded.until ELSE until END').bind(key,String(now+900000),now,now).run();
  const attempts=await env.DB!.prepare('SELECT count FROM client_attempts WHERE key=?').bind(key).first<{count:string}>();
  if(Number(attempts?.count)>10)return Response.json({error:'Слишком много попыток. Попробуйте через 15 минут'},{status:429,headers:noStore});
  let issuedCode:string|undefined;
  if(action==='register'){
   const existing=await env.DB!.prepare('SELECT phone FROM client_accounts WHERE phone=?').bind(phone).first();
   if(existing)return Response.json({error:'Этот телефон уже зарегистрирован. Введите ваш код. Если забыли его, обратитесь к менеджеру.'},{status:409,headers:noStore});
   await syncClientOrders(phone);
   const order=await env.DB!.prepare('SELECT token FROM shared_orders WHERE owner_phone=? LIMIT 1').bind(phone).first();
   if(!order)return Response.json({error:'Заказы с этим телефоном не найдены. Укажите номер, который вы сообщили при заказе, или обратитесь к менеджеру.'},{status:400,headers:noStore});
   const legacyAccounts=await env.DB!.prepare('SELECT salt,password_hash AS hash FROM client_accounts WHERE code_hash IS NULL').all<{salt:string;hash:string}>();
   for(let i=0;i<20;i++){
    const random=crypto.getRandomValues(new Uint32Array(1))[0];
    if(random>=4294890000)continue;
    const code=String(10000+random%90000),codeHash=await sign('client-code:'+code);
    let collision=false;for(const legacy of legacyAccounts.results){if(same(legacy.hash,await passwordHash(code,legacy.salt))){collision=true;break}}
    if(collision)continue;
    const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
    const result=await env.DB!.prepare('INSERT INTO client_accounts (phone,salt,password_hash,code_hash) VALUES (?,?,?,?) ON CONFLICT DO NOTHING').bind(phone,salt,await passwordHash(code,salt),codeHash).run();
    if(result.meta.changes){issuedCode=code;break}
    if(await env.DB!.prepare('SELECT phone FROM client_accounts WHERE phone=?').bind(phone).first())return Response.json({error:'Этот телефон уже зарегистрирован. Войдите с вашим кодом.'},{status:409,headers:noStore});
   }
   if(!issuedCode)throw Error('Could not allocate code');
  }else{
   if(typeof pin!=='string'||!/^\d{5}$/.test(pin))return Response.json({error:'Введите код из 5 цифр'},{status:400,headers:noStore});
   const coded=await env.DB!.prepare('SELECT phone FROM client_accounts WHERE code_hash=?').bind(await sign('client-code:'+pin)).first<{phone:string}>();
   if(coded){phone=coded.phone}else{
    // Existing clients keep their previously chosen passwords.
    if(!phone&&typeof token==='string'&&/^[a-f0-9]{48}$/.test(token)){const order=await env.DB!.prepare('SELECT owner_phone FROM shared_orders WHERE token=?').bind(token).first<{owner_phone:string|null}>();phone=normalizePhone(order?.owner_phone)}
    const legacy=phone?await env.DB!.prepare('SELECT salt,password_hash AS hash FROM client_accounts WHERE phone=? AND code_hash IS NULL').bind(phone).first<{salt:string;hash:string}>():null;
    if(!legacy||!same(legacy.hash,await passwordHash(pin,legacy.salt)))return Response.json({error:'Неверный код. Если вы ещё не зарегистрированы, нажмите «Регистрация».'},{status:401,headers:noStore});
   }
   await syncClientOrders(phone);
  }
  await env.DB!.prepare('DELETE FROM client_attempts WHERE key=?').bind(key).run();
  return Response.json({ok:true,phone:'+'+phone,code:issuedCode},{headers:{...noStore,'Set-Cookie':await sessionCookie(phone!)}});
 }catch(error){const status=error instanceof ClientLinkError?error.status:503;if(status===503&&attemptKey){try{await env.DB!.prepare('UPDATE client_attempts SET count=MAX(0,CAST(count AS INTEGER)-1) WHERE key=?').bind(attemptKey).run()}catch{}}return Response.json({error:'Сервис временно недоступен. Попробуйте позже.'},{status,headers:noStore})}
}
