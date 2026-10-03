import { env } from "cloudflare:workers";
import { allOrders } from "./current-orders";
import { roleFor } from "./role-session";
export const serviceNames = ["Конструктор", "Распил", "Кромка", "Присадка", "Упаковка"];
export async function dashboardData(code: string) {
  const role = roleFor(code)!;
  const [all, results] = await Promise.all([allOrders(), env.DB!.batch([
    env.DB!.prepare("SELECT order_id, completed_at FROM order_drawings"),
    env.DB!.prepare("SELECT order_id, picked_up_at FROM order_shipments"),
    env.DB!.prepare("SELECT order_id, deadline FROM order_deadlines"),
    env.DB!.prepare("SELECT order_id, stage, status FROM order_stage_statuses"),
    env.DB!.prepare("SELECT order_id FROM order_acceptances"),
  ])]);
  const map = (index: number, key: string) => new Map((results[index].results as Record<string,any>[]).map(row => [row.order_id, row[key]]));
  const drawings = map(0,"completed_at"), shipments = map(1,"picked_up_at"), deadlines = map(2,"deadline");
  const stages = new Map<string,Record<string,string>>();
  for (const row of results[3].results as any[]) { const values=stages.get(row.order_id)||{};values[row.stage]=row.status;stages.set(row.order_id,values); }
  const accepted = new Set((results[4].results as any[]).map(row=>row.order_id));
  const orders=all.filter(o=>!role.group||o.id[3]===role.group).map(o=>({...o,statuses:{...o.statuses,...stages.get(o.id)},drawingCompleted:drawings.get(o.id)||null,pickedUpAt:shipments.get(o.id)||null,projectDeadline:deadlines.get(o.id)||null,accepted:accepted.has(o.id)}));
  return { role, orders };
}
export function ready(order: Awaited<ReturnType<typeof dashboardData>>['orders'][number]) {
  return !!order.drawingCompleted && serviceNames.slice(1).every(name=>["Готово","Не требуется"].includes((order.statuses as Record<string,string>)[name]));
}
