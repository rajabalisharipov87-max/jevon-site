export type ServicePrice = { type: string; unit: string; priceCents: number; multiplier: number };
const price = (type: string, unit: string, priceCents: number, multiplier = 1): ServicePrice => ({type, unit, priceCents, multiplier});
export const servicePrices: ServicePrice[] = [
 price('Чертёж Базис Мебельщик','м²',1500),
 ...['Распил ЛДСП 5м²','Распил ЛДСП 6м²','Распил МДФ 3,4м²','Распил МДФ 6м²'].map(t=>price(t,'лист',4000)),
 price('Распил ХДФ','лист',1500),
 price('Распил столешниц 3000х600','шт.',2000),price('Распил столешниц 4000х600','шт.',3000),
 price('Распил столешниц 3000х900','шт.',4000),price('Распил столешниц 4000х900','шт.',4000),
 price('Кромкование 0,8х19','п.м.',250),price('Кромкование 0,8х22','п.м.',250),price('Кромкование 0,8х35','п.м.',500),
 price('Кромкование овальных деталей 0,8х19','п.м.',700),price('Кромкование овальных деталей 0,8х22','п.м.',700),price('Кромкование овальных деталей 0,8х35','п.м.',900),
 price('Фрезеровка под петли','шт.',120),
 price('Присадка под евровинты','сверление',100,2),price('Присадка под эксцентрики','сверление',100,3),price('Присадка под шканты','сверление',100,2),
 price('Зенковка отверстий','шт.',60),price('Присадка под полкодержатели','шт.',60),price('Метки под шурупы','шт.',60),
 ...['Паз под профиль подсветки','Паз под ЛХДФ','Фрезеровка овальных деталей','Фрезеровка неровных деталей','Фрезеровка под Gola профиль','Запил ЛДСП под 45 градусов','Запил МДФ под 45 градусов','Склейка ровных деталей'].map(t=>price(t,'п.м.',500)),
 price('Склейка деталей под 45 градусов','п.м.',1000),price('Упаковка стрейчплёнкой','уп.',500)
];
export const priceAliases: Record<string,string> = {'Присадка под петли':'Фрезеровка под петли','ЛДСП':'Распил ЛДСП 5м²','МДФ':'Распил МДФ 3,4м²','ХДФ':'Распил ХДФ'};
export type EstimatePosition = { id?: number; type: string; description?: string; thickness?: string; planned: number };
export function calculateEstimate(positions: EstimatePosition[], catalog: ServicePrice[]) {
 const rates = new Map(catalog.map(p=>[p.type,p]));
 const rows = positions.flatMap(p=>{
  const rate=rates.get(priceAliases[p.type]||p.type);if(!rate)return [];
  const quantity=Number(p.planned), billableQuantity=quantity*rate.multiplier;
  if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Неверное количество в раскрое');
  return [{...p,quantity,billableQuantity,unit:rate.unit,multiplier:rate.multiplier,priceCents:rate.priceCents,amountCents:Math.round(billableQuantity*rate.priceCents)}];
 });
 const extras=positions.filter(p=>!rates.has(priceAliases[p.type]||p.type)).map(p=>p.type);
 return {rows,totalCents:rows.reduce((sum,r)=>sum+r.amountCents,0),excluded:extras};
}
