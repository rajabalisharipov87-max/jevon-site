import { canEditConstructorOrder } from "../constructor-access";
import { getRoleCode } from "../../role-session";
import { env } from "cloudflare:workers";
import { findOrder } from "../../current-orders";
import { syncSharedOrder } from "../../share-sync";

export async function POST(request: Request) {
  const code = await getRoleCode(request);
  try {
    const { orderId } = await request.json() as {orderId?:unknown};
    if (typeof orderId !== "string" || !await findOrder(orderId)) return Response.json({error:"Заказ не найден"},{status:404});
    if (code !== "1101" && !canEditConstructorOrder(code, orderId)) return Response.json({error:"Доступ запрещён"},{status:403});
    const existing = await env.DB!.prepare("SELECT token FROM order_share_links WHERE order_id = ?").bind(orderId).first<{token:string}>();
    const token = existing?.token || Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,"0")).join("");
    if (!existing) await env.DB!.prepare("INSERT INTO order_share_links (order_id, token) VALUES (?, ?)").bind(orderId,token).run();
    await syncSharedOrder(orderId,token);
    const origin = (env as unknown as {TRACKING_ORIGIN:string}).TRACKING_ORIGIN;
    return Response.json({url:`${origin}/?t=${token}`},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { console.error("Sharing order failed",error); return Response.json({error:"Не удалось создать ссылку. Повторите попытку."},{status:503}); }
}
