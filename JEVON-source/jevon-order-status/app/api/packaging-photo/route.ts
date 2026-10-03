import { getRoleCode } from "../../role-session";
import { env } from "cloudflare:workers";

const validId = (id: string | null): id is string => !!id && /^\d{2}\/\d{3}$/.test(id);
const keyFor = (id: string) => `packaging/${id.replace("/", "-")}.jpg`;

export async function GET(request: Request) {
  const code = await getRoleCode(request);
  if (!code || code === "3303") return new Response("Доступ запрещён",{status:403});
  const id = new URL(request.url).searchParams.get("id");
  if (!validId(id)) return new Response("Неверный номер заказа", { status: 400 });
  try {
    if (!env.BUCKET) throw new Error("R2 bucket unavailable");
    if (new URL(request.url).searchParams.get("metadata") === "1") return Response.json({ available: !!await env.BUCKET.head(keyFor(id)) }, { headers: { "Cache-Control": "private, no-store" } });
    const photo = await env.BUCKET.get(keyFor(id));
    if (!photo) return new Response("Фото пока нет", { status: 404 });
    return new Response(photo.body, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("Loading packaging photo failed", error);
    return new Response("Фото временно недоступно", { status: 503 });
  }
}

export async function POST(request: Request) {
  // Department codes belong to the existing prototype access flow.
  if (await getRoleCode(request) !== "2202") return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  const id = request.headers.get("X-Order-Id");
  if (!validId(id) || request.headers.get("Content-Type") !== "image/jpeg") return Response.json({ error: "Неверные данные" }, { status: 400 });
  if (Number(request.headers.get("Content-Length")) > 5_000_000) return Response.json({ error: "Фото слишком большое" }, { status: 413 });
  try {
    if (!env.BUCKET) throw new Error("R2 bucket unavailable");
    const bytes = await request.arrayBuffer();
    const header = new Uint8Array(bytes, 0, Math.min(3, bytes.byteLength));
    if (!bytes.byteLength || bytes.byteLength > 5_000_000 || header[0] !== 0xff || header[1] !== 0xd8 || header[2] !== 0xff) {
      return Response.json({ error: "Нужно фото в формате JPEG до 5 МБ" }, { status: 400 });
    }
    await env.BUCKET.put(keyFor(id), bytes, { httpMetadata: { contentType: "image/jpeg" } });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Saving packaging photo failed", error);
    return Response.json({ error: "Не удалось сохранить фото" }, { status: 503 });
  }
}
