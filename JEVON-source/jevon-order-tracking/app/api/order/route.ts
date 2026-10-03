import { clientPhone,normalizePhone } from "../../client-session";
import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";
const tokenPattern = /^[a-f0-9]{48}$/;
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  if (!token || !tokenPattern.test(token)) return Response.json({ error: "Ссылка недействительна" }, { status: 404, headers: noStore });
  try {
    const row = await env.DB!.prepare("SELECT payload, updated_at AS updatedAt FROM shared_orders WHERE token = ?").bind(token).first<{ payload: string; updatedAt: string }>();
    if (!row) return Response.json({ error: "Заказ по этой ссылке не найден" }, { status: 404, headers: noStore });
    const phone=await clientPhone(request);const {phone:owner,...order}=JSON.parse(row.payload);
    if(!phone||normalizePhone(owner)!==phone)return Response.json({error:"Войдите с телефоном и паролем"},{status:401,headers:noStore});
    return Response.json({ order, updatedAt: row.updatedAt }, { headers: noStore });
  } catch (error) {
    console.error("Shared order lookup failed", error);
    return Response.json({ error: "Не удалось загрузить заказ" }, { status: 503, headers: noStore });
  }
}

export async function PUT(request: Request) {
  const secret = (env as unknown as { BRIDGE_SECRET?: string }).BRIDGE_SECRET;
  if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 10000) return Response.json({ error: "Данные слишком большие" }, { status: 413 });
    const { token, order } = JSON.parse(body);
    if (typeof token !== "string" || !tokenPattern.test(token) || !order || typeof order !== "object" ||
        !/^\d{2}\/\d{3}$/.test(order.id) || typeof order.status !== "string" || !Array.isArray(order.stages)) {
      return Response.json({ error: "Неверные данные заказа" }, { status: 400 });
    }
    await env.DB!.prepare("INSERT INTO shared_orders (token, payload, owner_phone, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(token) DO UPDATE SET payload = excluded.payload, owner_phone = excluded.owner_phone, updated_at = excluded.updated_at")
      .bind(token, JSON.stringify(order),normalizePhone(order.phone)).run();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Shared order update failed", error);
    return Response.json({ error: "Не удалось обновить заказ" }, { status: 503 });
  }
}
