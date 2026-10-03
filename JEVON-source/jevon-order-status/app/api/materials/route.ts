import { readEstimate } from "../../estimates";
import { syncEstimate } from "../../estimate-sync";
import { getRoleCode } from "../../role-session";
import { env } from "cloudflare:workers";
import { notifyRoles } from "../../push-notifications";
import { canEditConstructorOrder } from "../constructor-access";
import { findOrder } from "../../current-orders";
import { syncIfShared } from "../../share-sync";

const validOrder = (id: unknown): id is string => typeof id === "string" && /^\d{2}\/\d{3}$/.test(id);
const validItem = (id: unknown): id is number => Number.isInteger(id) && Number(id) > 0;
const sheetTypes = ["ЛДСП", "МДФ", "ХДФ", "Распил ЛДСП 5м²", "Распил ЛДСП 6м²", "Распил МДФ 3,4м²", "Распил МДФ 6м²", "Распил ХДФ"];
const newSheetTypes = sheetTypes.slice(3);
const thicknessTypes = ["ЛДСП", "МДФ", ...newSheetTypes.filter(type => type !== "Распил ХДФ")];
const hingeTypes = ["Прямой", "Горбатый", "Полугорбатый", "90 градусов"];
const hardwareTypes = ["Мойка", "Ручка", "Направляющие", "Труба для вешалки", "Фланец", "Подсветка", "Дроссель", "Соединитель подсветки", "Датчик для подсветки", "Другая фурнитура"];
const hingeServices = ["Присадка под петли", "Фрезеровка под петли"];
const derivedSupplyServices = [...hingeServices, "Присадка под евровинты", "Присадка под эксцентрики", "Присадка под шканты", "Присадка под полкодержатели"];
const measuredQuantity = (type: string) => type === "Чертёж Базис Мебельщик" || /^(Кромкование|Паз под|Запил|Склейка)/.test(type) || (type.startsWith("Фрезеровка") && !hingeServices.includes(type));
const serviceTypes = [
  "Чертёж Базис Мебельщик", "Распил столешниц 3000х600", "Распил столешниц 4000х600",
  "Распил столешниц 3000х900", "Распил столешниц 4000х900",
  "Кромкование 0,8х19", "Кромкование 0,8х22", "Кромкование 0,8х35",
  "Кромкование овальных деталей 0,8х19", "Кромкование овальных деталей 0,8х22", "Кромкование овальных деталей 0,8х35",
  ...hingeServices, "Присадка под евровинты", "Присадка под эксцентрики", "Присадка под шканты",
  "Зенковка отверстий", "Присадка под полкодержатели", "Метки под шурупы",
  "Паз под профиль подсветки", "Паз под ЛХДФ", "Фрезеровка овальных деталей", "Фрезеровка неровных деталей",
  "Фрезеровка под Gola профиль", "Запил ЛДСП под 45 градусов", "Запил МДФ под 45 градусов",
  "Склейка ровных деталей", "Склейка деталей под 45 градусов", "Упаковка стрейчплёнкой"
];
const jsonError = (message: string, status: number) => Response.json({ error: message }, { status });

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!validOrder(id)) return jsonError("Неверный номер заказа", 400);
  const code = await getRoleCode(request);
  if (code !== "1101" && code !== "2202" && !canEditConstructorOrder(code, id)) return jsonError("Доступ запрещён", 403);
  try {
    const receiptFilter = code === "2202" ? " AND (type IN ('ЛДСП','МДФ','ХДФ') OR type LIKE 'Распил ЛДСП %' OR type LIKE 'Распил МДФ %' OR type = 'Распил ХДФ' OR type LIKE 'Кромкование%')" : "";
    const results = await env.DB!.prepare(`SELECT id, order_id AS orderId, type, description, thickness, planned, supply_source AS supplySource, received, condition, note, received_at AS receivedAt, photo_key AS photoKey FROM order_materials WHERE order_id = ?${receiptFilter} ORDER BY id`).bind(id).all();
    const drawing = await env.DB!.prepare("SELECT completed_at AS completedAt FROM order_drawings WHERE order_id = ?").bind(id).first<{ completedAt: string }>();
    return Response.json({ materials: results.results, drawingReady: !!drawing, completedAt: drawing?.completedAt ?? null, estimate: code === "1101" ? await readEstimate(id) : undefined }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Loading materials failed", error);
    return jsonError("Материалы временно недоступны", 503);
  }
}

export async function POST(request: Request) { return savePosition(request, false); }
export async function PUT(request: Request) { return savePosition(request, true); }

async function savePosition(request: Request, editing: boolean) {
  try {
    const item = await request.json() as Record<string, unknown>;
    if (!canEditConstructorOrder(await getRoleCode(request), item.orderId)) return jsonError("Этот заказ другого конструктора", 403);
    const hardware = hardwareTypes.includes(String(item.type));
    const quantityValid = typeof item.planned === "number" && Number.isFinite(item.planned) && item.planned > 0 && item.planned <= 9999 &&
      (measuredQuantity(String(item.type)) || Number.isInteger(item.planned));
    if (!validOrder(item.orderId) || ![...(editing ? sheetTypes : newSheetTypes), ...serviceTypes, ...hardwareTypes].includes(String(item.type)) ||
        typeof item.description !== "string" || ((hardware || sheetTypes.includes(String(item.type)) || String(item.type).startsWith("Распил столешниц") || String(item.type).startsWith("Кромкование")) && !item.description.trim()) ||
        (hingeServices.includes(String(item.type)) && !hingeTypes.includes(item.description)) ||
        item.description.length > 120 ||
        typeof item.thickness !== "string" || (thicknessTypes.includes(String(item.type)) && !item.thickness.trim()) || item.thickness.length > 30 ||
        !quantityValid) {
      return jsonError("Проверьте позицию, название и количество", 400);
    }
    const order = await findOrder(item.orderId);
    if (!order) return jsonError("Заказ не найден", 404);
    if (await env.DB!.prepare("SELECT 1 FROM order_shipments WHERE order_id = ?").bind(item.orderId).first()) return jsonError("Заказ уже забрали", 409);
    const serviceOrder = order.kind !== "Наш заказ";
    const suppliedByClient = sheetTypes.includes(String(item.type)) || String(item.type).startsWith("Распил столешниц");
    const physical = hardware || suppliedByClient || String(item.type).startsWith("Кромкование") || derivedSupplyServices.includes(String(item.type));
    const supplySource = !physical ? "store" : serviceOrder ? suppliedByClient ? "client" : "store" : "buy";
    const completed = await env.DB!.prepare("SELECT 1 FROM order_drawings WHERE order_id = ?").bind(item.orderId).first();
    const thickness = thicknessTypes.includes(String(item.type)) ? item.thickness.trim() : "";
    if (editing) {
      if (!validItem(item.id)) return jsonError("Неверная позиция", 400);
      const result = await env.DB!.prepare(`UPDATE order_materials SET
        purchase_unit_price_cents = CASE WHEN type = ? AND description = ? AND thickness = ? THEN purchase_unit_price_cents ELSE NULL END,
        purchase_quantity = NULL, type = ?, description = ?, thickness = ?, planned = ?, supply_source = ?
        WHERE id = ? AND order_id = ? AND received_at IS NULL`)
        .bind(item.type, item.description.trim(), thickness, item.type, item.description.trim(), thickness, item.planned, supplySource, item.id, item.orderId).run();
      if (!result.meta.changes) return jsonError("Принятую позицию изменять нельзя. Добавьте новую позицию для дополнения.", 409);
    } else {
      await env.DB!.prepare("INSERT INTO order_materials (order_id, type, description, thickness, planned, supply_source) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(item.orderId, item.type, item.description.trim(), thickness, item.planned, supplySource).run();
    }
    if (completed) { await syncIfShared(item.orderId); await notifyRoles(["1101", "2202", "3303"]); }
    return Response.json({ ok: true, estimate: await syncEstimate(item.orderId) });
  } catch (error) {
    console.error("Adding material failed", error);
    return jsonError("Не удалось сохранить материал", 503);
  }
}

export async function PATCH(request: Request) {
  if (await getRoleCode(request) !== "2202") return jsonError("Доступ запрещён", 403);
  try {
    const item = await request.json() as Record<string, unknown>;
    if (!validOrder(item.orderId) || !validItem(item.id) || typeof item.received !== "number" || !Number.isFinite(item.received) ||
        item.received < 0 || item.received > 9999 ||
        !["Принято", "Есть проблема", "Повреждено"].includes(String(item.condition)) ||
        typeof item.note !== "string" || item.note.length > 500) return jsonError("Проверьте данные приёмки", 400);
    const row = await env.DB!.prepare("SELECT planned, type FROM order_materials WHERE id = ? AND order_id = ? AND EXISTS (SELECT 1 FROM order_drawings WHERE order_id = ?)").bind(item.id, item.orderId, item.orderId).first<{ planned: number; type: string }>();
    if (!row) return jsonError("Материал не найден", 404);
    if (!sheetTypes.includes(row.type) && !row.type.startsWith("Кромкование")) return jsonError("Эта позиция не требует приёмки", 400);
    if (!measuredQuantity(row.type) && !Number.isInteger(item.received)) return jsonError("Для листов укажите целое количество", 400);
    const hasProblem = item.condition !== "Принято" || Number(item.received) !== row.planned;
    if (hasProblem && Number(item.received) !== 0 && !item.note.trim()) return jsonError("Укажите причину расхождения или повреждения", 400);
    let photoKey: string | null = null;
    if (item.condition === "Повреждено") {
      const keyPattern = new RegExp(`^material-defects/${item.orderId.replace("/", "-")}/${item.id}/[a-f0-9-]{36}\\.jpg$`);
      if (typeof item.photoKey !== "string" || !keyPattern.test(item.photoKey) || !await env.BUCKET?.head(item.photoKey)) {
        return jsonError("Сфотографируйте повреждение перед сохранением", 400);
      }
      photoKey = item.photoKey;
    }
    await env.DB!.prepare("UPDATE order_materials SET received = ?, condition = ?, note = ?, photo_key = ?, received_at = datetime('now') WHERE id = ? AND order_id = ?")
      .bind(item.received, item.condition === "Повреждено" ? "Повреждено" : hasProblem ? "Есть проблема" : "Принято", item.note.trim() || (Number(item.received) === 0 ? "Не привезли" : ""), photoKey, item.id, item.orderId).run();
    await syncIfShared(item.orderId);
    if (hasProblem) await notifyRoles(["1101", "3303", { "1": "5505", "2": "6606", "3": "7707", "4": "8808" }[String(item.orderId)[3]] || ""]);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Receiving material failed", error);
    return jsonError("Не удалось записать приёмку", 503);
  }
}

export async function DELETE(request: Request) {
  try {
    const item = await request.json() as Record<string, unknown>;
    if (!canEditConstructorOrder(await getRoleCode(request), item.orderId)) return jsonError("Этот заказ другого конструктора", 403);
    if (!validOrder(item.orderId) || !validItem(item.id)) return jsonError("Неверные данные", 400);
    if (await env.DB!.prepare("SELECT 1 FROM order_shipments WHERE order_id = ?").bind(item.orderId).first()) return jsonError("Заказ уже забрали", 409);
    const result = await env.DB!.prepare(`DELETE FROM order_materials WHERE id = ? AND order_id = ? AND received_at IS NULL
      AND (NOT EXISTS (SELECT 1 FROM order_drawings WHERE order_id = ?) OR (SELECT COUNT(*) FROM order_materials WHERE order_id = ?) > 1)`)
      .bind(item.id, item.orderId, item.orderId, item.orderId).run();
    if (!result.meta.changes) return jsonError("Нельзя удалить принятую или последнюю позицию переданного раскроя", 409);
    await syncIfShared(item.orderId); await notifyRoles(["1101", "2202", "3303"]);
    return Response.json({ ok: true, estimate: await syncEstimate(item.orderId) });
  } catch (error) {
    console.error("Deleting material failed", error);
    return jsonError("Не удалось удалить материал", 503);
  }
}
