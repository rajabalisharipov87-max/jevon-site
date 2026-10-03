import { getRoleCode } from "../../role-session";
import { env } from "cloudflare:workers";
import { syncIfShared } from "../../share-sync";
import { notifyRoles } from "../../push-notifications";
const stages = ["Распил", "Кромка", "Присадка", "Упаковка"];
const validOrder = (id: unknown): id is string => typeof id === "string" && /^\d{2}\/\d{3}$/.test(id);

export async function GET(request: Request) {
  if (!["1101", "2202"].includes(await getRoleCode(request) || "")) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  try {
    const rows = await env.DB!.prepare("SELECT order_id AS orderId, stage, status FROM order_stage_statuses").all<{orderId:string;stage:string;status:string}>();
    const statuses: Record<string, Record<string,string>> = {};
    for (const row of rows.results) (statuses[row.orderId] ||= {})[row.stage] = row.status;
    return Response.json({ statuses }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error("Loading stages failed", error); return Response.json({error:"Статусы недоступны"},{status:503}); }
}

export async function PUT(request: Request) {
  if (await getRoleCode(request) !== "2202") return Response.json({error:"Доступ запрещён"},{status:403});
  try {
    const { orderId, stage, status } = await request.json() as Record<string,unknown>;
    if (!validOrder(orderId) || typeof stage !== "string" || !stages.includes(stage) || typeof status !== "string" || !["В работе", "Готово", "Не требуется"].includes(status)) return Response.json({error:"Неверные данные"},{status:400});
    const drawing = await env.DB!.prepare("SELECT 1 FROM order_drawings WHERE order_id = ?").bind(orderId).first();
    if (!drawing) return Response.json({error:"Чертёж ещё не готов"},{status:409});
    if (stage === "Распил") {
      const receipt = await env.DB!.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN received_at IS NOT NULL THEN 1 ELSE 0 END) AS reviewed, SUM(CASE WHEN (type IN ('ЛДСП', 'МДФ', 'ХДФ') OR type LIKE 'Распил ЛДСП %' OR type LIKE 'Распил МДФ %' OR type = 'Распил ХДФ') AND received_at IS NOT NULL AND received > 0 AND condition != 'Повреждено' THEN 1 ELSE 0 END) AS available_sheets FROM order_materials WHERE order_id = ? AND (type IN ('ЛДСП', 'МДФ', 'ХДФ') OR type LIKE 'Распил ЛДСП %' OR type LIKE 'Распил МДФ %' OR type = 'Распил ХДФ' OR type LIKE 'Кромкование%')")
        .bind(orderId).first<{total:number;reviewed:number|null;available_sheets:number|null}>();
      if (!receipt?.total || receipt.reviewed !== receipt.total || !receipt.available_sheets) {
        return Response.json({error:"Отметьте приёмку всех позиций; для распила нужен хотя бы один пригодный лист"},{status:409});
      }
    }
    const shipped = await env.DB!.prepare("SELECT 1 FROM order_shipments WHERE order_id = ?").bind(orderId).first();
    if (shipped) return Response.json({error:"Заказ уже забрали"},{status:409});
    const rows = await env.DB!.prepare("SELECT stage, status FROM order_stage_statuses WHERE order_id = ?").bind(orderId).all<{stage:string;status:string}>();
    const saved = Object.fromEntries(rows.results.map(row=>[row.stage,row.status]));
    if (!stages.slice(0,stages.indexOf(stage)).every(previous=>["Готово","Не требуется"].includes(saved[previous]))) return Response.json({error:"Сначала завершите предыдущий этап"},{status:409});
    await env.DB!.prepare("INSERT INTO order_stage_statuses (order_id, stage, status) VALUES (?, ?, ?) ON CONFLICT(order_id, stage) DO UPDATE SET status = excluded.status")
      .bind(orderId, stage, status).run();
    await syncIfShared(orderId);
    await notifyRoles(["1101", { "1": "5505", "2": "6606", "3": "7707", "4": "8808" }[orderId[3]] || ""]);
    return Response.json({ok:true});
  } catch(error) { console.error("Saving stage failed",error); return Response.json({error:"Не удалось сохранить статус"},{status:503}); }
}

export async function POST(request: Request) {
  if (await getRoleCode(request) !== "2202") return Response.json({error:"Доступ запрещён"},{status:403});
  try {
    const payload = await request.json() as {orders?:Array<{id:string;statuses:Record<string,string>}>};
    if (!Array.isArray(payload.orders) || payload.orders.length > 200) return Response.json({error:"Неверные данные"},{status:400});
    for (const order of payload.orders) {
      if (!validOrder(order.id) || !order.statuses) continue;
      const drawing = await env.DB!.prepare("SELECT 1 FROM order_drawings WHERE order_id = ?").bind(order.id).first();
      if (!drawing) continue;
      const previous = await env.DB!.prepare("SELECT 1 FROM order_stage_statuses WHERE order_id = ? LIMIT 1").bind(order.id).first();
      if (previous) continue;
      for (const stage of stages) {
        const status = order.statuses[stage];
        if (!["В работе","Готово","Не требуется"].includes(status)) continue;
        await env.DB!.prepare("INSERT INTO order_stage_statuses (order_id, stage, status) VALUES (?, ?, ?) ON CONFLICT(order_id, stage) DO NOTHING").bind(order.id,stage,status).run();
      }
      await syncIfShared(order.id);
    }
    return Response.json({ok:true});
  } catch(error) {console.error("Importing existing stages failed",error);return Response.json({error:"Не удалось перенести этапы"},{status:503})}
}
