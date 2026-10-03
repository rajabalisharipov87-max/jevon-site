import {env} from 'cloudflare:workers';
import {getRoleCode} from '../../role-session';
import {readPriceList} from '../../estimates';
import {servicePrices} from '../../service-prices';
export async function GET(request:Request) {
 if(await getRoleCode(request)!=='1101')return Response.json({error:'Доступ запрещён'},{status:403});
 try{return Response.json({prices:await readPriceList()},{headers:{'Cache-Control':'no-store'}});}
 catch(error){console.error(error);return Response.json({error:'Нархнома временно недоступна'},{status:503});}
}
export async function PUT(request:Request) {
 if(await getRoleCode(request)!=='1101')return Response.json({error:'Доступ запрещён'},{status:403});
 try {
 const {prices}=await request.json() as {prices: {type:string;priceCents:number}[]};
 if(!Array.isArray(prices)||prices.length!==servicePrices.length||new Set(prices.map(p=>p.type)).size!==servicePrices.length||prices.some(p=>!servicePrices.some(r=>r.type===p.type)||!Number.isSafeInteger(p.priceCents)||p.priceCents<0||p.priceCents>100000000))return Response.json({error:'Проверьте цены всех услуг'},{status:400});
 await env.DB!.batch(prices.map(p=>env.DB!.prepare('INSERT INTO service_price_overrides (type, price_cents) VALUES (?, ?) ON CONFLICT(type) DO UPDATE SET price_cents = excluded.price_cents').bind(p.type,p.priceCents)));
 return Response.json({ok:true});
 }catch(error){console.error(error);return Response.json({error:'Не удалось сохранить цены'},{status:503});}
}
