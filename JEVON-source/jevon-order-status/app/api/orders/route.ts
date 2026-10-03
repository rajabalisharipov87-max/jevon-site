function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string" || !/^[+\d\s()-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  if (/^\d{9}$/.test(digits)) return "+992" + digits;
  if (/^(?:992\d{9}|7\d{10})$/.test(digits)) return "+" + digits;
  return null;
}
import { allOrders } from "../../current-orders";
import { getRoleCode, roleFor } from "../../role-session";
import { env } from "cloudflare:workers";
import { syncIfShared,ensureClientOrder } from "../../share-sync";
import { notifyRoles } from "../../push-notifications";

export async function GET(request: Request) {
  const code = await getRoleCode(request);
  if (!code || code === "3303") return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  const role = roleFor(code)!;
  const orders = (await allOrders()).filter(order => !role.group || order.id.split("/")[1]?.[0] === role.group)
    .map(({ id, client, phone, product, created, materialDate, completed, shipped, deadline, manager, constructor, statuses, kind }) =>
      ({ id, client, phone, product, created, materialDate, completed, shipped, deadline, manager, constructor, statuses, kind: kind || "Услуга" }));
  const body = JSON.stringify({ orders });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const etag = '"' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("") + '"';
  const headers = { "Cache-Control": "private, no-cache", "ETag": etag };
  if (request.headers.get("If-None-Match") === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { headers: { ...headers, "Content-Type": "application/json" } });
}

export async function POST(request: Request) {
  const code = await getRoleCode(request);
  const role = code ? roleFor(code) : null;
  if (role?.department !== "Конструктор" || !role.group) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  let body: { id?: unknown; client?: unknown; phone?: unknown; product?: unknown; kind?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Некорректные данные" }, { status: 400 }); }
  const id = String(body.id ?? "").trim();
  if (!new RegExp(`^\\d{2}/${role.group}\\d{2}$`).test(id)) return Response.json({ error: "Введите номер заказа своего конструктора, например 09/100" }, { status: 400 });
  if (typeof body.client !== "string" || typeof body.product !== "string" || !body.client.trim() || !body.product.trim()) return Response.json({ error: "Заполните клиента и изделие" }, { status: 400 });
  if (body.client.trim().length > 120 || body.product.trim().length > 120) return Response.json({ error: "Слишком длинное название" }, { status: 400 });
  const phone = normalizePhone(body.phone);
  if (!phone) return Response.json({ error: "Введите телефон клиента: 9 цифр, +992 и 9 цифр или +7 и 10 цифр" }, { status: 400 });
  const client = body.client.trim();
  const product = body.product.trim();
  if (!["Наш заказ", "Услуга"].includes(String(body.kind))) return Response.json({ error: "Выберите направление заказа" }, { status: 400 });
  if ((await allOrders()).some(order => order.id === id)) return Response.json({ error: "Заказ с таким номером уже существует" }, { status: 409 });
  const order = { id, client, phone, product, kind: body.kind, created: new Date().toLocaleDateString("ru-RU", { timeZone: "Asia/Dushanbe" }), materialDate: "", completed: "", shipped: "", deadline: "", manager: "", constructor: role.name || "", source: "site", statuses: { "Конструктор": "Требуется", "Распил": "Требуется", "Кромка": "Требуется", "Присадка": "Требуется", "Упаковка": "Требуется" } };
  const stored = await env.DB!.prepare("SELECT data FROM synced_orders WHERE id = ?").bind(id).first<{data:string}>();
  let deleted = false;
  try { deleted = !!stored && JSON.parse(stored.data)?.deleted === true; } catch { /* Invalid stored data still reserves the number. */ }
  if (stored && !deleted) return Response.json({ error: "Заказ с таким номером уже существует" }, { status: 409 });
  try {
    if (deleted) {
      // A deleted card leaves a tombstone so imported snapshots cannot recreate it.
      // Remove data attached to the old card before reusing its number.
      await env.BUCKET?.delete(`packaging/${id.replace("/", "-")}.jpg`);
      const changes = await env.DB!.batch([
        ...["order_estimate_changes", "order_materials", "order_drawings", "order_drawing_links", "order_acceptances", "order_deadlines", "order_shipments", "order_stage_statuses", "order_share_links"].map(table => env.DB!.prepare(`DELETE FROM ${table} WHERE order_id = ?`).bind(id)),
        env.DB!.prepare("UPDATE synced_orders SET data = ?, updated_at = ? WHERE id = ? AND data = ?").bind(JSON.stringify(order),new Date().toISOString(),id,stored!.data),
      ]);
      if (changes.at(-1)?.meta.changes !== 1) return Response.json({ error: "Номер заказа уже занят. Обновите страницу." }, { status: 409 });
    } else {
      await env.DB!.prepare("INSERT INTO synced_orders (id, data, updated_at) VALUES (?, ?, ?)").bind(id, JSON.stringify(order), new Date().toISOString()).run();
    }
  } catch (error) {
    console.error("Creating order failed", { id, error });
    return Response.json({ error: "Не удалось сохранить заказ. Повторите попытку." }, { status: 503 });
  }
  await ensureClientOrder(id);
  await notifyRoles(["1101", code!]);
  return Response.json({ order }, { status: 201 });
}

export async function PUT(request: Request) {
  if (await getRoleCode(request) !== "1101") return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  let body: { id?: unknown; client?: unknown; phone?: unknown; product?: unknown; kind?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Некорректные данные" }, { status: 400 }); }
  const id = body.id;
  if (typeof id !== "string" || !/^\d{2}\/\d{3}$/.test(id)) return Response.json({ error: "Номер заказа должен быть в формате 00/000" }, { status: 400 });
  if (typeof body.client !== "string" || typeof body.product !== "string" || !body.client.trim() || !body.product.trim()) return Response.json({ error: "Заполните клиента и изделие" }, { status: 400 });
  if (body.client.trim().length > 120 || body.product.trim().length > 120 || !["Наш заказ", "Услуга"].includes(String(body.kind)))
    return Response.json({ error: "Проверьте поля карточки" }, { status: 400 });
  const existing = (await allOrders()).find(order => order.id === id);
  if (!existing) return Response.json({ error: "Заказ не найден" }, { status: 404 });
  const phone = normalizePhone(body.phone);
  if (!phone) return Response.json({ error: "Введите телефон клиента: 9 цифр, +992 и 9 цифр или +7 и 10 цифр" }, { status: 400 });
  const order = { ...existing, phone, client: body.client.trim(), product: body.product.trim(), kind: body.kind, source: "site" };
  const result = await env.DB!.prepare("INSERT INTO synced_orders (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at")
    .bind(id, JSON.stringify(order), new Date().toISOString()).run();
  if (!result.success) return Response.json({ error: "Не удалось изменить заказ" }, { status: 503 });
  await ensureClientOrder(id);
  await notifyRoles(["2202", "3303", { "1": "5505", "2": "6606", "3": "7707", "4": "8808" }[id[3]] || ""]);
  return Response.json({ order });
}

export async function DELETE(request: Request) {
  if (await getRoleCode(request) !== "1101") return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  let body: { id?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Некорректные данные" }, { status: 400 }); }
  const id = body.id;
  if (typeof id !== "string" || !/^\d{2}\/\d{3}$/.test(id)) return Response.json({ error: "Неверный номер заказа" }, { status: 400 });
  const existing = (await allOrders()).find(order => order.id === id);
  if (!existing) return Response.json({ error: "Заказ не найден" }, { status: 404 });
  // Tombstone prevents older spreadsheet imports and bundled snapshots from recreating the card.
  const tombstone = { id, source: "site", deleted: true };
  const result = await env.DB!.prepare("INSERT INTO synced_orders (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at")
    .bind(id, JSON.stringify(tombstone), new Date().toISOString()).run();
  if (!result.success) return Response.json({ error: "Не удалось удалить заказ" }, { status: 503 });
  return Response.json({ ok: true });
}
