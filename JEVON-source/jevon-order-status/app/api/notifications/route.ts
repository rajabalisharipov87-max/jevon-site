import { env } from "cloudflare:workers";
import { getRoleCode } from "../../role-session";
import { allowedPushHost, ensurePushTable } from "../../push-notifications";

const config = () => env as unknown as { PUSH_PUBLIC_KEY?: string };
export async function GET(request: Request) {
  if (!await getRoleCode(request)) return Response.json({ error: "Войдите в кабинет" }, { status: 403 });
  return Response.json({ publicKey: config().PUSH_PUBLIC_KEY || "" }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const code = await getRoleCode(request);
  if (!code) return Response.json({ error: "Войдите в кабинет" }, { status: 403 });
  let body: { endpoint?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Неверные данные" }, { status: 400 }); }
  if (typeof body.endpoint !== "string" || !allowedPushHost(body.endpoint)) return Response.json({ error: "Неверная подписка браузера" }, { status: 400 });
  try {
    await ensurePushTable();
    await env.DB!.prepare("INSERT INTO push_subscriptions (endpoint, role_code, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(endpoint) DO UPDATE SET role_code = excluded.role_code, updated_at = excluded.updated_at")
      .bind(body.endpoint, code).run();
    return Response.json({ ok: true });
  } catch (error) { console.error("Saving push subscription failed", error); return Response.json({ error: "Не удалось включить уведомления" }, { status: 503 }); }
}

export async function DELETE(request: Request) {
  if (!await getRoleCode(request)) return Response.json({ error: "Войдите в кабинет" }, { status: 403 });
  let body: { endpoint?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Неверные данные" }, { status: 400 }); }
  if (typeof body.endpoint !== "string" || !allowedPushHost(body.endpoint)) return Response.json({ error: "Неверная подписка" }, { status: 400 });
  await ensurePushTable();
  await env.DB!.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(body.endpoint).run();
  return Response.json({ ok: true });
}
