import { env } from "cloudflare:workers";

export async function GET(request: Request) {
  const secret=(env as unknown as {BRIDGE_SECRET?:string}).BRIDGE_SECRET;
  if(!secret||request.headers.get("Authorization")!==`Bearer ${secret}`)return new Response("Доступ запрещён",{status:403});
  const token = new URL(request.url).searchParams.get("t");
  if (!token || !/^[a-f0-9]{48}$/.test(token)) return new Response("Ссылка недействительна", { status: 404 });
  try {
    const row = await env.DB!.prepare("SELECT order_id AS orderId FROM order_share_links WHERE token = ?").bind(token).first<{orderId:string}>();
    if (!row) return new Response("Фото не найдено", { status: 404 });
    const stage = await env.DB!.prepare("SELECT status FROM order_stage_statuses WHERE order_id = ? AND stage = 'Упаковка'").bind(row.orderId).first<{status:string}>();
    if (!stage || !["Готово", "Не требуется"].includes(stage.status)) return new Response("Фото ещё не опубликовано", { status: 404 });
    const photo = await env.BUCKET!.get(`packaging/${row.orderId.replace("/", "-")}.jpg`);
    if (!photo) return new Response("Фото не найдено", { status: 404 });
    return new Response(photo.body, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
  } catch (error) {
    console.error("Loading shared packaging photo failed", error);
    return new Response("Фото временно недоступно", { status: 503 });
  }
}
