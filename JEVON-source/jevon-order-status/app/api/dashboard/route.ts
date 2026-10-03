import { getRoleCode } from "../../role-session";
import { dashboardData,ready } from "../../dashboard-data";
export async function GET(request: Request) {
  const code=await getRoleCode(request);
  if(!code||code==='3303')return Response.json({error:"Доступ запрещён"},{status:403});
  const url=new URL(request.url),filter=url.searchParams.get('filter')||'active',q=(url.searchParams.get('q')||'').trim().toLowerCase().slice(0,120);
  const limit=Math.min(30,Math.max(1,Number(url.searchParams.get('limit'))||30)),offset=Math.max(0,Math.floor(Number(url.searchParams.get('offset'))||0));
  const {role,orders}=await dashboardData(code);
  const visible=orders.filter(o=>role.department!=="Производство"||!!o.drawingCompleted);
  const category=(o:typeof orders[number])=>o.pickedUpAt?'shipped':(role.group?!!o.drawingCompleted:ready(o))?'ready':'active';
  const counts={active:0,ready:0,shipped:0};for(const o of visible)counts[category(o)]++;
  const matches=visible.filter(o=>category(o)===filter&&(!q||o.id.toLowerCase().includes(q)||o.client.toLowerCase().includes(q)));
  const page=matches.slice(offset,offset+limit);
  const body=JSON.stringify({orders:page,counts,total:matches.length,offset,hasMore:offset+page.length<matches.length});
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body));const etag='"'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')+'"';
  const headers={'Cache-Control':'private, no-cache',ETag:etag};
  if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers});
  return new Response(body,{headers:{...headers,'Content-Type':'application/json'}});
}
