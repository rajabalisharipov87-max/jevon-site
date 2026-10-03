import {env} from 'cloudflare:workers';
import {clientPhone,normalizePhone,noStore} from '../../client-session';
export async function GET(request:Request){
const phone=await clientPhone(request),token=new URL(request.url).searchParams.get('t');if(!phone||!token||!/^[a-f0-9]{48}$/.test(token))return new Response('Войдите в кабинет',{status:401,headers:noStore});
const row=await env.DB!.prepare('SELECT payload FROM shared_orders WHERE token=?').bind(token).first<{payload:string}>();if(!row||normalizePhone(JSON.parse(row.payload).phone)!==phone)return new Response('Доступ запрещён',{status:403,headers:noStore});
const secret=(env as unknown as {BRIDGE_SECRET?:string}).BRIDGE_SECRET;
const response=await fetch('https://jevon-order-status.rajabalisharipov87.chatgpt.site/api/public-packaging-photo?t='+encodeURIComponent(token),{headers:{Authorization:`Bearer ${secret}`}});
return new Response(response.body,{status:response.status,headers:{...noStore,'Content-Type':response.headers.get('Content-Type')||'image/jpeg','X-Content-Type-Options':'nosniff'}});
}
