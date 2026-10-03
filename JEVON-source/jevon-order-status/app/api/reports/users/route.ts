import {pool} from '../../../../scripts/postgres-storage.mjs';
import {hashPassword} from '../../../../scripts/reports-password.mjs';
import {requestUser,sameOrigin} from '../../../../lib/reports-auth';
export async function GET(request:Request){
 const user=await requestUser(request);if(!user)return Response.json({error:'Требуется вход.'},{status:401});if(user.role!=='admin')return Response.json({error:'Доступ запрещён.'},{status:403});
 const {rows}=await pool.query('SELECT id,username,full_name AS "fullName",role,active,employee_id AS "employeeId",created_at AS "createdAt" FROM reports_users ORDER BY id');
 return Response.json({users:rows},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response(null,{status:403});
 const user=await requestUser(request);if(!user)return Response.json({error:'Требуется вход.'},{status:401});if(user.role!=='admin')return Response.json({error:'Доступ запрещён.'},{status:403});
 try{
  const body=await request.json() as {username?:unknown;fullName?:unknown;password?:unknown;role?:unknown;employeeId?:unknown};
  if(typeof body.username!=='string'||!/^[a-zA-Z0-9_.@-]{3,80}$/.test(body.username)||typeof body.fullName!=='string'||!body.fullName.trim()||body.fullName.length>120||typeof body.password!=='string'||body.password.length<12||body.password.length>128||!['admin','analyst'].includes(String(body.role))||(body.employeeId!=null&&(!Number.isInteger(body.employeeId)||Number(body.employeeId)<=0)))return Response.json({error:'Укажите логин (3–80 символов), имя, роль и пароль (12–128 символов).'},{status:400});
  const passwordHash=await hashPassword(body.password);
  const {rows}=await pool.query('INSERT INTO reports_users(username,full_name,password_hash,role,employee_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(username) DO NOTHING RETURNING id,username,full_name AS "fullName",role,active,employee_id AS "employeeId"',[body.username.toLowerCase(),body.fullName.trim(),passwordHash,body.role,body.employeeId??null]);
  return rows.length?Response.json({user:rows[0]},{status:201}):Response.json({error:'Этот логин уже используется.'},{status:409});
 }catch(error){if((error as {code?:string}).code==='23503')return Response.json({error:'Сотрудник не найден.'},{status:400});console.error('Create report user:',error);return Response.json({error:'Не удалось создать пользователя.'},{status:503});}
}
