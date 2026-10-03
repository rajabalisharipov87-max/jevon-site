import { env } from "cloudflare:workers";
import { allOrders } from "../../current-orders";
import { syncSharedOrder } from "../../share-sync";
const phoneOf=(value?:string)=>{const digits=(value||'').replace(/\D/g,'');return /^\d{9}$/.test(digits)?'992'+digits:/^(?:992\d{9}|7\d{10})$/.test(digits)?digits:null};
export async function POST(request:Request){
  const secret=(env as unknown as {BRIDGE_SECRET?:string}).BRIDGE_SECRET;
  if(!secret||request.headers.get('Authorization')!==`Bearer ${secret}`)return Response.json({error:'Доступ запрещён'},{status:403});
  const body=await request.json() as {token?:string;phone?:string};
  const orders=await allOrders();let phone=phoneOf(body.phone);
  if(body.token){const link=await env.DB!.prepare('SELECT order_id AS id FROM order_share_links WHERE token=?').bind(body.token).first<{id:string}>();const order=orders.find(o=>o.id===link?.id);const actual=phoneOf(order?.phone);if(!actual||phone&&phone!==actual)return Response.json({error:'Проверьте телефон в карточке заказа у менеджера'},{status:403});phone=actual}
  if(!phone)return Response.json({error:'Телефон не указан'},{status:400});
  const matching=orders.filter(o=>phoneOf(o.phone)===phone);
  for(const o of matching){
    const token=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
    await env.DB!.prepare('INSERT INTO order_share_links (order_id,token) VALUES (?,?) ON CONFLICT(order_id) DO NOTHING').bind(o.id,token).run();
    await syncSharedOrder(o.id);
  }
  return Response.json({phone},{headers:{'Cache-Control':'no-store'}});
}
