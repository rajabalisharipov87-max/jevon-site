import { env } from "cloudflare:workers";
import { getRoleCode } from "../../role-session";
import { canEditConstructorOrder } from "../constructor-access";
import { findOrder } from "../../current-orders";
import { syncIfShared } from "../../share-sync";

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("id");
  if (!orderId || !/^[0-9]{2}\/[0-9]{3}$/.test(orderId)) return Response.json({ error: "Неверный номер заказа" }, { status: 400 });
  const code = await getRoleCode(request);
  if (!canEditConstructorOrder(code, orderId) && code !== "1101") return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  const row = await env.DB!.prepare("SELECT url FROM order_drawing_links WHERE order_id = ?").bind(orderId).first<{url:string}>();
  return Response.json({ url: row?.url || "" }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const payload = await request.json() as { orderId?: unknown; url?: unknown };
  if (!canEditConstructorOrder(await getRoleCode(request), payload.orderId)) return Response.json({ error: "Этот заказ другого конструктора" }, { status: 403 });
  if (!await findOrder(payload.orderId)) return Response.json({ error: "Заказ не найден" }, { status: 404 });
  if (typeof payload.url !== "string" || payload.url.length > 2048) return Response.json({ error: "Введите действительную ссылку" }, { status: 400 });
  const value = payload.url.trim();
  let parsed: URL;
  try { parsed = new URL(value); } catch { return Response.json({ error: "Введите полную ссылку с https://" }, { status: 400 }); }
  if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) return Response.json({ error: "Нужна безопасная ссылка с https://" }, { status: 400 });
  await env.DB!.prepare("INSERT INTO order_drawing_links (order_id, url) VALUES (?, ?) ON CONFLICT(order_id) DO UPDATE SET url = excluded.url").bind(payload.orderId,parsed.toString()).run();
  await syncIfShared(payload.orderId);
  return Response.json({ ok: true, url: parsed.toString() });
}
