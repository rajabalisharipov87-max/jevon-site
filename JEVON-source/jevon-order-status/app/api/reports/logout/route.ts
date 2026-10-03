import {NextResponse} from 'next/server';
import {pool} from '../../../../scripts/postgres-storage.mjs';
import {sameOrigin,requestToken,sessionHash,cookieValue} from '../../../../lib/reports-auth';
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response(null,{status:403});
 const token=requestToken(request);if(token)await pool.query('DELETE FROM reports_sessions WHERE token_hash=$1',[sessionHash(token)]);
 const response=NextResponse.redirect(new URL('/reports/login',request.url),303);response.headers.set('Set-Cookie',cookieValue('',request,0));return response;
}
