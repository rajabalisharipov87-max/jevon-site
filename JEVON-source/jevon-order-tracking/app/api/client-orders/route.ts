import {env} from 'cloudflare:workers';
import {clientPhone,normalizePhone,noStore} from '../../client-session';
export async function GET(request:Request){
const phone=await clientPhone(request);if(!phone)return Response.json({error:'Войдите в кабинет'},{status:401,headers:noStore});
const rows=await env.DB!.prepare('SELECT token,payload FROM shared_orders WHERE owner_phone=?').bind(phone).all<{token:string;payload:string}>();
const items=rows.results.flatMap(row=>{try{const {phone:owner,...order}=JSON.parse(row.payload);return normalizePhone(owner)===phone?[{token:row.token,order}]:[]}catch{return[]}});
return Response.json({items},{headers:noStore});
}
