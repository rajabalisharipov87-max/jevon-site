import { env } from "cloudflare:workers";
import { getRoleCode } from "../../role-session";
import { allOrders } from "../../current-orders";

type Shortage = {
  id: number; orderId: string; type: string; description: string; thickness: string;
  planned: number; received: number | null; condition: string; note: string; supplySource: string;
  unitPriceCents: number | null; purchaseQuantity: number | null; receivedAt?: string | null;
};

const unauthorized = () => Response.json({ error: "Доступ запрещён" }, { status: 403 });
const neededFor = (row: Pick<Shortage, "condition" | "planned" | "received">) =>
  row.condition === "Повреждено" ? row.planned : Math.max(0, row.planned - (row.received ?? 0));
const derivedNames: Record<string, string> = {
  "Присадка под петли": "Петля",
  "Фрезеровка под петли": "Петля",
  "Присадка под евровинты": "Евровинт",
  "Присадка под эксцентрики": "Эксцентрик",
  "Присадка под шканты": "Шкант",
  "Присадка под полкодержатели": "Полкодержатель",
};
const derivedName = (type: string) => type.startsWith("Кромкование") ? "Кромка"
  : type.startsWith("Распил столешниц ") ? "Столешница"
    : type.startsWith("Распил ЛДСП ") ? "ЛДСП"
      : type.startsWith("Распил МДФ ") ? "МДФ"
        : type === "Распил ХДФ" ? "ХДФ" : derivedNames[type];
const sourceDescription = (row: Shortage) => row.type.startsWith("Кромкование")
  ? `${row.type.replace(/^Кромкование\s*/, "")}${row.description ? ` · ${row.description}` : ""}`
  : row.type.startsWith("Распил столешниц ")
    ? `${row.type.replace(/^Распил столешниц\s*/, "")}${row.description ? ` · ${row.description}` : ""}`
    : /^Распил (ЛДСП|МДФ) /.test(row.type)
      ? `${row.description}${row.description ? " · " : ""}${row.type.replace(/^Распил (ЛДСП|МДФ)\s*/, "").replace("м²", " м²")}`
      : row.description;
const physicalSupply = (type: string) => ["ЛДСП", "МДФ", "ХДФ", "Распил ХДФ", "Мойка", "Ручка", "Петля", "Направляющие", "Труба для вешалки", "Фланец", "Подсветка", "Дроссель", "Соединитель подсветки", "Датчик для подсветки", "Евровинт", "Эксцентрик", "Шкант", "Полкодержатель", "Кромка", "Другая фурнитура"].includes(type)
  || /^Распил (ЛДСП|МДФ|столешниц) /.test(type) || type.startsWith("Кромкование") || Boolean(derivedNames[type]);
const shortage = (row: Shortage) => row.supplySource === "client" && row.receivedAt && neededFor(row) > 0
  && (["ЛДСП", "МДФ", "ХДФ", "Распил ХДФ"].includes(row.type)
    || /^Распил (ЛДСП|МДФ) /.test(row.type) || row.type.startsWith("Кромкование"));

export async function GET(request: Request) {
  if (await getRoleCode(request) !== "3303") return unauthorized();
  try {
    const rows = await env.DB!.prepare(`
      SELECT id, order_id AS orderId, type, description, thickness, planned, received, condition, note,
        supply_source AS supplySource, purchase_unit_price_cents AS unitPriceCents,
        purchase_quantity AS purchaseQuantity, received_at AS receivedAt
      FROM order_materials
      ORDER BY order_id, id
    `).all<Shortage>();
    const orders = await allOrders();
    const orderKinds = new Map(orders.map(order => [order.id, order.kind || "Услуга"]));
    const shopOrders = orders.filter(order => order.kind === "Наш заказ").map(order => order.id);
    const relevant = rows.results.filter(row => physicalSupply(row.type) && orderKinds.has(row.orderId)
      && (orderKinds.get(row.orderId) === "Наш заказ" || row.supplySource === "buy"
        || row.unitPriceCents !== null || shortage(row)));
    const explicit = new Set(relevant.filter(row => !derivedName(row.type))
      .map(row => `${row.orderId}:${row.type}`));
    const items = relevant.filter(row => row.unitPriceCents !== null || !derivedName(row.type)
      || /^Распил (ЛДСП|МДФ|ХДФ)/.test(row.type) ||
      !explicit.has(`${row.orderId}:${derivedName(row.type)}`)).map(row => ({
      id: row.id, orderId: row.orderId, type: derivedName(row.type) || row.type,
      description: sourceDescription(row),
      thickness: row.thickness, needed: orderKinds.get(row.orderId) === "Наш заказ" ? row.planned : row.purchaseQuantity ?? neededFor(row),
      unit: row.type.startsWith("Кромкование") || row.type === "Кромка" ? "п.м." : /^(ЛДСП|МДФ|ХДФ|Распил ЛДСП|Распил МДФ|Распил ХДФ)/.test(row.type) ? "лист" : "шт.", note: row.note,
      supplySource: row.supplySource, unitPriceCents: row.unitPriceCents,
      calculatedFrom: derivedName(row.type) && !/^Распил (ЛДСП|МДФ|ХДФ)/.test(row.type) ? row.type : null,
      orderKind: orderKinds.get(row.orderId),
    })).filter(row => row.needed > 0);
    return Response.json({ items, shopOrders }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Loading procurement list failed", error);
    return Response.json({ error: "Список закупки временно недоступен" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (await getRoleCode(request) !== "3303") return unauthorized();
  try {
    const body = await request.json() as { id?: unknown; price?: unknown };
    const id = body.id;
    const price = String(body.price ?? "").trim().replace(",", ".");
    if (!Number.isSafeInteger(id) || Number(id) <= 0 || !/^(?:\d{1,7})(?:\.\d{1,2})?$/.test(price))
      return Response.json({ error: "Введите цену в сомони, например 12,50" }, { status: 400 });
    const [whole, fraction = ""] = price.split(".");
    const unitPriceCents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    const row = await env.DB!.prepare(`SELECT order_id AS orderId, planned, received, condition, supply_source AS supplySource,
      purchase_quantity AS purchaseQuantity, purchase_unit_price_cents AS unitPriceCents,
      type, received_at AS receivedAt
      FROM order_materials WHERE id = ?`).bind(id).first<Shortage>();
    const order = row && (await allOrders()).find(order => order.id === row.orderId);
    if (!row || !order)
      return Response.json({ error: "Позиция не найдена" }, { status: 404 });
    const shop = order.kind === "Наш заказ";
    const quantity = shop ? row.planned : row.purchaseQuantity ?? neededFor(row);
    if (!physicalSupply(row.type) || quantity <= 0 || (!shop && row.supplySource !== "buy"
      && row.unitPriceCents === null && !shortage(row)))
      return Response.json({ error: "Эта позиция не требует закупки" }, { status: 409 });
    await env.DB!.prepare(`UPDATE order_materials SET purchase_unit_price_cents = ?, purchase_quantity = ? WHERE id = ?`)
      .bind(unitPriceCents, quantity, id).run();
    return Response.json({ id, unitPriceCents, quantity });
  } catch (error) {
    console.error("Saving procurement price failed", error);
    return Response.json({ error: "Не удалось сохранить цену" }, { status: 503 });
  }
}
