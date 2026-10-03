import { getRoleCode } from "../../role-session";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { orderDeadlines } from "../../../db/schema";
import { syncIfShared } from "../../share-sync";
import { notifyRoles } from "../../push-notifications";

export async function GET(request: Request) {
  const code = await getRoleCode(request);
  if (!code || code === "3303") return Response.json({error:"Доступ запрещён"},{status:403});
  try {
    const rows = await getDb().select().from(orderDeadlines);
    return Response.json({ deadlines: Object.fromEntries(rows.map(row => [row.orderId, row.deadline])) }, {headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    console.error("Loading deadlines failed", error);
    return Response.json({error:"Сроки временно недоступны"},{status:503});
  }
}

export async function PUT(request: Request) {
  // Department codes are a prototype; real user authentication is needed
  // before the service is used outside the trusted workshop team.
  if (await getRoleCode(request) !== "1101") {
    return Response.json({error:"Доступ запрещён"},{status:403});
  }
  try {
    const payload = await request.json() as {id?:unknown;deadline?:unknown};
    if (typeof payload.id !== "string" || !/^\d{2}\/\d{3}$/.test(payload.id) ||
        typeof payload.deadline !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload.deadline) ||
        Number.isNaN(Date.parse(payload.deadline)) || new Date(payload.deadline).toISOString().slice(0,10)!==payload.deadline) {
      return Response.json({error:"Неверный номер заказа или дата"},{status:400});
    }
    await env.DB!.prepare("INSERT INTO order_deadlines (order_id, deadline) VALUES (?, ?) ON CONFLICT(order_id) DO UPDATE SET deadline = excluded.deadline")
      .bind(payload.id,payload.deadline).run();
    await syncIfShared(payload.id);
    await notifyRoles(["2202", { "1": "5505", "2": "6606", "3": "7707", "4": "8808" }[payload.id[3]] || ""]);
    return Response.json({id:payload.id,deadline:payload.deadline});
  } catch(error) {
    console.error("Saving deadline failed", error);
    return Response.json({error:"Не удалось сохранить срок"},{status:503});
  }
}
