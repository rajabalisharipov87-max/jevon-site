import { env } from "cloudflare:workers";

type Incoming = { id?: unknown; client?: unknown; product?: unknown; created?: unknown; materialDate?: unknown; completed?: unknown; shipped?: unknown; constructor?: unknown };
const people: Record<string, string> = { "1": "Далер", "2": "Умед", "3": "Озод", "4": "Анвар" };
const str = (value: unknown, length: number) => typeof value === "string" ? value.trim().slice(0, length) : "";
export async function POST(request: Request) {
  const configured = (env as unknown as { IMPORT_SECRET?: string }).IMPORT_SECRET;
  const supplied = request.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
  if (!configured || supplied.length !== configured.length ||
    [...configured].reduce((diff, char, i) => diff | (char.charCodeAt(0) ^ supplied.charCodeAt(i)), 0) !== 0)
    return Response.json({ error: "Доступ запрещён" }, { status: 401 });
  if (Number(request.headers.get("Content-Length")) > 300_000) return Response.json({ error: "Слишком много данных" }, { status: 413 });
  try {
    const data = await request.json() as { spreadsheetId?: unknown; orders?: unknown };
    if (data.spreadsheetId !== "1lZoqtNusqap7_C7VbHvckOM6Mxt_bTQyheSfh1Ekeao" || !Array.isArray(data.orders) || data.orders.length > 400)
      return Response.json({ error: "Неверный источник" }, { status: 400 });
    const seen = new Set<string>();
    const statements = [];
    for (const raw of data.orders as Incoming[]) {
      const id = str(raw.id, 12), group = id.split("/")[1]?.[0];
      if (!/^\d{2}\/[1-4]\d{2}$/.test(id) || !people[group] || seen.has(id)) continue;
      const client = str(raw.client, 160), product = str(raw.product, 160);
      if (!client || client === "Клиент/телефон" || !product || product === "Мебель") continue;
      seen.add(id);
      const statuses = Object.fromEntries(["Конструктор", "Распил", "Кромка", "Присадка", "Упаковка"].map(s => [s, "Требуется"]));
      const item = { id, client, product, created: str(raw.created, 20), materialDate: str(raw.materialDate, 20), completed: str(raw.completed, 20), shipped: str(raw.shipped, 20), deadline: "Муайян нашудааст", manager: people[group], constructor: people[group], statuses };
      statements.push(env.DB!.prepare("INSERT INTO synced_orders (id, data, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at WHERE json_extract(synced_orders.data, '$.source') IS NOT 'site'").bind(id, JSON.stringify(item)));
    }
    for (let i = 0; i < statements.length; i += 50) await env.DB!.batch(statements.slice(i, i + 50));
    return Response.json({ ok: true, imported: statements.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Import failed", error);
    return Response.json({ error: "Не удалось обновить заказы" }, { status: 503 });
  }
}
