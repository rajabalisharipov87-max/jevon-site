import {readEstimate} from './estimates';
/** The estimate uses the saved cutting list and the site's price list. */
export async function syncEstimate(orderId:string):Promise<{ok:boolean;message:string}> {
 try {await readEstimate(orderId);return {ok:true,message:'Раскрой сохранён. Смета готова для менеджера.'};}
 catch(error){console.error('Estimate calculation failed',error);return {ok:false,message:'Раскрой сохранён. Смета временно недоступна — откройте карточку повторно.'};}
}
