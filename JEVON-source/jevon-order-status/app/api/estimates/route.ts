import {env} from 'cloudflare:workers';
import {getRoleCode} from '../../role-session';
import {readEstimate} from '../../estimates';
import {findOrder} from '../../current-orders';
export async function GET(request:Request) {
 if(await getRoleCode(request)!=='1101')return Response.json({error:'Доступ запрещён'},{status:403});
 const id=new URL(request.url).searchParams.get('id');
 if(!id||!/^\d{2}\/\d{3}$/.test(id))return Response.json({error:'Неверный номер заказа'},{status:400});
 try {
 if(!await findOrder(id))return Response.json({error:'Заказ не найден'},{status:404});
 return Response.json(await readEstimate(id),{headers:{'Cache-Control':'no-store'}});
 }catch(error){console.error(error);return Response.json({error:'Смета временно недоступна'},{status:503});}
}

export async function POST(request:Request){return saveChange(request,false);}
export async function PUT(request:Request){return saveChange(request,true);}
async function saveChange(request:Request,editing:boolean){
 if(await getRoleCode(request)!=='1101')return Response.json({error:'Доступ запрещён'},{status:403});
 try{
 const payload=await request.json() as Record<string,unknown>;
 const id=payload.orderId;
 if(typeof id!=='string'||!/^\d{2}\/\d{3}$/.test(id)||typeof payload.type!=='string'||!payload.type.trim()||payload.type.length>120||typeof payload.description!=='string'||payload.description.length>500||typeof payload.quantity!=='number'||!Number.isFinite(payload.quantity)||payload.quantity<=0||payload.quantity>99999||!Number.isSafeInteger(payload.priceCents)||Number(payload.priceCents)<0||Number(payload.priceCents)>100000000||!['шт.','лист','м²','п.м.','сверление','уп.'].includes(String(payload.unit)))return Response.json({error:'Проверьте название, количество и цену'},{status:400});
 if(!await findOrder(id))return Response.json({error:'Заказ не найден'},{status:404});
 const estimate=await readEstimate(id);
 let rowId='manual:'+crypto.randomUUID();
 if(editing){
 if(typeof payload.rowId!=='string')return Response.json({error:'Позиция не найдена'},{status:404});
 const existing=estimate.rows.find(row=>row.rowId===payload.rowId);
 if(!existing)return Response.json({error:'Позиция больше не существует. Обновите смету.'},{status:409});
 rowId=payload.rowId;
 if(rowId.startsWith('material:')&&(payload.type!==existing.type||payload.unit!==existing.unit))return Response.json({error:'Для позиции раскроя изменяются только количество, описание и цена'},{status:400});
 }else if(estimate.rows.length>=200)return Response.json({error:'В смете уже 200 позиций'},{status:400});
 const data=JSON.stringify({type:payload.type.trim(),description:payload.description.trim(),quantity:payload.quantity,unit:payload.unit,priceCents:payload.priceCents});
 await env.DB!.prepare('INSERT INTO order_estimate_changes (order_id, row_id, data) VALUES (?, ?, ?) ON CONFLICT(order_id,row_id) DO UPDATE SET data = excluded.data').bind(id,rowId,data).run();
 return Response.json({ok:true,estimate:await readEstimate(id)});
 }catch(error){console.error('Saving estimate failed',error);return Response.json({error:'Не удалось сохранить смету'},{status:503});}
}
