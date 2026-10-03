import { syncEstimate } from "../../estimate-sync";
import { getRoleCode } from "../../role-session";
import { env } from "cloudflare:workers";
import { canEditConstructorOrder, constructorGroup } from "../constructor-access";
import { syncIfShared } from "../../share-sync";
import { notifyRoles } from "../../push-notifications";

export async function GET(request: Request) {
  try {
    const code = await getRoleCode(request), group = constructorGroup(code);
    if (!group && !["1101", "2202"].includes(code ?? "")) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
    const rows = group
      ? await env.DB!.prepare("SELECT order_id AS orderId, completed_at AS completedAt FROM order_drawings WHERE substr(order_id, 4, 1) = ?").bind(group).all<{ orderId: string; completedAt: string }>()
      : await env.DB!.prepare("SELECT order_id AS orderId, completed_at AS completedAt FROM order_drawings").all<{ orderId: string; completedAt: string }>();
    const areaQuery = "SELECT order_id AS orderId, SUM(planned) AS area FROM order_materials WHERE type = 'Чертёж Базис Мебельщик'";
    const areas = group
      ? await env.DB!.prepare(areaQuery + " AND substr(order_id, 4, 1) = ? GROUP BY order_id").bind(group).all<{ orderId: string; area: number }>()
      : await env.DB!.prepare(areaQuery + " GROUP BY order_id").all<{ orderId: string; area: number }>();
    return Response.json({ areas: Object.fromEntries(areas.results.map(row => [row.orderId, row.area])), drawings: Object.fromEntries(rows.results.map(row => [row.orderId, row.completedAt])) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Loading drawing statuses failed", error);
    return Response.json({ error: "Статусы чертежей недоступны" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { orderId?: unknown };
    if (!canEditConstructorOrder(await getRoleCode(request), payload.orderId)) return Response.json({ error: "Этот заказ другого конструктора" }, { status: 403 });
    if (typeof payload.orderId !== "string" || !/^\d{2}\/\d{3}$/.test(payload.orderId)) return Response.json({ error: "Неверный номер заказа" }, { status: 400 });
    const count = await env.DB!.prepare("SELECT COUNT(*) AS total FROM order_materials WHERE order_id = ?").bind(payload.orderId).first<{ total: number }>();
    if (!count?.total) return Response.json({ error: "Сначала добавьте позиции в раскрой" }, { status: 400 });
    await env.DB!.prepare("INSERT INTO order_drawings (order_id, completed_at) VALUES (?, datetime('now')) ON CONFLICT(order_id) DO NOTHING")
      .bind(payload.orderId).run();
    await syncIfShared(payload.orderId);
    await notifyRoles(["1101", "2202", "3303"]);
    return Response.json({ ok: true, estimate: await syncEstimate(payload.orderId) });
  } catch (error) {
    console.error("Completing drawing failed", error);
    return Response.json({ error: "Не удалось завершить чертёж" }, { status: 503 });
  }
}
