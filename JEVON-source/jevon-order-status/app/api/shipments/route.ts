import { getRoleCode } from "../../role-session";
import { env } from "cloudflare:workers";
import { syncIfShared } from "../../share-sync";
import { notifyRoles } from "../../push-notifications";
import { constructorGroup } from "../constructor-access";

const validOrder = (id: unknown): id is string => typeof id === "string" && /^\d{2}\/\d{3}$/.test(id);

export async function GET(request: Request) {
  const code = await getRoleCode(request), group = constructorGroup(code);
  if (!group && !["1101", "2202"].includes(code ?? "")) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  try {
    const rows = group
      ? await env.DB!.prepare("SELECT order_id AS orderId, picked_up_at AS pickedUpAt FROM order_shipments WHERE substr(order_id, 4, 1) = ?").bind(group).all<{ orderId: string; pickedUpAt: string }>()
      : await env.DB!.prepare("SELECT order_id AS orderId, picked_up_at AS pickedUpAt FROM order_shipments").all<{ orderId: string; pickedUpAt: string }>();
    return Response.json({ shipments: Object.fromEntries(rows.results.map(row => [row.orderId, row.pickedUpAt])) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Loading shipments failed", error);
    return Response.json({ error: "Не удалось загрузить выдачу заказов" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (await getRoleCode(request) !== "2202") return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  try {
    const payload = await request.json() as { orderId?: unknown; statuses?: Record<string, string> };
    if (!validOrder(payload.orderId)) return Response.json({ error: "Неверный номер заказа" }, { status: 400 });
    const stages = ["Распил", "Кромка", "Присадка", "Упаковка"];
    if (!payload.statuses || !stages.every(stage => ["Готово", "Не требуется"].includes(payload.statuses?.[stage] ?? ""))) {
      return Response.json({ error: "Сначала завершите все этапы" }, { status: 400 });
    }
    const drawing = await env.DB!.prepare("SELECT 1 FROM order_drawings WHERE order_id = ? AND EXISTS (SELECT 1 FROM order_materials WHERE order_id = ?)")
      .bind(payload.orderId, payload.orderId).first();
    if (!drawing) return Response.json({ error: "Чертёж и список листов не переданы" }, { status: 409 });
    const result = await env.DB!.prepare("INSERT INTO order_shipments (order_id, picked_up_at) VALUES (?, datetime('now')) ON CONFLICT(order_id) DO NOTHING")
      .bind(payload.orderId).run();
    if (!result.meta.changes) return Response.json({ error: "Заказ уже забрали" }, { status: 409 });
    await syncIfShared(payload.orderId);
    await notifyRoles(["1101", { "1": "5505", "2": "6606", "3": "7707", "4": "8808" }[payload.orderId[3]] || ""]);
    const row = await env.DB!.prepare("SELECT picked_up_at AS pickedUpAt FROM order_shipments WHERE order_id = ?").bind(payload.orderId).first<{ pickedUpAt: string }>();
    return Response.json({ pickedUpAt: row?.pickedUpAt });
  } catch (error) {
    console.error("Recording shipment failed", error);
    return Response.json({ error: "Не удалось сохранить выдачу заказа" }, { status: 503 });
  }
}
