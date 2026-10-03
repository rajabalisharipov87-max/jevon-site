import {env} from 'cloudflare:workers';
import {servicePrices,calculateEstimate,type EstimatePosition} from './service-prices';
export async function readPriceList() {
 const result=await env.DB!.prepare('SELECT type, price_cents AS priceCents FROM service_price_overrides').all<{type:string;priceCents:number}>();
 const overrides=new Map(result.results.map(row=>[row.type,row.priceCents]));
 return servicePrices.map(row=>({...row,priceCents:overrides.get(row.type)??row.priceCents}));
}
export async function readEstimate(orderId:string) {
 const positions=await env.DB!.prepare('SELECT id, type, description, thickness, planned FROM order_materials WHERE order_id = ? ORDER BY id').bind(orderId).all<EstimatePosition>();
 const calculated=calculateEstimate(positions.results,await readPriceList());
 const changes=await env.DB!.prepare('SELECT row_id AS rowId, data FROM order_estimate_changes WHERE order_id = ? ORDER BY row_id').bind(orderId).all<{rowId:string;data:string}>();
 const edits=new Map(changes.results.map(row=>[row.rowId,JSON.parse(row.data) as EstimateChange]));
 const rows=calculated.rows.map(row=>{
 const rowId=`material:${row.id}`,edit=edits.get(rowId);
 return {...row,rowId,...(edit?{description:edit.description,billableQuantity:edit.quantity,quantity:edit.quantity/row.multiplier,priceCents:edit.priceCents,amountCents:Math.round(edit.quantity*edit.priceCents),edited:true}:{})};
 });
 for(const [rowId,edit] of edits)if(rowId.startsWith('manual:'))rows.push({id:undefined,type:edit.type,description:edit.description,thickness:'',planned:edit.quantity,quantity:edit.quantity,billableQuantity:edit.quantity,unit:edit.unit,multiplier:1,priceCents:edit.priceCents,amountCents:Math.round(edit.quantity*edit.priceCents),rowId,edited:true});
 return {...calculated,rows,totalCents:rows.reduce((sum,row)=>sum+row.amountCents,0),orderId};
}

export type EstimateChange = {type:string;description:string;quantity:number;unit:string;priceCents:number};
