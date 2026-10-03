import {env} from 'cloudflare:workers';
import {getRoleCode} from '../../role-session';
import {allOrders} from '../../current-orders';
const headers={'Cache-Control':'private, no-store'};
const normalize=(v:string)=>{const d=v.replace(/\D/g,'');return /^\d{9}$/.test(d)?'992'+d:/^(?:992\d{9}|7\d{10})$/.test(d)?d:null};
async function bridge(method:string,body?:unknown){const secret=(env as unknown as {BRIDGE_SECRET?:string}).BRIDGE_SECRET;if(!secret)throw Error('Missing configuration');return fetch('https://jevon-order-tracking.rajabalisharipov87.chatgpt.site/api/manager-access',{method,headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})}
export async function GET(request:Request){
 if(await getRoleCode(request)!=='1101')return Response.json({error:'Доступ запрещён'},{status:403,headers});
 try{const response=await bridge('GET');if(!response.ok)throw Error('Bridge unavailable');const data=await response.json() as {phones:string[]};const registered=new Set(data.phones);const clients=new Map<string,{phone:string;names:string[];orders:number;registered:boolean}>();
 for(const o of await allOrders()){const phone=normalize(o.phone||'');if(!phone)continue;const row=clients.get(phone)||{phone:'+'+phone,names:[],orders:0,registered:registered.has(phone)};if(o.client&&!row.names.includes(o.client))row.names.push(o.client);row.orders++;clients.set(phone,row)}
 return Response.json({clients:[...clients.values()]},{headers});}catch{return Response.json({error:'Не удалось загрузить доступы клиентов'},{status:503,headers})}
}
export async function POST(request:Request){
 if(await getRoleCode(request)!=='1101')return Response.json({error:'Доступ запрещён'},{status:403,headers});
 if(request.headers.get('Origin')!==new URL(request.url).origin)return Response.json({error:'Недопустимый запрос'},{status:403,headers});
 try{const body=await request.json() as {phone?:string};const phone=normalize(body.phone||'');if(!phone)return Response.json({error:'Некорректный телефон'},{status:400,headers});if(!(await allOrders()).some(o=>normalize(o.phone||'')===phone))return Response.json({error:'Клиент не найден'},{status:404,headers});const response=await bridge('POST',{phone});return Response.json(await response.json(),{status:response.status,headers});}catch{return Response.json({error:'Не удалось выдать новый код'},{status:503,headers})}
}
