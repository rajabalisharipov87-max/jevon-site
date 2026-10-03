import { env } from "cloudflare:workers";
import { getRoleCode } from "../../role-session";
import { canEditConstructorOrder, constructorGroup } from "../constructor-access";
import { findOrder } from "../../current-orders";
import { syncIfShared } from "../../share-sync";

export async function GET(request: Request) {
  const group = constructorGroup(await getRoleCode(request));
  if (!group) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  const rows = await env.DB!.prepare("SELECT order_id AS orderId FROM order_acceptances WHERE substr(order_id, 4, 1) = ?").bind(group).all<{orderId:string}>();
  return Response.json({ accepted: rows.results.map(row => row.orderId) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const { orderId } = await request.json() as { orderId?: unknown };
  if (!canEditConstructorOrder(await getRoleCode(request), orderId)) return Response.json({ error: "Этот заказ другого конструктора" }, { status: 403 });
  if (!await findOrder(orderId)) return Response.json({ error: "Заказ не найден" }, { status: 404 });
  await env.DB!.prepare("INSERT INTO order_acceptances (order_id, accepted_at) VALUES (?, datetime('now')) ON CONFLICT(order_id) DO NOTHING").bind(orderId).run();
  await syncIfShared(orderId);
  return Response.json({ ok: true });
}
