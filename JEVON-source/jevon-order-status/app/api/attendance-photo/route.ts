import {env} from 'cloudflare:workers';
import {getRoleCode} from '../../role-session';
export async function GET(request:Request) {
  if(!['1001','1101'].includes(await getRoleCode(request)??''))return Response.json({error:'Доступ запрещён'},{status:403});
  const key=new URL(request.url).searchParams.get('key')??'';
  if(!/^attendance\/[a-f0-9-]{36}$/.test(key))return new Response(null,{status:400});
  const photo=await env.BUCKET!.get(key);
  if(!photo)return new Response(null,{status:404});
  return new Response(photo.body,{headers:{'Content-Type':photo.httpMetadata?.contentType??'image/jpeg','Cache-Control':'private, no-store'}});
}
