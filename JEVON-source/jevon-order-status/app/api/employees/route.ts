import { createHmac } from 'node:crypto';
import { env } from 'cloudflare:workers';
import { getRoleCode } from '../../role-session';
const canManage = async (request:Request) => ['1001','1101'].includes(await getRoleCode(request) ?? '');
export async function GET(request:Request) {
  if (!await canManage(request)) return Response.json({error:'Доступ запрещён'},{status:403});
  const {results}=await env.DB!.prepare('SELECT id,name,department,active FROM employees ORDER BY id').all();
  return Response.json({employees:results},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request) {
  if (!await canManage(request)) return Response.json({error:'Доступ запрещён'},{status:403});
  try {
    const body=await request.json() as {name?:unknown;department?:unknown;code?:unknown};
    if(typeof body.name!=='string'||!body.name.trim()||body.name.length>120||typeof body.code!=='string'||!/^\d{4}$/.test(body.code)||typeof body.department!=='string'||body.department.length>120) return Response.json({error:'Укажите имя, отдел и четырёхзначный код.'},{status:400});
    const hash=createHmac('sha256',(env as unknown as {BRIDGE_SECRET:string}).BRIDGE_SECRET).update(body.code).digest('hex');
    const employee=await env.DB!.prepare('INSERT INTO employees(name,department,code_hash) VALUES (?,?,?) ON CONFLICT(code_hash) DO NOTHING RETURNING id,name,department,active').bind(body.name.trim(),body.department.trim(),hash).first();
    return employee?Response.json({employee},{status:201}):Response.json({error:'Код уже используется.'},{status:409});
  }catch{return Response.json({error:'Не удалось сохранить сотрудника.'},{status:503});}
}
