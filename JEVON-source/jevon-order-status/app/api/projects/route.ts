import {env} from 'cloudflare:workers';
import type {ProjectItem} from '../../project-products';
import {getRoleCode} from '../../role-session';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){if(await getRoleCode(request)!=='1001')return Response.json({error:'Доступ запрещён'},{status:403,headers});try{const rows=await env.DB!.prepare('SELECT id,client,phone,created_at AS createdAt FROM workshop_projects ORDER BY id DESC').all();const items=await env.DB!.prepare('SELECT id,project_id AS projectId,name,quantity,unit_price_cents AS unitPriceCents,created_at AS createdAt FROM workshop_project_items ORDER BY id').all<ProjectItem>();const grouped=new Map<number,ProjectItem[]>();for(const item of items.results){const list=grouped.get(item.projectId)||[];list.push(item);grouped.set(item.projectId,list)}return Response.json({projects:rows.results.map(row=>({...row,items:grouped.get(Number(row.id))||[]}))},{headers})}catch{return Response.json({error:'Не удалось загрузить проекты'},{status:503,headers})}}
export async function POST(request:Request){
 if(await getRoleCode(request)!=='1001')return Response.json({error:'Доступ запрещён'},{status:403,headers});
 if(request.headers.get('Origin')!==new URL(request.url).origin)return Response.json({error:'Недопустимый запрос'},{status:403,headers});
 try{const body=await request.json() as {client?:unknown;phone?:unknown};const client=typeof body.client==='string'?body.client.trim():'';const digits=typeof body.phone==='string'?body.phone.replace(/\D/g,''):'';const phone=/^\d{9}$/.test(digits)?'+992'+digits:/^(?:992\d{9}|7\d{10})$/.test(digits)?'+'+digits:null;
 if(!client||client.length>120||!phone)return Response.json({error:'Укажите имя клиента и телефон: 9 цифр, +992 и 9 цифр или +7 и 10 цифр'},{status:400,headers});
 const createdAt=new Date().toISOString();const project=await env.DB!.prepare('INSERT INTO workshop_projects (client,phone,created_at) VALUES (?,?,?) RETURNING id,client,phone,created_at AS createdAt').bind(client,phone,createdAt).first();return Response.json({project:{...project,items:[]}},{status:201,headers});
 }catch{return Response.json({error:'Не удалось сохранить проект'},{status:503,headers})}
}
