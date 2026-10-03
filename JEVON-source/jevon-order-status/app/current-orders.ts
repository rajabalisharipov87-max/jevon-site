import { env } from "cloudflare:workers";
import { catalog } from "./order-catalog";
import { supplement } from "./order-supplement";

export type Order = (typeof catalog)[number] & { phone?: string; kind?: "Наш заказ" | "Услуга" };
export async function allOrders(): Promise<Order[]> {
  const rows = await env.DB!.prepare("SELECT data FROM synced_orders").all<{ data: string }>();
  // Keep the complete imported snapshot visible while the central register syncs.
  const initialStatuses = new Map((process.env.JEVON_LOCAL === '1' ? [] : catalog).map(item => [item.id, item.statuses]));
  const byId = new Map<string, Order>((process.env.JEVON_LOCAL === '1' ? [] : [...catalog, ...supplement]).map(item => [item.id, item as Order]));
  for (const row of rows.results) {
    try {
      const item = JSON.parse(row.data) as Order;
      if (item?.id) {
        if ((item as Order & { deleted?: boolean }).deleted) byId.delete(item.id);
        else byId.set(item.id, { ...item, statuses: initialStatuses.get(item.id) || item.statuses });
      }
    } catch { /* Ignore a malformed stored row. */ }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
}
export async function findOrder(id: string) { return (await allOrders()).find(item => item.id === id); }
