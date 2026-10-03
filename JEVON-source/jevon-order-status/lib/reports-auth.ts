import {createHash,randomBytes} from 'node:crypto';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {pool} from '../scripts/postgres-storage.mjs';
export type ReportsUser={id:number;username:string;fullName:string;role:'admin'|'analyst';employeeId:number|null};
export const sessionHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function reportsUser(token?:string):Promise<ReportsUser|null>{
 if(!token||!/^\w{43}$/.test(token.replace(/-/g,'_')))return null;
 const {rows}=await pool.query(`SELECT u.id,u.username,u.full_name AS "fullName",u.role,u.employee_id AS "employeeId" FROM reports_sessions s JOIN reports_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true`,[sessionHash(token)]);
 return rows[0]??null;
}
export function requestToken(request:Request){return request.headers.get('cookie')?.match(/(?:^|;\s*)jevon_reports=([^;]+)/)?.[1];}
export async function requestUser(request:Request){return reportsUser(requestToken(request));}
export async function requireReportsUser(){const user=await reportsUser((await cookies()).get('jevon_reports')?.value);if(!user)redirect('/reports/login');return user;}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(!origin)return true;try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}}
export function cookieValue(token:string,request:Request,maxAge=28800){const secure=process.env.NODE_ENV==='production'||new URL(request.url).protocol==='https:';return `jevon_reports=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure?'; Secure':''}`;}
export async function newSession(userId:number){const token=randomBytes(32).toString('base64url');await pool.query("DELETE FROM reports_sessions WHERE expires_at<=now()");await pool.query("INSERT INTO reports_sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '8 hours')",[sessionHash(token),userId]);return token;}
