import {NextResponse} from 'next/server';
import {transaction} from '../../../../scripts/postgres-storage.mjs';
import {verifyPassword} from '../../../../scripts/reports-password.mjs';
import {cookieValue,newSession,sameOrigin} from '../../../../lib/reports-auth';
import type {PoolClient} from 'pg';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Недопустимый источник запроса.'},{status:403});
 try{
  const body=await request.json() as {username?:unknown;password?:unknown};
  if(typeof body.username!=='string'||typeof body.password!=='string'||body.username.length>80||body.password.length>128)return NextResponse.json({error:'Неверный логин или пароль.'},{status:401});
  const username=body.username.trim().toLowerCase();
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'local';
  const result=await transaction(async(client:PoolClient)=>{
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['reports-login:'+ip]);
   const tries=await client.query("SELECT attempts FROM reports_login_attempts WHERE ip=$1 AND window_start>now()-interval '15 minutes'",[ip]);
   if(tries.rows[0]?.attempts>=5)return {status:429,id:0};
   const {rows}=await client.query('SELECT id,password_hash,active FROM reports_users WHERE username=$1',[username]);
   const match=await verifyPassword(body.password,rows[0]?.password_hash);
   if(!match||!rows[0]?.active){await client.query("INSERT INTO reports_login_attempts(ip,attempts) VALUES ($1,1) ON CONFLICT(ip) DO UPDATE SET attempts=CASE WHEN reports_login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE reports_login_attempts.attempts+1 END,window_start=CASE WHEN reports_login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE reports_login_attempts.window_start END",[ip]);return {status:401,id:0};}
   await client.query('DELETE FROM reports_login_attempts WHERE ip=$1',[ip]);return {status:200,id:rows[0].id};
  });
  if(result.status!==200)return NextResponse.json({error:result.status===429?'Слишком много попыток. Повторите через 15 минут.':'Неверный логин или пароль.'},{status:result.status,headers:{'Cache-Control':'no-store'}});
  const token=await newSession(result.id);
  return NextResponse.json({ok:true},{headers:{'Set-Cookie':cookieValue(token,request),'Cache-Control':'no-store'}});
 }catch(error){console.error('Reports login:',error);return NextResponse.json({error:'Вход временно недоступен.'},{status:503});}
}
