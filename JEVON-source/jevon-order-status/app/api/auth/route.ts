import { env } from "cloudflare:workers";
import { getRoleCode, makeSession, roleFor } from "../../role-session";

export async function GET(request: Request) {
  const code = await getRoleCode(request);
  if (!code) return Response.json({ error: "Сессия истекла" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return Response.json(roleFor(code), { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  try {
    const db = env.DB!;
    await db.prepare("CREATE TABLE IF NOT EXISTS pin_attempts (ip TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start INTEGER NOT NULL)").run();
    const now = Math.floor(Date.now() / 1000);
    const attempt = await db.prepare("SELECT attempts, window_start FROM pin_attempts WHERE ip = ?").bind(ip).first<{ attempts: number; window_start: number }>();
    if (attempt && now - attempt.window_start < 900 && attempt.attempts >= 5) return Response.json({ error: "Слишком много попыток. Повторите через 15 минут." }, { status: 429 });
    const body = await request.json() as { pin?: unknown };
    const code = typeof body.pin === "string" && /^\d{4}$/.test(body.pin) ? body.pin : "";
    const role = roleFor(code);
    if (!role) {
      await db.prepare("INSERT INTO pin_attempts (ip, attempts, window_start) VALUES (?, 1, ?) ON CONFLICT(ip) DO UPDATE SET attempts = CASE WHEN ? - window_start >= 900 THEN 1 ELSE attempts + 1 END, window_start = CASE WHEN ? - window_start >= 900 THEN ? ELSE window_start END").bind(ip, now, now, now, now).run();
      return Response.json({ error: "Неверный код" }, { status: 401 });
    }
    await db.prepare("DELETE FROM pin_attempts WHERE ip = ?").bind(ip).run();
    return Response.json(role, { headers: { "Set-Cookie": `jevon_role=${await makeSession(code)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("PIN login failed", error);
    return Response.json({ error: "Вход временно недоступен" }, { status: 503 });
  }
}
export async function DELETE() {
  return new Response(null, { status: 204, headers: { "Set-Cookie": "jevon_role=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" } });
}
