import { getRoleCode } from "../../role-session";
import { env } from "cloudflare:workers";

const validOrder = (id: string | null): id is string => !!id && /^\d{2}\/\d{3}$/.test(id);
const validItem = (id: string | null): id is string => !!id && /^[1-9]\d*$/.test(id);

export async function GET(request: Request) {
  if (!await getRoleCode(request)) return new Response("Доступ запрещён",{status:401});
  const params = new URL(request.url).searchParams;
  const orderId = params.get("orderId"), itemId = params.get("itemId");
  if (!validOrder(orderId) || !validItem(itemId)) return new Response("Неверные данные", {status:400});
  try {
    const item = await env.DB!.prepare("SELECT photo_key AS photoKey FROM order_materials WHERE order_id = ? AND id = ?").bind(orderId,itemId).first<{photoKey:string|null}>();
    if (!item?.photoKey) return new Response("Фото пока нет",{status:404});
    const photo = await env.BUCKET!.get(item.photoKey);
    if (!photo) return new Response("Фото пока нет",{status:404});
    return new Response(photo.body,{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch(error) {console.error("Loading defect photo failed",error);return new Response("Фото недоступно",{status:503})}
}

export async function POST(request: Request) {
  if (await getRoleCode(request) !== "2202") return Response.json({error:"Доступ запрещён"},{status:403});
  const orderId = request.headers.get("X-Order-Id"), itemId = request.headers.get("X-Item-Id");
  if (!validOrder(orderId) || !validItem(itemId) || request.headers.get("Content-Type") !== "image/jpeg") return Response.json({error:"Неверные данные фото"},{status:400});
  if (Number(request.headers.get("Content-Length")) > 5_000_000) return Response.json({error:"Фото слишком большое"},{status:413});
  try {
    const item = await env.DB!.prepare("SELECT 1 FROM order_materials WHERE order_id = ? AND id = ? AND EXISTS (SELECT 1 FROM order_drawings WHERE order_id = ?)").bind(orderId,itemId,orderId).first();
    if (!item) return Response.json({error:"Лист не найден"},{status:404});
    const bytes = await request.arrayBuffer(),header=new Uint8Array(bytes,0,Math.min(3,bytes.byteLength));
    if (!bytes.byteLength || bytes.byteLength>5_000_000 || header[0]!==0xff || header[1]!==0xd8 || header[2]!==0xff) return Response.json({error:"Нужно фото JPEG до 5 МБ"},{status:400});
    const photoKey=`material-defects/${orderId.replace("/","-")}/${itemId}/${crypto.randomUUID()}.jpg`;
    await env.BUCKET!.put(photoKey,bytes,{httpMetadata:{contentType:"image/jpeg"}});
    return Response.json({photoKey});
  } catch(error) {console.error("Saving defect photo failed",error);return Response.json({error:"Не удалось сохранить фото"},{status:503})}
}
