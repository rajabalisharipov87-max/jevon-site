import { env } from "cloudflare:workers";
import { getRoleCode } from "../../role-session";
import { dashboardData } from "../../dashboard-data";
export async function GET(request: Request){
  const code=await getRoleCode(request);if(!code||code==='3303')return Response.json({error:"Доступ запрещён"},{status:403});
  const {orders,role}=await dashboardData(code),url=new URL(request.url);
  const yearOf=(v:string)=>v.match(/^(\d{4})-/)?.[1]||v.match(/^\d{2}\.\d{2}\.(\d{4})/)?.[1];
  const now=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dushanbe'}).slice(0,4);
  const years=[...new Set([now,...orders.map(o=>yearOf(o.created)).filter(Boolean)])].sort().reverse();
  const year=years.includes(url.searchParams.get('year')||'')?url.searchParams.get('year')!:years[0];
  const month=url.searchParams.get('month')||'all';
  const query="SELECT order_id, SUM(planned) AS area FROM order_materials WHERE type = 'Чертёж Базис Мебельщик'";
  const areas=role.group?await env.DB!.prepare(query+" AND substr(order_id,4,1)=? GROUP BY order_id").bind(role.group).all<any>():await env.DB!.prepare(query+" GROUP BY order_id").all<any>();
  const areaMap=new Map(areas.results.map(row=>[row.order_id,Number(row.area)||0]));
  const monthly=Array.from({length:12},()=>({created:0,finished:0,area:0}));
  const contributors=new Map<string,{name:string;created:number;finished:number;area:number}>();
  const finished:any[]=[];let created=0,shop=0,area=0,finishedCount=0;
  for(const o of orders){
    const m=Number(o.id.slice(0,2))-1;if(yearOf(o.created)!==year||m<0||m>11)continue;
    monthly[m].created++;if(o.drawingCompleted){monthly[m].finished++;monthly[m].area+=areaMap.get(o.id)||0}
    if(month!=='all'&&m!==Number(month))continue;
    created++;if(o.kind==='Наш заказ')shop++;
    const name=o.constructor||o.manager||'Не назначен',row=contributors.get(name)||{name,created:0,finished:0,area:0};row.created++;
    if(o.drawingCompleted){const a=areaMap.get(o.id)||0;finishedCount++;area+=a;row.finished++;row.area+=a;finished.push({id:o.id,product:o.product,constructor:name,completed:o.drawingCompleted,area:areaMap.has(o.id)?a:null})}
    contributors.set(name,row);
  }
  finished.sort((a,b)=>String(b.completed).localeCompare(String(a.completed)));
  const offset=Math.max(0,Math.floor(Number(url.searchParams.get('offset'))||0));
  return Response.json({years,year,month,monthly,kpis:{created,finished:finishedCount,area,shop,service:created-shop},contributors:[...contributors.values()].sort((a,b)=>a.name.localeCompare(b.name)),finished:finished.slice(offset,offset+30),offset,hasMore:offset+30<finished.length},{headers:{'Cache-Control':'private, no-store'}});
}
