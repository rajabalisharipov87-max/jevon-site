import {env} from 'cloudflare:workers';
import {getRoleCode} from '../../role-session';
import {projectProductTypes,parsePrice} from '../../project-products';
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 if(await getRoleCode(request)!=='1001')return Response.json({error:'Доступ запрещён'},{status:403,headers});
 if(request.headers.get('Origin')!==new URL(request.url).origin)return Response.json({error:'Недопустимый запрос'},{status:403,headers});
 try{const body=await request.json() as {projectId?:unknown;name?:unknown;quantity?:unknown;price?:unknown};const id=body.projectId,quantity=body.quantity,price=parsePrice(body.price);
 if(typeof id!=='number'||!Number.isSafeInteger(id)||id<1||typeof body.name!=='string'||!projectProductTypes.includes(body.name as typeof projectProductTypes[number])||typeof quantity!=='number'||!Number.isInteger(quantity)||quantity<1||quantity>9999||price===null)return Response.json({error:'Выберите изделие, укажите количество от 1 до 9999 и цену с точностью до двух знаков'},{status:400,headers});
 if(!await env.DB!.prepare('SELECT id FROM workshop_projects WHERE id=?').bind(id).first())return Response.json({error:'Проект не найден'},{status:404,headers});
 const item=await env.DB!.prepare('INSERT INTO workshop_project_items (project_id,name,quantity,unit_price_cents,created_at) VALUES (?,?,?,?,?) RETURNING id,project_id AS projectId,name,quantity,unit_price_cents AS unitPriceCents,created_at AS createdAt').bind(id,body.name,quantity,price,new Date().toISOString()).first();return Response.json({item},{status:201,headers});
 }catch{return Response.json({error:'Не удалось сохранить изделие. Попробуйте ещё раз.'},{status:503,headers})}
}
