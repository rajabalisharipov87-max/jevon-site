import { env } from "cloudflare:workers";
import { findOrder } from "./current-orders";

const stages = ["Конструктор", "Распил", "Кромка", "Присадка", "Упаковка"];
const production = stages.slice(1);
const config = env as unknown as { TRACKING_ORIGIN?: string; BRIDGE_SECRET?: string; DB: D1Database; BUCKET?: R2Bucket };

export async function syncSharedOrder(orderId: string, tokenOverride?: string) {
  const link = tokenOverride || (await config.DB.prepare("SELECT token FROM order_share_links WHERE order_id = ?").bind(orderId).first<{token:string}>())?.token;
  if (!link) return;
  const item = await findOrder(orderId);
  if (!item || !config.TRACKING_ORIGIN || !config.BRIDGE_SECRET) throw new Error("Сервис ссылок не настроен");
  const [stageRows, drawing, shipment, deadline, materials, drawingLink, acceptance] = await Promise.all([
    config.DB.prepare("SELECT stage, status FROM order_stage_statuses WHERE order_id = ?").bind(orderId).all<{stage:string;status:string}>(),
    config.DB.prepare("SELECT 1 FROM order_drawings WHERE order_id = ?").bind(orderId).first(),
    config.DB.prepare("SELECT 1 FROM order_shipments WHERE order_id = ?").bind(orderId).first(),
    config.DB.prepare("SELECT deadline FROM order_deadlines WHERE order_id = ?").bind(orderId).first<{deadline:string}>(),
    config.DB.prepare("SELECT type, received_at AS receivedAt FROM order_materials WHERE order_id = ? AND (type IN ('ЛДСП','МДФ','ХДФ') OR type LIKE 'Распил ЛДСП %' OR type LIKE 'Распил МДФ %' OR type = 'Распил ХДФ' OR type LIKE 'Кромкование%')").bind(orderId).all<{type:string;receivedAt:string|null}>(),
    config.DB.prepare("SELECT url FROM order_drawing_links WHERE order_id = ?").bind(orderId).first<{url:string}>(),
    config.DB.prepare("SELECT 1 FROM order_acceptances WHERE order_id = ?").bind(orderId).first(),
  ]);
  const overrides = Object.fromEntries(stageRows.results.map(row => [row.stage, row.status]));
  const statuses = Object.fromEntries(stages.map(stage => [stage, stage === "Конструктор" ? (drawing ? "Готово" : acceptance ? "В работе" : "Требуется") : overrides[stage] || (item.statuses as Record<string,string>)[stage] || "Требуется"]));
  const required = stages.filter(stage => statuses[stage] !== "Не требуется");
  const progress = Math.round(100 * required.filter(stage => statuses[stage] === "Готово").length / required.length);
  const ready = production.every(stage => ["Готово", "Не требуется"].includes(statuses[stage])) && !!drawing;
  const status = shipment ? "Заказ забрали" : ready ? "Готов к выдаче" : drawing || acceptance || production.some(stage => ["Готово", "В работе"].includes(statuses[stage])) ? "В работе" : "В очереди";
  const receiptStatus = drawing && materials.results.length ? materials.results.every(row => !!row.receivedAt) ? "Листы приняты" : "Ждём приёмку листов для заказа" : null;
  const photoAvailable = ["Готово", "Не требуется"].includes(statuses["Упаковка"]) && !!await config.BUCKET?.head(`packaging/${orderId.replace("/", "-")}.jpg`);
  const order = { phone: item.phone || null, id: item.id, product: item.product, deadline: deadline?.deadline || null, status, progress, receiptStatus, drawingUrl: drawingLink?.url || null, photoAvailable, stages: stages.map(name => ({ name, status: statuses[name] })) };
  const response = await fetch(`${config.TRACKING_ORIGIN}/api/order`, {
    method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.BRIDGE_SECRET}` },
    body: JSON.stringify({ token: link, order }),
  });
  if (!response.ok) throw new Error(`Публичный статус недоступен: ${response.status}`);
}

export async function syncIfShared(orderId: string) {
  try { await syncSharedOrder(orderId); } catch (error) { console.error("Tracking sync failed", { orderId, error }); }
}

export async function ensureClientOrder(orderId:string){
  try{
    const item=await findOrder(orderId);if(!item?.phone)return;
    const token=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
    await config.DB.prepare('INSERT INTO order_share_links (order_id,token) VALUES (?,?) ON CONFLICT(order_id) DO NOTHING').bind(orderId,token).run();
    await syncSharedOrder(orderId);
  }catch(error){console.error('Client order sync failed',{orderId,error})}
}
