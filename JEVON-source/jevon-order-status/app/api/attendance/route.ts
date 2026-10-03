import { createHmac, randomUUID } from 'node:crypto';
import { env } from 'cloudflare:workers';
import { getRoleCode } from '../../role-session';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {code?:unknown;action?:unknown;photoData?:unknown};
    if (typeof body.code !== 'string' || !/^\d{4}$/.test(body.code) || !['IN','OUT'].includes(String(body.action)) || typeof body.photoData !== 'string') return Response.json({ok:false,message:'Проверьте код, действие и фотографию.'},{status:400});
    const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.photoData);
    if (!match || match[2].length > 7_000_000) return Response.json({ok:false,message:'Нужна фотография JPEG/PNG до 5 МБ.'},{status:400});
    const bytes = Buffer.from(match[2],'base64');
    const valid = match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if (!valid) return Response.json({ok:false,message:'Повреждённая фотография.'},{status:400});
    const hash = createHmac('sha256',(env as unknown as {BRIDGE_SECRET:string}).BRIDGE_SECRET).update(body.code).digest('hex');
    // One database transaction keeps the photograph and event together.
    const { transaction } = await import('../../../scripts/postgres-storage.mjs');
    const result = await transaction(async (client: import('pg').PoolClient) => {
      const ip = 'attendance:' + (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[ip]);
      const attempts = await client.query('SELECT attempts,window_start FROM pin_attempts WHERE ip=$1',[ip]);
      const now = Math.floor(Date.now()/1000);
      if(attempts.rows[0]?.attempts>=5 && now-attempts.rows[0].window_start<900) return {status:429,message:'Слишком много неверных кодов. Повторите через 15 минут.'};
      const { rows } = await client.query('SELECT id,name FROM employees WHERE code_hash=$1 AND active=true FOR UPDATE',[hash]);
      const employee = rows[0];
      if (!employee) {
        await client.query('INSERT INTO pin_attempts(ip,attempts,window_start) VALUES ($1,1,$2) ON CONFLICT(ip) DO UPDATE SET attempts=CASE WHEN $2-pin_attempts.window_start>=900 THEN 1 ELSE pin_attempts.attempts+1 END,window_start=CASE WHEN $2-pin_attempts.window_start>=900 THEN $2 ELSE pin_attempts.window_start END',[ip,now]);
        return {status:401,message:'Сотрудник с таким кодом не найден.'};
      }
      await client.query('DELETE FROM pin_attempts WHERE ip=$1',[ip]);
      const last = await client.query('SELECT action FROM attendance_events WHERE employee_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[employee.id]);
      if (last.rows[0]?.action === body.action) return {status:409,message:'Это действие уже зарегистрировано. Выберите приход или уход.'};
      const key = 'attendance/' + randomUUID();
      await client.query('INSERT INTO stored_files(key,data,content_type) VALUES ($1,$2,$3)',[key,bytes,'image/'+match[1]]);
      await client.query('INSERT INTO attendance_events(employee_id,action,photo_key) VALUES ($1,$2,$3)',[employee.id,body.action,key]);
      return {status:200,message:`${employee.name}: ${body.action === 'IN' ? 'приход' : 'уход'} зарегистрирован.`};
    });
    return Response.json({ok:result.status===200,message:result.message},{status:result.status});
  } catch (error) { console.error('Attendance:',error); return Response.json({ok:false,message:'Не удалось сохранить посещаемость.'},{status:503}); }
}
export async function GET(request: Request) {
  if (!['1001','1101'].includes(await getRoleCode(request) ?? '')) return Response.json({error:'Доступ запрещён'},{status:403});
  const { results } = await env.DB!.prepare('SELECT a.id,e.name,e.department,a.action,a.photo_key AS photoKey,a.created_at AS createdAt FROM attendance_events a JOIN employees e ON e.id=a.employee_id ORDER BY a.created_at DESC,a.id DESC LIMIT 500').all();
  return Response.json({events:results},{headers:{'Cache-Control':'no-store'}});
}
