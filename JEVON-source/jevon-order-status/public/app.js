let accessClients=[],accessBusy=false;
const services=["Конструктор","Распил","Кромка","Присадка","Упаковка"];
const sheetTypes=["ЛДСП","МДФ","ХДФ","Распил ЛДСП 5м²","Распил ЛДСП 6м²","Распил МДФ 3,4м²","Распил МДФ 6м²","Распил ХДФ"];
const isReceivable=item=>sheetTypes.includes(item.type)||item.type.startsWith('Кромкование');
const thicknessTypes=["ЛДСП","МДФ","Распил ЛДСП 5м²","Распил ЛДСП 6м²","Распил МДФ 3,4м²","Распил МДФ 6м²"];
const cuttingOptions=[
  ["Чертёж Базис Мебельщик","м²"],
  ["Распил ЛДСП 5м²","лист"],["Распил ЛДСП 6м²","лист"],["Распил МДФ 3,4м²","лист"],["Распил МДФ 6м²","лист"],
  ["Распил ХДФ","лист"],["Распил столешниц 3000х600","шт."],["Распил столешниц 4000х600","шт."],
  ["Распил столешниц 3000х900","шт."],["Распил столешниц 4000х900","шт."],
  ["Кромкование 0,8х19","п.м."],["Кромкование 0,8х22","п.м."],["Кромкование 0,8х35","п.м."],
  ["Кромкование овальных деталей 0,8х19","п.м."],["Кромкование овальных деталей 0,8х22","п.м."],["Кромкование овальных деталей 0,8х35","п.м."],
  ["Фрезеровка под петли","шт."],["Присадка под евровинты","шт."],["Присадка под эксцентрики","шт."],
  ["Присадка под шканты","шт."],["Зенковка отверстий","шт."],["Присадка под полкодержатели","шт."],
  ["Метки под шурупы","шт."],["Паз под профиль подсветки","п.м."],["Паз под ЛХДФ","п.м."],
  ["Фрезеровка овальных деталей","п.м."],["Фрезеровка неровных деталей","п.м."],["Фрезеровка под Gola профиль","п.м."],
  ["Запил ЛДСП под 45 градусов","п.м."],["Запил МДФ под 45 градусов","п.м."],["Склейка ровных деталей","п.м."],
  ["Склейка деталей под 45 градусов","п.м."],["Упаковка стрейчплёнкой","уп."]
];
const cuttingUnits={"ЛДСП":"лист","МДФ":"лист","ХДФ":"лист",...Object.fromEntries(cuttingOptions)};
const measuredQuantity=type=>type==="Чертёж Базис Мебельщик"||/^(Кромкование|Паз под|Запил|Склейка)/.test(type)||(type.startsWith("Фрезеровка")&&!hingeServices.includes(type));
const hardwareOptions=["Мойка","Ручка","Направляющие","Труба для вешалки","Фланец","Подсветка","Дроссель","Соединитель подсветки","Датчик для подсветки","Другая фурнитура"];
const hingeServices=["Присадка под петли","Фрезеровка под петли"];
const derivedSupplyNames={"Присадка под петли":"Петля","Фрезеровка под петли":"Петля","Присадка под евровинты":"Евровинт","Присадка под эксцентрики":"Эксцентрик","Присадка под шканты":"Шкант","Присадка под полкодержатели":"Полкодержатель"};
const derivedSupplyService=type=>Boolean(derivedSupplyNames[type])||type.startsWith('Кромкование');
const roleServices={
  "Менеджер":[],
  "Конструктор":["Конструктор"],
  "Производство":["Распил","Кромка","Присадка","Упаковка"]
};
const dataVersion="raspil-2026-09-v1";
let importedOrders=[];
let orderEtag="",refreshBusy=false,procurementBusy=false,procurementDenied=false,orderLimit=30;
let orders=[];
let activeOrder=null;
function findVisibleOrder(id){return orders.find(o=>o.id===id)||(activeOrder?.id===id?activeOrder:null)}
let pageCounts={active:0,ready:0,shipped:0},pageHasMore=false,pageBusy=false,pageRequest=0,pageAbort=null,pageEtags=new Map(),pageOffset=0;
let statsData=null,statsRequest=0,statsOffset=0,statsBusy=false;
let accepted=JSON.parse(localStorage.getItem(`jevon_accepted_${dataVersion}`)||"{}");
let pin="",department=null,constructorCode=null,constructorGroup=null,constructorName=null,roleCode=null,filter="active",selectedId=null,loggingIn=false;
let deadlines={};
let drawings={};
let drawingAreas={};
let shipments={};
let procurementItems=[];
let shopOrders=[];
let pendingProcurementRender=false;
const openInvoices=new Set();
let draftVisible=false,draftSaving=false;
let mobilePage='orders';
const materialsReady={};
const editingCuttings=new Set();
const defectPhotos=new Map();
const missingPackagingPhotos=new Set();
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const loginView=$("#loginView"),dashboardView=$("#dashboardView"),pinDots=$$("#pinDots i"),error=$("#loginError");
$$('[data-key]').forEach(btn=>btn.addEventListener('click',()=>keyPress(btn.dataset.key)));
function keyPress(key){
  error.textContent="";
  if(key==="clear") pin=""; else if(key==="back") pin=pin.slice(0,-1); else if(pin.length<4) pin+=key;
  pinDots.forEach((d,i)=>d.classList.toggle("filled",i<pin.length));
  if(pin.length===4) setTimeout(login,120);
}
async function login(){
  if(loggingIn)return;
  loggingIn=true;
  try{
    const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})});
    const auth=await response.json();
    if(!response.ok)throw new Error(auth.error||'Ошибка входа');
    await enterDashboard(auth);
  }catch(e){error.textContent=e.message;pin="";department=null;$("#sessionLoading").classList.add("hidden");loginView.classList.remove("hidden");pinDots.forEach(d=>d.classList.remove("filled"))}
  finally{loggingIn=false}
}
async function enterDashboard(auth){
    if(auth.department==='Начальник цеха'){window.top.location.replace('/chief');return}
    activeOrder=null;orders=[];importedOrders=[];pageEtags.clear();statsData=null;pageRequest++;statsRequest++;pageBusy=false;statsBusy=false;pageAbort?.abort();orderEtag="";orderLimit=30;procurementDenied=false;roleCode=null;constructorCode=auth.group?auth.group:null;constructorGroup=auth.group||null;constructorName=auth.name||null;department=auth.department;pin="";filter="active";
    $("#deptName").textContent=constructorCode?`Конструктор · ${constructorName}`:department;
    $("#sessionLoading").classList.add("hidden");loginView.classList.add("hidden");dashboardView.classList.remove("hidden");
    $('#orderWorkspace').classList.toggle('hidden',department==='Снабжение');
    $('#procurementView').classList.toggle('hidden',department!=='Снабжение');
    $('#addOrderButton').classList.toggle('hidden',department!=="Конструктор");
    mobilePage='orders';showMobilePage();
    syncExistingNotifications();
    if(department==='Снабжение')loadProcurement();
    else{await loadOrderPage()}
}
async function restoreSession(){
  try{
    const response=await fetch('/api/auth',{cache:'no-store'});
    if(response.ok){await enterDashboard(await response.json());return}
  }catch(e){department=null;console.warn('Session restore failed',e)}
  $("#sessionLoading").classList.add("hidden");loginView.classList.remove("hidden");
}
const notificationButton=$('#notificationBtn');
const supportsNotifications=()=>('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window)&&window.isSecureContext;
function setNotificationButton(on){notificationButton.classList.toggle('notifications-on',on);notificationButton.setAttribute('aria-label',on?'Отключить уведомления':'Включить уведомления');notificationButton.title=on?'Уведомления включены':'Включить уведомления';updateSettings()}
function updateSettings(){$('#clientAccessPanel').classList.toggle('hidden',department!=='Менеджер');if(department!=='Менеджер'){$('#clientAccessPanel').open=false;$('#clientAccessList').replaceChildren();accessClients=[]}const button=$('#settingsNotifications');button.textContent=notificationButton.classList.contains('notifications-on')?'Отключить':'Включить';button.disabled=notificationButton.classList.contains('hidden');$('#settingsDepartment').textContent=$('#deptName').textContent}
function showMobilePage(){
  $('#orderWorkspace').classList.toggle('hidden',mobilePage!=='orders'||department==='Снабжение');
  $('#procurementView').classList.toggle('hidden',mobilePage!=='orders'||department!=='Снабжение');
  $('#mobileStats').classList.toggle('hidden',mobilePage!=='stats');
  $('#mobileSettings').classList.toggle('hidden',mobilePage!=='settings');
  $$('#mobileNav button').forEach(button=>{const active=button.dataset.page===mobilePage;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')});
  if(mobilePage==='stats')renderMobileStats();if(mobilePage==='settings')updateSettings();
}
$$('#mobileNav button').forEach(button=>button.onclick=()=>{mobilePage=button.dataset.page;showMobilePage();window.scrollTo({top:0,behavior:'instant'})});
$('#settingsNotifications').onclick=()=>notificationButton.click();
$('#settingsLogout').onclick=()=>$('#logoutBtn').click();
const decodePushKey=key=>{const padded=key.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(padded),char=>char.charCodeAt(0))};
async function currentPushSubscription(){const registration=await navigator.serviceWorker.getRegistration('/');return registration?.pushManager.getSubscription()}
async function syncExistingNotifications(){
  if(!supportsNotifications()){notificationButton.classList.add('hidden');updateSettings();return}
  try{const subscription=await currentPushSubscription();setNotificationButton(Boolean(subscription));if(subscription){await fetch('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})})}}
  catch(error){console.warn('Notification sync failed',error)}
}
notificationButton.onclick=async()=>{
  if(!supportsNotifications()){showToast('Этот браузер не поддерживает уведомления');return}
  notificationButton.disabled=true;
  try{
    const existing=await currentPushSubscription();
    if(existing){const response=await fetch('/api/notifications',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:existing.endpoint})});if(!response.ok)throw new Error('Не удалось отключить уведомления');await existing.unsubscribe();setNotificationButton(false);showToast('Уведомления выключены');return}
    const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Разрешите уведомления в настройках браузера');
    const keyResponse=await fetch('/api/notifications',{cache:'no-store'});if(!keyResponse.ok)throw new Error('Не удалось подключить уведомления');
    const {publicKey}=await keyResponse.json();if(!publicKey)throw new Error('Уведомления ещё не настроены');
    const registration=await navigator.serviceWorker.register('/notification-sw.js',{scope:'/'});
    const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodePushKey(publicKey)});
    const response=await fetch('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})});
    if(!response.ok){await subscription.unsubscribe();throw new Error('Не удалось сохранить подписку')}
    setNotificationButton(true);showToast('Уведомления включены');
  }catch(error){showToast(error.message||'Не удалось включить уведомления')}
  finally{notificationButton.disabled=false}
};
$("#logoutBtn").onclick=async()=>{try{const subscription=supportsNotifications()&&await currentPushSubscription();if(subscription){await fetch('/api/notifications',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})});await subscription.unsubscribe()}}catch(error){console.warn('Notification logout failed',error)}await fetch('/api/auth',{method:'DELETE'});setNotificationButton(false);department=null;constructorCode=null;constructorGroup=null;constructorName=null;roleCode=null;orders=[];importedOrders=[];procurementItems=[];shopOrders=[];openInvoices.clear();selectedId=null;draftVisible=false;$('#draftOrder').innerHTML='';dashboardView.classList.add("hidden");loginView.classList.remove("hidden");pinDots.forEach(d=>d.classList.remove("filled"))};
async function refreshDashboard(){
  if(!department||document.hidden||refreshBusy||orders.length>30||draftVisible||$('#orderSheet').classList.contains('open'))return;
  refreshBusy=true;
  try{
    if(department==='Снабжение'){await loadProcurement();return}
    await loadOrderPage();
    if(mobilePage==='stats')await loadStatistics();
  }catch(e){console.warn('Order refresh failed',e)}
  finally{refreshBusy=false}
}
setInterval(refreshDashboard,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDashboard()});
let searchTimer;$("#searchInput").addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{orderLimit=30;render()},250)});
$('#procurementSearch').addEventListener('input',renderProcurement);
function procurementEditing(){return $('#procurementList').contains(document.activeElement)||$$('#procurementList input').some(input=>input.value!==input.defaultValue)}
async function loadProcurement(){
  if(department!=="Снабжение"||procurementBusy||procurementDenied)return;
  procurementBusy=true;
  try{
    const response=await fetch('/api/procurement',{cache:'no-store'});
    if(response.status===403){procurementDenied=true;const auth=await fetch('/api/auth',{cache:'no-store'});if(auth.ok){const session=await auth.json();if(session.department!==department){await enterDashboard(session);return}}throw new Error('Войдите снова в кабинет снабжения')}
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Не удалось загрузить список');
    if(department!=='Снабжение')return;
    const nextItems=result.items||[],nextOrders=result.shopOrders||[];
    if(JSON.stringify(procurementItems)===JSON.stringify(nextItems)&&JSON.stringify(shopOrders)===JSON.stringify(nextOrders)){
      if(pendingProcurementRender&&!procurementEditing()){pendingProcurementRender=false;renderProcurement()}
      return;
    }
    procurementItems=nextItems;shopOrders=nextOrders;
    if(procurementEditing()){pendingProcurementRender=true;return}
    pendingProcurementRender=false;renderProcurement();
  }catch(e){if(department==='Снабжение'&&!procurementItems.length)$('#procurementList').innerHTML=`<div class="empty"><strong>Список недоступен</strong>${escapeHTML(e.message)}</div>`}
  finally{procurementBusy=false}
}
function renderProcurement(){
  if(department!=='Снабжение')return;
  const q=$('#procurementSearch').value.trim().toLowerCase();
  const rows=procurementItems.filter(item=>!q||[item.orderId,item.type,item.description].some(value=>String(value).toLowerCase().includes(q)));
  const groups=new Map();for(const id of shopOrders){if(!q||id.toLowerCase().includes(q))groups.set(id,[])}for(const row of rows){if(!groups.has(row.orderId))groups.set(row.orderId,[]);groups.get(row.orderId).push(row)}
  $('#procurementCount').textContent=`${groups.size} заказов`;
  if(mobilePage==='stats')renderMobileStats();
  $('#procurementList').innerHTML=groups.size?[...groups].map(([orderId,items])=>{
    const pricedItems=items.filter(item=>item.unitPriceCents!==null),total=pricedItems.reduce((sum,item)=>sum+item.needed*item.unitPriceCents,0);
    const shop=shopOrders.includes(orderId);
    return `<details class="invoice" data-order-id="${escapeHTML(orderId)}" ${openInvoices.has(orderId)?'open':''}>
    <summary class="invoice-top"><div><small>${shop?'НАКЛАДНАЯ МАТЕРИАЛОВ':'НАКЛАДНАЯ НА ЗАКУПКУ'}</small><h2>Заказ ${escapeHTML(orderId)}</h2></div><span>${items.length} поз. <i class="invoice-chevron" aria-hidden="true">⌄</i></span></summary>
    ${items.length?`<div class="invoice-scroll"><table><thead><tr><th scope="col">№</th><th scope="col">Наименование</th><th scope="col">${shop?'Расход':'Купить'}</th><th scope="col">Цена, с</th><th scope="col">Сумма, с</th></tr></thead><tbody>
    ${items.map((item,index)=>`<tr><td>${index+1}</td><td><strong>${escapeHTML(item.type)}</strong>${item.description?`<small>${escapeHTML(item.description)}</small>`:''}${item.calculatedFrom?`<small>По услуге: ${escapeHTML(item.calculatedFrom)}</small>`:''}${item.thickness?`<small>Толщина: ${escapeHTML(item.thickness)}</small>`:''}${item.note&&item.note!=='Не привезли'?`<small>${escapeHTML(item.note)}</small>`:''}</td><td><strong>${item.needed}</strong><small>${escapeHTML(item.unit)}</small></td><td><form class="price-form" data-id="${item.id}"><input type="number" min="0" max="9999999" step="0.01" inputmode="decimal" name="price" aria-label="Цена за единицу: ${escapeHTML(item.type)}" placeholder="0,00" value="${item.unitPriceCents===null?'':(item.unitPriceCents/100).toFixed(2)}" required><button type="submit" aria-label="Сохранить цену ${escapeHTML(item.type)}" title="Сохранить цену">✓</button></form><span class="print-price">${item.unitPriceCents===null?'—':money(item.unitPriceCents)}</span></td><td class="invoice-amount">${item.unitPriceCents===null?'—':money(item.needed*item.unitPriceCents)}</td></tr>`).join('')}
    </tbody></table></div><div class="invoice-total"><span>${pricedItems.length===items.length?'Итого расходов':'Итого по введённым ценам'}<small>${pricedItems.length} из ${items.length} позиций с ценой</small></span><strong>${money(total)} с</strong></div>`:'<p class="invoice-empty">Конструктор ещё не добавил материалы в этот заказ.</p>'}<div class="invoice-print-bar"><button type="button" class="invoice-print secondary">🖨 Печать накладной</button></div><p class="invoice-error error" role="alert" aria-live="polite"></p></details>`;
  }).join(''):`<div class="empty"><strong>Покупок пока нет</strong>${q?'Измените запрос.':'Позиции для покупки появятся после заполнения конструктором.'}</div>`;
  $$('#procurementList .invoice').forEach(card=>card.addEventListener('toggle',()=>{if(card.open)openInvoices.add(card.dataset.orderId);else openInvoices.delete(card.dataset.orderId)}));
  $$('#procurementList .price-form').forEach(form=>form.onsubmit=saveProcurementPrice);
  $$('#procurementList .invoice-print').forEach(button=>button.onclick=()=>printInvoice(button.closest('.invoice')));
}
function printInvoice(card){
  const wasOpen=card.open;
  card.open=true;
  card.classList.add('print-target');document.body.classList.add('printing-invoice');
  const cleanup=()=>{card.classList.remove('print-target');document.body.classList.remove('printing-invoice');card.open=wasOpen};
  window.addEventListener('afterprint',cleanup,{once:true});
  window.print();
}
function money(cents){return (cents/100).toFixed(2).replace('.',',')}
async function saveProcurementPrice(event){
  event.preventDefault();const form=event.currentTarget,input=form.elements.price,button=form.querySelector('button'),card=form.closest('.invoice'),message=card.querySelector('.invoice-error');
  button.disabled=true;message.textContent='';
  try{
    const response=await fetch('/api/procurement',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:Number(form.dataset.id),price:input.value})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Не удалось сохранить цену');
    const item=procurementItems.find(row=>row.id===result.id);if(item){item.unitPriceCents=result.unitPriceCents;item.needed=result.quantity}
    openInvoices.add(card.dataset.orderId);renderProcurement();showToast('Цена сохранена');
  }catch(error){message.textContent=error.message||'Не удалось сохранить цену';button.disabled=false}
}
$$('#orderSummary [data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;orderLimit=30;render()});
function statusClass(s){return s==="Готово"||s==="Забрали"?"done":s==="В работе"?"work":s==="Не требуется"?"none":"wait"}
function stageStatus(o,s){return s==="Конструктор"?(drawings[o.id]?"Готово":"Требуется"):o.statuses[s]}
function completePercent(o){const needed=services.filter(s=>stageStatus(o,s)!=="Не требуется");return Math.round(needed.filter(s=>stageStatus(o,s)==="Готово").length/needed.length*100)}
function isReady(o){return services.every(s=>["Готово","Не требуется"].includes(stageStatus(o,s)))}
function readyForPickup(o){return isReady(o)&&!shipments[o.id]}
function inSummary(o,category){return category==='shipped'?Boolean(shipments[o.id]):category==='ready'?department==='Конструктор'?Boolean(drawings[o.id])&&!shipments[o.id]:readyForPickup(o):department==='Конструктор'?!drawings[o.id]&&!shipments[o.id]:!isReady(o)&&!shipments[o.id]}
function assigned(){return roleServices[department]||[]}
function myConstructorOrder(o){return !constructorCode||o.id.split('/')[1]?.[0]===constructorGroup}
function visibleOrder(o){return myConstructorOrder(o)&&(department!=="Производство"||Boolean(drawings[o.id]))}
function isOverdue(o){return !shipments[o.id]&&!isReady(o)&&deadlineStatus(deadlines[o.id]).className==='late'}
function acceptedKey(){return constructorName||department}
function deptStatus(o){
  if(shipments[o.id])return "Забрали";
  if(department==="Конструктор")return drawings[o.id]?"Готово":accepted[acceptedKey()]?.[o.id]?"В работе":"В очереди";
  if(department==="Менеджер") return isReady(o)?"Готово":services.some(s=>o.statuses[s]==="В работе")||Object.values(accepted).some(byOrder=>byOrder[o.id])?"В работе":"В очереди";
  const states=assigned().map(s=>o.statuses[s]);
  if(states.every(s=>["Готово","Не требуется"].includes(s))) return "Готово";
  if(accepted[department]?.[o.id]||states.some(s=>["В работе","Готово"].includes(s))) return "В работе";
  return "В очереди";
}
function hasMyWork(o){return department==="Конструктор"?!drawings[o.id]:!shipments[o.id]&&assigned().some(s=>["Требуется","В работе"].includes(o.statuses[s]))}
async function loadOrderPage(append=false){
  if(!department||department==='Снабжение')return;
  if(append&&pageBusy)return;
  if(!append)pageAbort?.abort();
  const controller=new AbortController();pageAbort=controller;
  const request=++pageRequest,session=department,offset=append?orders.length:0;
  pageBusy=true;
  const url='/api/dashboard?'+new URLSearchParams({filter,q:$('#searchInput').value.trim(),offset:String(offset),limit:'30'});
  try{
    const response=await fetch(url,{cache:'no-store',signal:controller.signal,headers:!append&&orders.length<=30&&pageEtags.has(url)?{'If-None-Match':pageEtags.get(url)}:{}});
    if(request!==pageRequest||department!==session)return;
    if(response.status===304)return;
    if(!response.ok)throw new Error('Не удалось загрузить заказы');
    const data=await response.json();if(request!==pageRequest||department!==session)return;
    pageEtags.clear();if(response.headers.get('ETag'))pageEtags.set(url,response.headers.get('ETag'));
    const previous=orders,rows=append?[...previous,...data.orders.filter(o=>!previous.some(p=>p.id===o.id))]:data.orders;
    orders=rows;if(activeOrder&&data.orders.some(o=>o.id===activeOrder.id))activeOrder=data.orders.find(o=>o.id===activeOrder.id);importedOrders=rows.map(o=>({...o,statuses:{...o.statuses}}));pageCounts=data.counts;pageHasMore=data.hasMore;
    for(const o of data.orders){drawings[o.id]=o.drawingCompleted;shipments[o.id]=o.pickedUpAt;deadlines[o.id]=o.projectDeadline;(accepted[acceptedKey()]||={})[o.id]=o.accepted}
    renderRows();
  }catch(error){if(error.name!=='AbortError')showToast(error.message||'Не удалось загрузить заказы')}
  finally{if(request===pageRequest)pageBusy=false}
}
function render(){pageEtags.clear();statsData=null;loadOrderPage()}
function renderRows(){
  for(const category of ['active','ready','shipped']){
    $(`#${category}Count`).textContent=pageCounts[category];
    const button=$(`#orderSummary [data-filter="${category}"]`);button.classList.toggle('active',filter===category);button.setAttribute('aria-pressed',String(filter===category));
  }
  $('#ordersList').innerHTML=orders.length?orders.map(orderCard).join('')+(pageHasMore?'<button class="secondary" id="moreOrders" type="button">Показать ещё</button>':''):'<div class="empty"><strong>Заказы не найдены</strong>Измените фильтр или запрос.</div>';
  if($('#moreOrders'))$('#moreOrders').onclick=()=>loadOrderPage(true);
  $$('.open-order').forEach(b=>b.onclick=()=>openOrder(b.dataset.id));
  $$('.accept-order').forEach(b=>b.onclick=()=>acceptOrder(b.dataset.id));
}
let statsYear='',statsMonth='all';
function statsDate(value){
  if(typeof value!=='string')return null;
  const ru=value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const iso=value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return ru?{year:ru[3],month:Number(ru[2])-1}:iso?{year:iso[1],month:Number(iso[2])-1}:null;
}
async function loadStatistics(append=false){
  if(department==='Снабжение'||!department||append&&statsBusy)return;
  const seq=++statsRequest,session=department;statsBusy=true;
  try{
    const response=await fetch('/api/statistics?'+new URLSearchParams({year:statsYear,month:statsMonth,offset:String(append?statsData.finished.length:0)}),{cache:'no-store'});
    if(!response.ok)throw new Error('Не удалось загрузить статистику');
    const data=await response.json();if(seq!==statsRequest||department!==session)return;
    if(append)data.finished=[...statsData.finished,...data.finished];statsData=data;
    if(mobilePage==='stats')renderMobileStats();
  }catch(error){if(seq===statsRequest){$('#mobileStatsGrid').innerHTML='<p class="error">Не удалось загрузить статистику. Откройте раздел ещё раз.</p>';statsData=null}}
  finally{if(seq===statsRequest)statsBusy=false}
}
function renderMobileStats(){
  const supply=department==='Снабжение';
  $('#statsScope').textContent=supply?'Накладные по заказам':`Заказы и чертежи · ${constructorName||department}`;
  const root=$('#mobileStatsGrid');
  if(supply){root.innerHTML=[['Заказов с накладной',new Set([...shopOrders,...procurementItems.map(item=>item.orderId)]).size],['Позиций в накладных',procurementItems.length],['С ценой',procurementItems.filter(item=>item.unitPriceCents!==null).length]].map(([label,count])=>`<article><span>${label}</span><strong>${count}</strong></article>`).join('');return}
  if(!statsData){root.innerHTML='<p class="stats-footnote">Загрузка статистики…</p>';loadStatistics();return}
  const {years,kpis,contributors,finished}=statsData;statsYear=statsData.year;
  const months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const formatArea=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
  const monthly=statsData.monthly.map((m,i)=>({...m,name:months[i]}));
  const max=Math.max(1,...monthly.flatMap(m=>[m.created,m.finished]));
  root.classList.add('stats-dashboard');
  root.innerHTML=`<div class="stats-toolbar"><label>Год<select id="statsYear">${years.map(y=>`<option ${y===statsYear?'selected':''}>${y}</option>`).join('')}</select></label><label>Период<select id="statsMonth"><option value="all">Все месяцы</option>${months.map((m,i)=>`<option value="${i}" ${statsMonth===String(i)?'selected':''}>${m}</option>`).join('')}</select></label></div>
    <div class="stats-kpis">${[['Новые заказы',kpis.created],['Чертежи готовы',kpis.finished],['Квадратура чертежей',formatArea(kpis.area)+' м²'],['Цех',kpis.shop],['Услуга',kpis.service]].map(([label,n])=>`<article><span>${label}</span><strong>${n}</strong></article>`).join('')}</div>
    <article class="stats-panel"><div class="stats-panel-heading"><h2>Заказы и чертежи по месяцам</h2><span>${statsYear}</span></div><div class="stats-legend"><span><i class="orders-color"></i>Новые заказы</span><span><i class="drawings-color"></i>Чертежи готовы</span></div><div class="stats-chart" role="img" aria-label="Количество новых заказов и готовых чертежей по месяцам">${monthly.map((m,i)=>`<button class="stats-chart-month ${statsMonth===String(i)?'selected':''}" data-month="${i}" aria-label="${m.name}: ${m.created} заказов, ${m.finished} чертежей"><div class="stats-bars"><div><b>${m.created}</b><i class="orders-color" style="height:${Math.max(3,m.created/max*125)}px"></i></div><div><b>${m.finished}</b><i class="drawings-color" style="height:${Math.max(3,m.finished/max*125)}px"></i></div></div><span>${m.name.slice(0,3)}</span></button>`).join('')}</div><p class="stats-footnote">Месяц — первые две цифры номера заказа: 09 — сентябрь, 10 — октябрь. Год — по дате создания. Квадратура — из услуги «Чертёж Базис Мебельщик» для готовых чертежей.</p></article>
    <article class="stats-panel"><h2>Квадратура готовых чертежей по месяцам</h2><div class="area-chart">${monthly.map((m,i)=>`<button data-month="${i}" class="area-month ${statsMonth===String(i)?'selected':''}"><span>${m.name}</span><div><i style="width:${m.area/Math.max(1,...monthly.map(m=>m.area))*100}%"></i></div><b>${formatArea(m.area)} м²</b></button>`).join('')}</div></article>
    <article class="stats-panel"><h2>${statsMonth==='all'?'Работа конструкторов':months[Number(statsMonth)]} · ${statsYear}</h2><div class="stats-table-wrap"><table class="stats-table"><thead><tr><th>Конструктор</th><th>Новые заказы</th><th>Чертежи готовы</th><th>Квадратура, м²</th></tr></thead><tbody>${contributors.map(row=>`<tr><td>${escapeHTML(row.name)}</td><td>${row.created}</td><td>${row.finished}</td><td>${formatArea(row.area)}</td></tr>`).join('')||'<tr><td colspan="4">Заказов пока нет</td></tr>'}</tbody></table></div></article>
    <article class="stats-panel"><h2>Готовые чертежи <small>${kpis.finished}</small></h2>${finished.length?`<div class="stats-drawings">${finished.map(o=>`<div><div><b>${escapeHTML(o.id)}</b><span>${escapeHTML(o.product||'')} · ${escapeHTML(o.constructor||o.manager||'')}</span><span>${o.area!==null?formatArea(o.area)+' м²':'Квадратура не указана'}</span></div><time>${displayDate(String(o.completed).slice(0,10))}</time></div>`).join('')}</div>${statsData.hasMore?'<button type="button" class="secondary" id="moreDrawings">Показать ещё</button>':''}`:'<p class="stats-footnote">За выбранный период завершённых чертежей нет.</p>'}</article>`;
  if($('#moreDrawings'))$('#moreDrawings').onclick=()=>loadStatistics(true);
  $('#statsYear').onchange=e=>{statsYear=e.target.value;loadStatistics()};
  $('#statsMonth').onchange=e=>{statsMonth=e.target.value;loadStatistics()};
  root.querySelectorAll('[data-month]').forEach(button=>button.onclick=()=>{statsMonth=button.dataset.month;loadStatistics()});
}
$('#addOrderButton').onclick=()=>{
  if(draftVisible){$('#draftOrder input[name="id"]')?.focus();return}
  draftVisible=true;
  $('#draftOrder').innerHTML=`<form id="newOrderForm" class="order-card draft-card">
    <div class="order-top"><strong class="order-no">Новая карточка заказа</strong><span class="badge wait">Черновик</span></div>
    <label>Номер заказа<input name="id" inputmode="text" autocomplete="off" placeholder="Например: 09/${constructorGroup}00" pattern="[0-9]{2}/[0-9]{3}" title="Формат 00/000" required maxlength="6"></label>
    <label>Клиент<input name="client" maxlength="120" placeholder="Имя клиента" required></label>
    <label>Телефон клиента<input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+992… или +7…" maxlength="24" required></label>
    <label>Изделие<input name="product" maxlength="120" placeholder="Например: кухня" required></label>
    <fieldset class="kind-switch"><legend>Направление</legend><div class="kind-choices">
      <label class="kind-chip"><input type="radio" name="kind" value="Услуга" required><span>Услуга</span></label>
      <label class="kind-chip"><input type="radio" name="kind" value="Наш заказ" required><span>Цех</span></label>
    </div></fieldset>
    <p class="error" id="newOrderError" role="alert"></p>
    <div class="card-actions"><button type="submit" class="primary">Сохранить</button><button type="button" class="secondary" id="cancelNewOrder">Отмена</button></div>
  </form>`;
  $('#newOrderForm').onsubmit=saveNewOrder;
  $('#cancelNewOrder').onclick=()=>{draftVisible=false;$('#draftOrder').innerHTML=''};
  $('#draftOrder input[name="id"]').focus();
  $('#draftOrder').scrollIntoView({behavior:'smooth',block:'center'});
};
async function saveNewOrder(event){
  event.preventDefault();if(draftSaving)return;
  const form=event.currentTarget,data=new FormData(form),button=form.querySelector('[type="submit"]');
  draftSaving=true;button.disabled=true;$('#newOrderError').textContent='';
  try{
    const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:data.get('id'),client:data.get('client'),phone:data.get('phone'),product:data.get('product'),kind:data.get('kind')})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Не удалось сохранить заказ');
    importedOrders.push(result.order);orders.push({...result.order,statuses:{...result.order.statuses}});
    draftVisible=false;$('#draftOrder').innerHTML='';filter='active';$('#searchInput').value='';render();showToast('Карточка заказа сохранена');openOrder(result.order.id);
  }catch(error){$('#newOrderError').textContent=error.message||'Не удалось сохранить заказ';button.disabled=false}
  finally{draftSaving=false}
}
async function acceptOrder(id){
  const o=findVisibleOrder(id);
  if(!o||!visibleOrder(o)||department==="Менеджер"||deptStatus(o)!=="В очереди")return;
  if(department==="Конструктор"){
    try{const response=await fetch('/api/order-acceptance',{method:'POST',headers:{'Content-Type':'application/json','X-Department-Code':constructorCode},body:JSON.stringify({orderId:id})});if(!response.ok)throw new Error((await response.json()).error||'Не удалось принять заказ')}
    catch(error){showToast(error.message||'Не удалось принять заказ');return}
  }
  (accepted[acceptedKey()]??={})[id]=true;
  localStorage.setItem(`jevon_accepted_${dataVersion}`,JSON.stringify(accepted));
  render();showToast('Заказ принят в работу');
}
function displayDate(iso){if(!iso)return "Не назначен";const [year,month,day]=iso.split('-');return `${day}.${month}.${year}`}
function deadlineStatus(iso){
  if(!iso)return {label:'Не назначен',className:'none'};
  const today=new Date(),localToday=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  return iso<localToday?{label:'Опоздание',className:'late'}:{label:'Успеваем',className:'done'};
}
async function loadDeadlines(){await loadOrderPage()}
async function loadDrawings(){await loadOrderPage()}
async function loadOrderAcceptances(){await loadOrderPage()}
async function loadShipments(){await loadOrderPage()}
async function loadStages(){await loadOrderPage()}
async function migrateStages(){
  try{const response=await fetch('/api/stages',{method:'POST',headers:{'Content-Type':'application/json','X-Department-Code':'2202'},body:JSON.stringify({orders:orders.map(o=>({id:o.id,statuses:o.statuses}))})});if(!response.ok)throw new Error()}
  catch{showToast('Не удалось перенести старые статусы')}
  await loadStages();
}
function orderCard(o){const st=deptStatus(o),pct=completePercent(o);return `<article class="order-card">
  <div class="order-top"><div><div class="order-no">${escapeHTML(o.id)}</div><div class="date">Срок проекта: ${displayDate(deadlines[o.id])}</div></div><span class="badge ${statusClass(st)}">${st}</span></div>
  <div class="client">${escapeHTML(o.client)}</div><div class="product">${escapeHTML(o.product)}</div>
  <div class="status-row"><span class="dept-label">Готовность заказа</span><strong>${pct}%</strong></div><div class="progress"><i style="width:${pct}%"></i></div>
  <div class="card-actions"><button class="secondary open-order" data-id="${escapeHTML(o.id)}">Карточка</button>${department!=="Менеджер"&&st==="В очереди"?`<button class="primary accept-order" data-id="${escapeHTML(o.id)}">Принять</button>`:""}</div>
  </article>`}
function openOrder(id){const o=findVisibleOrder(id);if(!o||!visibleOrder(o))return;selectedId=id;activeOrder=o;const due=deadlineStatus(deadlines[id]);$("#sheetContent").innerHTML=`
  <div class="sheet-title"><small>Карточка заказа · ${escapeHTML(o.kind||'Услуга')}</small><h2>${escapeHTML(o.id)}</h2><p>${escapeHTML(o.client)} · ${escapeHTML(o.product)}</p></div>
  ${["Менеджер","Конструктор"].includes(department)?`<details id="orderActionsMenu" class="order-actions-menu"><summary aria-label="Действия с заказом">⋮</summary><div>${department==='Менеджер'?'<button type="button" id="editOrderButton">Изменить карточку</button><button type="button" id="deleteOrderButton" class="menu-delete">Удалить карточку</button>':''}<button id="shareOrder" type="button">Поделиться</button></div></details>`:''}
  ${department==='Менеджер'?'<div id="managerOrderEditor"></div>':''}
  <div class="detail-grid"><div><span>Дата создания</span><strong>${escapeHTML(o.created||'—')}</strong></div><div><span>Конструктор</span><strong>${escapeHTML(o.constructor||o.manager)}</strong></div><div class="deadline-detail"><span>Срок проекта</span><span class="deadline-inline"><strong>${displayDate(deadlines[o.id])}</strong><span class="badge deadline-badge ${due.className}">${due.label}</span></span></div><div><span>Телефон клиента</span><strong>${escapeHTML(o.phone||'—')}</strong></div></div>
  ${shipments[id]?`<div class="shipment-confirmed">Заказ забрали · ${escapeHTML(shipments[id])} UTC</div>`:''}
  <details id="packagingPhotoBox" class="packaging-photo hidden"><summary>📷 Фото готового заказа</summary><img id="packagingPhoto" alt="Фото упаковки заказа ${o.id}"></details>
  ${["Менеджер","Производство","Конструктор"].includes(department)?'<section id="materialsSection" class="materials-section"><h3>Раскрой чертежа</h3><p>Загрузка списка…</p></section>':''}
  ${department==="Менеджер"?'<section id="estimateSection" class="materials-section"><h3>Смета заказа</h3><p>Загрузка сметы…</p></section>':''}
  ${department==="Менеджер"?`<h3>Этапы производства</h3><div class="services">${services.map(s=>`<div class="service ${assigned().includes(s)?'current':''}" data-service="${s}"><div><strong>${s}</strong></div><span class="badge ${statusClass(stageStatus(o,s))}">${stageStatus(o,s)}</span></div>`).join('')}</div>`:''}
  ${department!=="Менеджер"?actionPanel(o):`<form id="deadlineForm" class="action-panel"><h3>Срок проекта</h3><p>Укажите дату, к которой заказ должен быть готов.</p><div class="deadline-actions"><input type="date" id="deadlineInput" aria-label="Срок проекта" value="${deadlines[o.id]||''}" required><button type="submit" class="primary">Сохранить срок</button></div><p id="deadlineError" class="error" aria-live="polite"></p></form>`}`;
  $("#sheetBackdrop").classList.remove("hidden");$("#orderSheet").classList.add("open");$("#orderSheet").setAttribute("aria-hidden","false");
  $$('.set-status').forEach(b=>b.onclick=()=>setStatus(b.dataset.service,b.dataset.status));
  const photo=$("#packagingPhoto"),photoBox=$("#packagingPhotoBox");
  photo.onerror=()=>{missingPackagingPhotos.add(o.id);photoBox.classList.add('hidden')};
  photoBox.addEventListener('toggle',()=>{if(photoBox.open&&!photo.getAttribute('src'))photo.src=`/api/packaging-photo?id=${encodeURIComponent(o.id)}`});
  fetch(`/api/packaging-photo?id=${encodeURIComponent(o.id)}&metadata=1`,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(meta=>{if(meta?.available&&selectedId===o.id&&photoBox===$('#packagingPhotoBox'))photoBox.classList.remove('hidden')}).catch(()=>{});
  if(department==="Менеджер")$("#deadlineForm").onsubmit=saveDeadline;
  if(department==="Менеджер"){$('#editOrderButton').onclick=()=>{$('#orderActionsMenu').removeAttribute('open');showOrderEditor(o)};$('#deleteOrderButton').onclick=()=>{$('#orderActionsMenu').removeAttribute('open');showDeleteOrder(o)}}
  if($("#sendOrder"))$("#sendOrder").onclick=()=>shareOrder(true);
  if($("#shareOrder"))$("#shareOrder").onclick=shareOrder;
  if($("#pickupButton"))$("#pickupButton").onclick=openPickupDialog;
  if($("#materialsSection"))loadMaterials(id);
}
function showOrderEditor(order){
  const host=$('#managerOrderEditor');host.innerHTML=`<form id="editOrderForm" class="manager-order-form">
    <h3>Изменить заказ ${escapeHTML(order.id)}</h3>
    <label>Клиент<input name="client" maxlength="120" value="${escapeHTML(order.client)}" required></label>
    <label>Телефон клиента<input name="phone" type="tel" inputmode="tel" autocomplete="tel" value="${escapeHTML(order.phone||'')}" placeholder="+992… или +7…" maxlength="24" required></label>
    <label>Изделие<input name="product" maxlength="120" value="${escapeHTML(order.product)}" required></label>
    <fieldset class="kind-switch"><legend>Направление заказа</legend><div class="kind-choices">
      <label class="kind-chip"><input type="radio" name="kind" value="Услуга" ${order.kind!=='Наш заказ'?'checked':''}><span>Услуга</span></label>
      <label class="kind-chip"><input type="radio" name="kind" value="Наш заказ" ${order.kind==='Наш заказ'?'checked':''}><span>Цех</span></label>
    </div></fieldset><p class="error" role="alert"></p>
    <div class="manager-form-actions"><button class="primary" type="submit">Сохранить изменения</button><button class="secondary" type="button" id="cancelOrderEdit">Отмена</button></div>
  </form>`;
  $('#cancelOrderEdit').onclick=()=>host.replaceChildren();
  $('#editOrderForm').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),data=new FormData(form);button.disabled=true;
    try{const response=await fetch('/api/orders',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:order.id,client:data.get('client'),phone:data.get('phone'),product:data.get('product'),kind:data.get('kind')})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Не удалось сохранить');
      for(const list of [orders,importedOrders]){const index=list.findIndex(item=>item.id===order.id);if(index>=0)list[index]={...list[index],...result.order}}
      render();openOrder(order.id);showToast('Карточка изменена');
    }catch(error){form.querySelector('.error').textContent=error.message;button.disabled=false}
  };
}
function showDeleteOrder(order){
  const host=$('#managerOrderEditor');host.innerHTML=`<div class="manager-order-form"><h3>Удалить заказ ${escapeHTML(order.id)}?</h3><p>Карточка исчезнет из всех разделов. Это действие нельзя отменить.</p><p class="error" role="alert"></p><div class="manager-form-actions"><button type="button" id="confirmOrderDelete" class="danger-button">Удалить заказ</button><button type="button" id="cancelOrderDelete" class="secondary">Отмена</button></div></div>`;
  $('#cancelOrderDelete').onclick=()=>host.replaceChildren();
  $('#confirmOrderDelete').onclick=async event=>{const button=event.currentTarget;button.disabled=true;
    try{const response=await fetch('/api/orders',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:order.id})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Не удалось удалить');
      orders=orders.filter(item=>item.id!==order.id);importedOrders=importedOrders.filter(item=>item.id!==order.id);closeSheet();selectedId=null;render();showToast('Карточка удалена');
    }catch(error){host.querySelector('.error').textContent=error.message;button.disabled=false}
  };
}
function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
async function loadMaterials(orderId){
  const section=$("#materialsSection");if(!section)return;
  try{
    const response=await fetch(`/api/materials?id=${encodeURIComponent(orderId)}`,{cache:'no-store',headers:{'X-Department-Code':roleCode}});
    if(!response.ok)throw new Error();const {materials,drawingReady,completedAt,estimate}=await response.json();
    if(selectedId!==orderId||section!==$("#materialsSection"))return;
    if(drawingReady&&!drawings[orderId]){drawings[orderId]=completedAt||true;render();const badge=section.parentElement.querySelector('[data-service="Конструктор"] .badge');if(badge){badge.textContent='Готово';badge.className='badge done'}}
    const receivable=materials.filter(isReceivable);
    materialsReady[orderId]=drawingReady&&receivable.length>0&&receivable.every(item=>item.receivedAt)&&receivable.some(item=>sheetTypes.includes(item.type)&&item.received>0&&item.condition!=='Повреждено');
    renderMaterials(section,materials,orderId,drawingReady,completedAt);
    if(department==='Менеджер'&&estimate)renderEstimate(estimate,drawingReady);
    refreshProductionPanel(orderId);
  }catch{if($('#estimateSection'))$('#estimateSection').innerHTML='<h3>Смета заказа</h3><p class="error">Не удалось загрузить смету. Откройте карточку повторно.</p>';materialsReady[orderId]=false;if(section===$("#materialsSection"))section.innerHTML='<h3>Раскрой чертежа</h3><p class="error">Не удалось загрузить список. Закройте карточку и откройте снова.</p>';refreshProductionPanel(orderId)}
}
function refreshProductionPanel(orderId){
  if(department!=="Производство"||selectedId!==orderId)return;
  const panel=$("#sheetContent .action-panel"),order=findVisibleOrder(orderId);
  if(!panel||!order)return;
  panel.outerHTML=actionPanel(order);
  $$('.set-status').forEach(button=>button.onclick=()=>setStatus(button.dataset.service,button.dataset.status));
  if($("#pickupButton"))$("#pickupButton").onclick=openPickupDialog;
}
function renderMaterials(section,items,orderId,drawingReady,completedAt){
  if(department==="Менеджер"){renderManagerReceipt(section,items,orderId);return}
  const constructor=department==="Конструктор",production=department==="Производство";
  const canEdit=constructor&&!shipments[orderId],editing=canEdit&&(!drawingReady||editingCuttings.has(orderId));
  const visibleItems=production?items.filter(isReceivable):items;
  section.innerHTML=`<div class="cutting-heading"><h3>${production?'Приёмка листов и кромки':'Раскрой чертежа'}</h3>${canEdit&&drawingReady?`<details class="cutting-menu"><summary aria-label="Действия с раскроем">⋯</summary><div><button type="button" data-cutting-action="add">Добавить позицию</button><button type="button" data-cutting-action="edit">Изменить раскрой</button>${editing?'<button type="button" data-cutting-action="finish">Закончить редактирование</button>':''}</div></details>`:''}</div><p>${drawingReady?(production?'Проверьте и примите листы и кромку.':'Чертёж готов. Список доступен производству.'):'Заполните материалы и операции по чертежу.'}</p>
    ${constructor?`<form id="drawingLinkForm" class="material-add drawing-link-form"><h4>Ссылка на чертёж</h4><label>Адрес чертежа<input name="url" type="url" inputmode="url" placeholder="https://…" maxlength="2048" required></label><button class="secondary" type="submit">Сохранить ссылку</button><span class="material-message error" role="alert"></span></form>`:''}
    ${production&&!drawingReady?'<p class="material-empty">Ожидаем раскрой от конструктора после завершения чертежа.</p>':`
    ${visibleItems.length?visibleItems.map(item=>{const receivable=isReceivable(item),sheet=sheetTypes.includes(item.type),expand=production&&receivable;return `<${expand?'details':'div'} class="material-item ${item.receivedAt?'accepted':''}">
      <${expand?'summary class="material-top"':'div class="material-top"'}><strong>${escapeHTML(item.type)}${item.description?` · ${escapeHTML(item.description)}`:''}</strong><span class="badge ${receivable?(item.receivedAt&&item.received===0?'late':item.condition==='Принято'?'done':['Есть проблема','Повреждено'].includes(item.condition)?'late':'wait'):'work'}">${receivable?(item.receivedAt&&item.received===0?'Не привезли':escapeHTML(item.condition)):'По чертежу'}</span></${expand?'summary':'div'}>
      <p>${item.thickness?`Толщина: ${escapeHTML(item.thickness)} · `:''}Количество: ${item.planned} ${cuttingUnits[item.type]||'шт.'}${receivable?` · Получено: ${item.received??'—'}`:''}</p>
      ${item.note?`<p class="material-note">Примечание: ${escapeHTML(item.note)}</p>`:''}
      ${item.photoKey?`<details class="material-photo-details" data-photo-url="/api/material-photo?orderId=${encodeURIComponent(orderId)}&itemId=${item.id}"><summary>📷 Фото повреждения</summary><img alt="Фото повреждения листа ${escapeHTML(item.description)}" loading="lazy"></details>`:''}
      ${item.receivedAt?`<small>Проверено: ${escapeHTML(item.receivedAt)} UTC</small>`:''}
      ${editing&&item.receivedAt===null?`<div class="cutting-item-actions"><button type="button" class="secondary edit-material" data-id="${item.id}">Изменить</button><button type="button" class="secondary remove-material" data-id="${item.id}">Удалить из списка</button></div>`:''}
      ${production&&receivable?`<form class="receive-material" data-id="${item.id}" data-planned="${item.planned}" data-photo-key="${escapeHTML(item.photoKey||'')}">
        <label>Получено ${sheet?'листов':'кромки (п.м.)'}<input name="received" type="${sheet?'number':'text'}" inputmode="${sheet?'numeric':'decimal'}" ${sheet?'min="0" step="1"':'placeholder="Например: 25,6"'} max="9999" required value="${item.received??item.planned}"></label>
        <label>Состояние<select name="condition"><option value="Принято" ${item.condition==='Принято'?'selected':''}>Без повреждений</option><option value="Есть проблема" ${item.condition==='Есть проблема'?'selected':''}>Не хватает / расхождение</option><option value="Повреждено" ${item.condition==='Повреждено'?'selected':''}>Есть повреждение</option></select></label>
        <label class="material-note-field">Причина, если есть расхождение или повреждение<textarea name="note" maxlength="500" placeholder="Например: не хватает 1 листа">${escapeHTML(item.note)}</textarea></label>
        <div class="defect-photo-field ${item.condition==='Повреждено'?'':'hidden'}"><button class="secondary take-defect-photo" type="button">📷 ${item.photoKey?'Переснять повреждение':'Сфотографировать повреждение'}</button><div class="defect-photo-thumb">${item.photoKey?'<span>Фото прикреплено</span>':''}</div></div>
        <button class="primary" type="submit">${item.receivedAt?'Сохранить изменения':'Принять и сохранить'}</button><span class="material-message error" role="alert"></span>
      </form>`:''}
    </${expand?'details':'div'}>`}).join(''):`<p class="material-empty">${production?'Листы и кромка в этом заказе не указаны.':'Список пока не заполнен. Конструктор добавит позиции по чертежу.'}</p>`}`}
    ${editing?`<form id="addMaterial" class="material-add"><h4>Добавить позицию</h4>
      <label>Услуга или материал<select name="type"><optgroup label="Услуги">${cuttingOptions.map(([name])=>`<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join('')}</optgroup><optgroup label="Материалы и фурнитура">${hardwareOptions.map(name=>`<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join('')}</optgroup></select></label>
      <label class="material-description">Название / цвет<input name="description" maxlength="120" placeholder="Например: Белый матовый" required></label>
      <label class="edge-description hidden">Название / цвет кромки<input name="edgeDescription" maxlength="120" placeholder="Например: Белый 101 или R239" autocomplete="off"></label>
      <label class="hinge-type hidden">Тип петли<select name="hingeType" disabled required><option value="">Выберите тип петли</option><option>Прямой</option><option>Горбатый</option><option>Полугорбатый</option><option>90 градусов</option></select></label>
      <label class="material-thickness">Толщина<input name="thickness" maxlength="30" placeholder="Например: 16 мм" required></label>
      <label class="material-quantity">Количество (лист)<input name="planned" type="number" min="1" max="9999" step="1" required></label>
      <p class="derived-hint hidden">Количество фурнитуры рассчитывается по количеству этой услуги.</p>
      <button type="submit" class="primary">Добавить в список</button><span class="material-message error" role="alert"></span>
    <button type="button" id="cancelMaterialEdit" class="secondary hidden">Отмена редактирования</button></form>${!drawingReady?`<button type="button" id="completeDrawing" class="primary complete-drawing" ${items.length?'':'disabled'}>Чертёж готов · Передать список производству</button><span id="drawingMessage" class="material-message error" role="alert"></span>`:'<p class="cutting-edit-note">Изменения сохраняются сразу. Принятые позиции доступны только для просмотра.</p>'}`:''}
    ${constructor&&drawingReady?`<p class="material-confirmed">Чертёж готов · ${escapeHTML(completedAt)} UTC</p>`:''}`;
  section.querySelectorAll('[data-cutting-action]').forEach(button=>button.onclick=()=>{if(button.dataset.cuttingAction==='finish')editingCuttings.delete(orderId);else editingCuttings.add(orderId);renderMaterials(section,items,orderId,drawingReady,completedAt);if(button.dataset.cuttingAction==='add')section.querySelector('#addMaterial')?.scrollIntoView({behavior:'smooth',block:'center'})});
  if(editing){
    $("#addMaterial").onsubmit=event=>saveMaterial(event,orderId);
    const materialType=section.querySelector('#addMaterial [name="type"]'),thicknessField=section.querySelector('.material-thickness'),thicknessInput=thicknessField.querySelector('input');
    const descriptionField=section.querySelector('.material-description'),descriptionInput=descriptionField.querySelector('input'),quantityField=section.querySelector('.material-quantity'),hingeField=section.querySelector('.hinge-type'),hingeInput=hingeField.querySelector('select');
    materialType.onchange=()=>{const sheet=sheetTypes.includes(materialType.value),hardware=hardwareOptions.includes(materialType.value),edge=materialType.value.startsWith('Кромкование'),thickness=thicknessTypes.includes(materialType.value),color=sheet||hardware||materialType.value.startsWith('Распил столешниц'),hinge=hingeServices.includes(materialType.value),derived=derivedSupplyService(materialType.value);thicknessField.classList.toggle('hidden',!thickness);thicknessInput.required=thickness;if(!thickness)thicknessInput.value='';descriptionField.classList.toggle('hidden',!color);descriptionInput.required=color;descriptionInput.placeholder=hardware?'Название, модель, цвет или размер':'Например: Белый матовый';if(!color)descriptionInput.value='';const edgeInput=section.querySelector('[name="edgeDescription"]');edgeInput.closest('label').classList.toggle('hidden',!edge);edgeInput.required=edge;if(!edge)edgeInput.value='';hingeField.classList.toggle('hidden',!hinge);hingeInput.disabled=!hinge;if(!hinge)hingeInput.value='';section.querySelector('.derived-hint').classList.toggle('hidden',!derived);quantityField.firstChild.textContent=`Количество (${cuttingUnits[materialType.value]||'шт.'})`;const quantityInput=quantityField.querySelector('input'),decimal=measuredQuantity(materialType.value);quantityInput.type=decimal?'text':'number';quantityInput.inputMode=decimal?'decimal':'numeric';quantityInput.placeholder=decimal?'Например: 25,6':'';quantityInput.min=decimal?'':'1';quantityInput.step=decimal?'any':'1'};
    materialType.onchange();
    section.querySelector('#addMaterial').dataset.initialValues=materialFormValues(section.querySelector('#addMaterial'));
    section.querySelectorAll('.remove-material').forEach(button=>button.onclick=()=>removeMaterial(Number(button.dataset.id),orderId));
    section.querySelectorAll('.edit-material').forEach(button=>button.onclick=()=>{
      const item=items.find(row=>row.id===Number(button.dataset.id)),form=section.querySelector('#addMaterial');
      if(!item)return;
      if(![...materialType.options].some(option=>option.value===item.type))materialType.add(new Option(item.type,item.type));
      form.dataset.editId=item.id;materialType.value=item.type;materialType.onchange();form.elements.description.value=item.description;form.elements.edgeDescription.value=item.description;form.elements.hingeType.value=item.description;form.elements.thickness.value=item.thickness;form.elements.planned.value=item.planned;form.dataset.initialValues=materialFormValues(form);form.querySelector('h4').textContent='Изменить позицию';form.querySelector('[type="submit"]').textContent='Сохранить изменения';$('#cancelMaterialEdit').classList.remove('hidden');form.scrollIntoView({behavior:'smooth',block:'center'});
    });
    $('#cancelMaterialEdit').onclick=()=>renderMaterials(section,items,orderId,drawingReady,completedAt);
    if($("#completeDrawing"))$("#completeDrawing").onclick=()=>completeDrawing(orderId);
  }else if(production&&drawingReady)section.querySelectorAll('.receive-material').forEach(form=>{
    form.onsubmit=event=>receiveMaterial(event,orderId);
    form.querySelector('[name="condition"]').onchange=()=>form.querySelector('.defect-photo-field').classList.toggle('hidden',form.querySelector('[name="condition"]').value!=='Повреждено');
    form.querySelector('.take-defect-photo').onclick=()=>openDefectCamera(form,orderId);
  });
  if(constructor){
    const linkForm=section.querySelector('#drawingLinkForm');
    fetch(`/api/drawing-link?id=${encodeURIComponent(orderId)}`,{cache:'no-store',headers:{'X-Department-Code':constructorCode}}).then(r=>r.json()).then(data=>{if(linkForm.isConnected&&!linkForm.elements.url.value)linkForm.elements.url.value=data.url||''}).catch(()=>{});
    linkForm.onsubmit=async event=>{
      event.preventDefault();const button=linkForm.querySelector('button'),message=linkForm.querySelector('.material-message');button.disabled=true;message.textContent='';
      try{const response=await fetch('/api/drawing-link',{method:'PUT',headers:{'Content-Type':'application/json','X-Department-Code':constructorCode},body:JSON.stringify({orderId,url:linkForm.elements.url.value})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Не удалось сохранить ссылку');showToast('Ссылка на чертёж сохранена')}
      catch(error){message.textContent=error.message||'Не удалось сохранить ссылку'}finally{button.disabled=false}
    };
  }
  section.querySelectorAll('.material-photo-details').forEach(details=>details.ontoggle=()=>{if(details.open){const img=details.querySelector('img');if(!img.src)img.src=details.dataset.photoUrl}});
}
async function saveMaterial(event,orderId){
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),message=form.querySelector('.material-message'),data=new FormData(form);
  button.disabled=true;form.dataset.saving='true';message.textContent='';
  try{
    const type=String(data.get('type')),description=type.startsWith('Кромкование')?String(data.get('edgeDescription')).trim():hingeServices.includes(type)?data.get('hingeType'):data.get('description');
    const response=await fetch('/api/materials',{method:form.dataset.editId?'PUT':'POST',headers:{'Content-Type':'application/json','X-Department-Code':constructorCode},body:JSON.stringify({id:form.dataset.editId?Number(form.dataset.editId):undefined,orderId,type,description,thickness:data.get('thickness'),planned:Number(String(data.get('planned')).replace(',','.'))})});
    const result=await response.json();if(!response.ok)throw new Error(result.error);await loadMaterials(orderId);showToast(result.estimate?.message||(form.dataset.editId?'Изменения сохранены':'Позиция добавлена'));
  }catch(error){message.textContent=error.message||'Не удалось сохранить';button.disabled=false}
  finally{delete form.dataset.saving}
}
async function receiveMaterial(event,orderId){
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),message=form.querySelector('.material-message'),data=new FormData(form);
  const received=Number(String(data.get('received')).replace(',','.')),planned=Number(form.dataset.planned),condition=data.get('condition'),note=String(data.get('note')||'').trim();
  if(received!==0&&(received!==planned||condition!=='Принято')&&!note){message.textContent='Укажите причину расхождения или повреждения';return}
  const photoId=`${orderId}:${form.dataset.id}`,photo=defectPhotos.get(photoId);
  if(condition==='Повреждено'&&!photo&&!form.dataset.photoKey){message.textContent='Сначала сфотографируйте повреждение';return}
  button.disabled=true;message.textContent='';
  try{
    let photoKey=form.dataset.photoKey||null;
    if(condition==='Повреждено'&&photo){
      const upload=await fetch('/api/material-photo',{method:'POST',headers:{'Content-Type':'image/jpeg','X-Department-Code':'2202','X-Order-Id':orderId,'X-Item-Id':form.dataset.id},body:photo});
      const result=await upload.json();if(!upload.ok)throw new Error(result.error||'Не удалось отправить фото');photoKey=result.photoKey;
    }
    const response=await fetch('/api/materials',{method:'PATCH',headers:{'Content-Type':'application/json','X-Department-Code':'2202'},body:JSON.stringify({id:Number(form.dataset.id),orderId,received,condition,note,photoKey})});
    if(!response.ok)throw new Error((await response.json()).error);defectPhotos.delete(photoId);await loadMaterials(orderId);if(defectThumbUrls.has(photoId)){URL.revokeObjectURL(defectThumbUrls.get(photoId));defectThumbUrls.delete(photoId)}showToast('Приёмка сохранена');
  }catch(error){message.textContent=error.message||'Не удалось сохранить';button.disabled=false}
}
let defectTargetForm=null,defectTargetOrder=null,defectStream=null,defectDraft=null;
const defectThumbUrls=new Map();
function cameraFailure(error){
  if(error?.name==='NotAllowedError'||error?.name==='PermissionDeniedError')return 'Доступ к камере запрещён. Разрешите камеру в настройках браузера или выберите фото ниже.';
  if(error?.name==='NotReadableError')return 'Камера занята другим приложением. Закройте его или сделайте фото телефоном ниже.';
  return 'Встроенная камера не открылась. Снимите фото камерой телефона или выберите из галереи ниже.';
}
function canvasJpeg(canvas,callback){
  if(canvas.toBlob){canvas.toBlob(callback,'image/jpeg',0.78);return}
  try{const bytes=atob(canvas.toDataURL('image/jpeg',0.78).split(',')[1]);callback(new Blob([Uint8Array.from(bytes,char=>char.charCodeAt(0))],{type:'image/jpeg'}))}
  catch{callback(null)}
}
function selectedPhotoToJpeg(file,onReady,errorElement){
  if(!file)return;
  errorElement.textContent='';
  if(file.size>30_000_000){errorElement.textContent='Фото слишком большое. Выберите снимок до 30 МБ.';return}
  const url=URL.createObjectURL(file),image=new Image();
  image.onload=()=>{
    try{
      const scale=Math.min(1,1280/image.width,1280/image.height),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      URL.revokeObjectURL(url);
      canvasJpeg(canvas,blob=>blob?onReady(blob):errorElement.textContent='Не удалось обработать фото. Выберите другое изображение.');
    }catch{URL.revokeObjectURL(url);errorElement.textContent='Не удалось обработать фото. Выберите другое изображение.'}
  };
  image.onerror=()=>{URL.revokeObjectURL(url);errorElement.textContent='Этот формат фото не открылся. Сделайте снимок в JPEG или выберите другой.'};
  image.src=url;
}
function stopDefectCamera(){defectStream?.getTracks().forEach(track=>track.stop());defectStream=null;$('#defectVideo').srcObject=null}
function closeDefectCamera(){stopDefectCamera();$('#defectCameraOverlay').classList.add('hidden');defectTargetForm=null;defectTargetOrder=null;defectDraft=null;const preview=$('#defectPreview');if(preview.src.startsWith('blob:'))URL.revokeObjectURL(preview.src);preview.removeAttribute('src')}
async function startDefectCamera(){
  const error=$('#defectCameraError');error.textContent='';
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error();
    defectStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if($('#defectCameraOverlay').classList.contains('hidden')||defectDraft){stopDefectCamera();return}
    $('#defectVideo').srcObject=defectStream;await $('#defectVideo').play();
  }catch(failure){stopDefectCamera();error.textContent=cameraFailure(failure)}
}
function openDefectCamera(form,orderId){
  defectTargetForm=form;defectTargetOrder=orderId;defectDraft=null;
  $('#defectCameraOverlay').classList.remove('hidden');$('#defectVideo').classList.remove('hidden');$('#defectPreview').classList.add('hidden');
  $('#takeDefectPhoto').classList.remove('hidden');$('#retakeDefectPhoto').classList.add('hidden');$('#useDefectPhoto').classList.add('hidden');
  $('#defectPhotoFile').value='';$('#defectGalleryFile').value='';startDefectCamera();
}
function previewDefectBlob(blob){
  if($('#defectPreview').src.startsWith('blob:'))URL.revokeObjectURL($('#defectPreview').src);
  defectDraft=blob;stopDefectCamera();$('#defectPreview').src=URL.createObjectURL(blob);
  $('#defectVideo').classList.add('hidden');$('#defectPreview').classList.remove('hidden');
  $('#takeDefectPhoto').classList.add('hidden');$('#retakeDefectPhoto').classList.remove('hidden');$('#useDefectPhoto').classList.remove('hidden');
}
$('#closeDefectCamera').onclick=closeDefectCamera;
$('#takeDefectPhoto').onclick=()=>{
  const video=$('#defectVideo');if(!video.videoWidth){$('#defectCameraError').textContent='Дождитесь включения камеры';return}
  const canvas=document.createElement('canvas'),scale=Math.min(1,1280/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
  canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  canvasJpeg(canvas,blob=>blob?previewDefectBlob(blob):$('#defectCameraError').textContent='Не удалось сделать фото');
};
$('#retakeDefectPhoto').onclick=()=>{defectDraft=null;$('#defectVideo').classList.remove('hidden');$('#defectPreview').classList.add('hidden');$('#takeDefectPhoto').classList.remove('hidden');$('#retakeDefectPhoto').classList.add('hidden');$('#useDefectPhoto').classList.add('hidden');startDefectCamera()};
for(const id of ['defectPhotoFile','defectGalleryFile'])$(`#${id}`).onchange=event=>selectedPhotoToJpeg(event.target.files?.[0],previewDefectBlob,$('#defectCameraError'));
$('#useDefectPhoto').onclick=()=>{
  if(!defectDraft||!defectTargetForm||!defectTargetOrder)return;
  const key=`${defectTargetOrder}:${defectTargetForm.dataset.id}`,photoBox=defectTargetForm.querySelector('.defect-photo-thumb');
  if(defectThumbUrls.has(key))URL.revokeObjectURL(defectThumbUrls.get(key));
  const url=URL.createObjectURL(defectDraft);defectThumbUrls.set(key,url);defectPhotos.set(key,defectDraft);
  photoBox.innerHTML=`<details class="material-photo-details"><summary>📷 Фото готово к сохранению · посмотреть</summary><img src="${url}" alt="Новое фото повреждения"></details>`;
  defectTargetForm.querySelector('.take-defect-photo').textContent='📷 Переснять повреждение';
  closeDefectCamera();
};
async function removeMaterial(id,orderId){
  try{const response=await fetch('/api/materials',{method:'DELETE',headers:{'Content-Type':'application/json','X-Department-Code':constructorCode},body:JSON.stringify({id,orderId})});const result=await response.json();if(!response.ok)throw new Error(result.error);await loadMaterials(orderId);showToast(result.estimate?.message||'Материал удалён')}
  catch(error){showToast(error.message||'Не удалось удалить материал')}
}
async function completeDrawing(orderId){
  const button=$("#completeDrawing"),message=$("#drawingMessage");button.disabled=true;message.textContent='';
  try{
    const response=await fetch('/api/drawings',{method:'POST',headers:{'Content-Type':'application/json','X-Department-Code':constructorCode},body:JSON.stringify({orderId})});
    const result=await response.json();if(!response.ok)throw new Error(result.error);
    drawings[orderId]=true;render();await loadMaterials(orderId);
    const badge=$("#sheetContent [data-service='Конструктор'] .badge");if(badge){badge.textContent='Готово';badge.className='badge done'}
    showToast(result.estimate?.ok?'Чертёж готов. Смета обновлена':result.estimate?.message||'Чертёж готов. Список передан производству');
  }catch(error){message.textContent=error.message||'Не удалось передать список';button.disabled=false}
}
async function saveDeadline(event){
  event.preventDefault();const input=$("#deadlineInput"),button=$("#deadlineForm button"),message=$("#deadlineError");
  const deadline=input.value;if(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)){message.textContent='Выберите дату';return}
  button.disabled=true;message.textContent='';
  try{const response=await fetch('/api/deadlines',{method:'PUT',headers:{'Content-Type':'application/json','X-Department-Code':roleCode},body:JSON.stringify({id:selectedId,deadline})});if(!response.ok)throw new Error();deadlines[selectedId]=deadline;render();openOrder(selectedId);showToast('Срок сохранён')}
  catch{message.textContent='Не удалось сохранить срок. Повторите попытку.';button.disabled=false}
}
function stageUnlocked(o,service){const stages=roleServices["Производство"],index=stages.indexOf(service);return index>=0&&(service!=="Распил"||materialsReady[o.id]===true)&&stages.slice(0,index).every(previous=>["Готово","Не требуется"].includes(o.statuses[previous]))}
function actionPanel(o){if(department==="Конструктор")return '<div class="action-panel"><h3>Конструктор</h3><p>Заполните раскрой чертежа выше и нажмите «Чертёж готов». Производство увидит материалы для приёмки и операции по заказу.</p></div>';if(shipments[o.id])return '<div class="action-panel"><h3>Заказ забрали</h3><p>Выдача заказа уже записана.</p></div>';return `<div class="action-panel"><h3>Этапы производства</h3><p>Открывайте этапы по очереди. Для исправления нажмите на завершённый этап.</p>${assigned().map(service=>{const st=o.statuses[service],unlocked=stageUnlocked(o,service);return `<details class="service-actions ${unlocked?'':'stage-locked'}"><summary><strong>${service}</strong><span class="badge ${statusClass(st)}">${st}</span></summary>${unlocked?`<div class="action-buttons">
  ${st!=="В работе"?`<button class="secondary set-status" data-service="${service}" data-status="В работе">Взять в работу</button>`:''}
  ${st!=="Готово"?`<button class="primary set-status" data-service="${service}" data-status="Готово">Готово</button>`:''}
  ${st!=="Не требуется"?`<button class="danger-lite wide set-status" data-service="${service}" data-status="Не требуется">Не требуется</button>`:''}</div>`:`<p class="stage-hint">${service==='Распил'?'Отметьте приёмку всех позиций, включая отсутствующие (0). Для распила нужен хотя бы один лист.':'Сначала завершите предыдущий этап.'}</p>`}</details>`}).join('')}${isReady(o)?'<button type="button" id="pickupButton" class="primary pickup-button">Заказ забрали</button>':''}</div>`}
function setStatus(service,status){
  const current=findVisibleOrder(selectedId);
  if(department!=="Производство"||!current||shipments[current.id]||!stageUnlocked(current,service)){showToast(service==='Распил'?'Сначала отметьте приёмку всех позиций':'Сначала завершите предыдущий этап');return}
  if(department==="Производство"&&service==="Упаковка"&&["Готово","Не требуется"].includes(status)){openPackagingCamera(status);return}
  commitStatus(service,status);
}
async function commitStatus(service,status){
  const o=findVisibleOrder(selectedId);if(!o)return;
  try{
    const response=await fetch('/api/stages',{method:'PUT',headers:{'Content-Type':'application/json','X-Department-Code':'2202'},body:JSON.stringify({orderId:o.id,stage:service,status})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Не удалось сохранить статус');
    o.statuses[service]=status;localStorage.setItem(`jevon_orders_${dataVersion}`,JSON.stringify(orders));openOrder(selectedId);render();showToast(`${service}: ${status}`);
  }catch(error){showToast(error.message||'Не удалось сохранить статус')}
}
async function shareOrder(send=false){
  send=send===true;
  const id=selectedId,order=findVisibleOrder(id),button=$('#shareOrder');$('#orderActionsMenu')?.removeAttribute('open');button.disabled=true;
  const target=send?window.open('about:blank','_blank'):null;
  if(target)target.opener=null;
  try{
    const response=await fetch('/api/share-order',{method:'POST',headers:{'Content-Type':'application/json','X-Department-Code':roleCode},body:JSON.stringify({orderId:id})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Не удалось создать ссылку');
    $('#shareUrl').value=result.url;
    const message=`JEVON | Заказ № ${id}\n\nИнформация о ходе выполнения заказа доступна по ссылке:\n${result.url}`;
    const whatsapp=`https://wa.me/${(order.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(message)}`;
    $('#shareWhatsApp').href=whatsapp;
    if(send&&target)target.location.href=whatsapp;else $('#shareDialog').showModal();
  }catch(error){target?.close();showToast(error.message||'Не удалось создать ссылку')}
  finally{button.disabled=false}
}
$('#closeShareDialog').onclick=()=>$('#shareDialog').close();
$('#copyShareUrl').onclick=async()=>{try{await navigator.clipboard.writeText($('#shareUrl').value);showToast('Ссылка скопирована')}catch{$('#shareUrl').select();document.execCommand('copy');showToast('Ссылка скопирована')}};
let pickupOrderId=null;
function openPickupDialog(){
  const o=findVisibleOrder(selectedId);
  if(department!=="Производство"||!o||!isReady(o)||shipments[o.id])return;
  pickupOrderId=o.id;$("#pickupOrderNumber").textContent=o.id;$("#pickupDialogError").textContent='';$("#pickupDialog").showModal();
}
$("#cancelPickup").onclick=()=>$("#pickupDialog").close();
$("#pickupDialog").addEventListener('close',()=>{pickupOrderId=null});
$("#pickupDialog").addEventListener('click',event=>{if(event.target===$("#pickupDialog")&&!$("#confirmPickup").disabled)$("#pickupDialog").close()});
$("#confirmPickup").onclick=async()=>{
  const o=findVisibleOrder(pickupOrderId);
  if(!o||!isReady(o)||shipments[o.id])return;
  const button=$("#confirmPickup"),cancel=$("#cancelPickup"),message=$("#pickupDialogError");button.disabled=true;cancel.disabled=true;message.textContent='';
  try{
    const response=await fetch('/api/shipments',{method:'POST',headers:{'Content-Type':'application/json','X-Department-Code':'2202'},body:JSON.stringify({orderId:o.id,statuses:o.statuses})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Не удалось сохранить выдачу');
    shipments[o.id]=result.pickedUpAt;$("#pickupDialog").close();render();openOrder(o.id);showToast('Выдача заказа записана');
  }catch(error){message.textContent=error.message||'Не удалось сохранить выдачу'}
  finally{button.disabled=false;cancel.disabled=false}
};
let packagingStream=null,packagingBlob=null,packagingStatus=null;
async function startPackagingCamera(){
  const video=$("#cameraVideo"),message=$("#cameraError");message.textContent='';
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Камера недоступна в этом браузере. Откройте сайт в Chrome и разрешите доступ к камере.');
    packagingStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if($("#cameraOverlay").classList.contains('hidden')||packagingBlob){stopPackagingCamera();return}
    video.srcObject=packagingStream;await video.play();
  }catch(error){stopPackagingCamera();message.textContent=cameraFailure(error)}
}
function openPackagingCamera(status){
  packagingStatus=status;packagingBlob=null;
  $("#cameraOverlay").classList.remove('hidden');$("#cameraVideo").classList.remove('hidden');$("#cameraPreview").classList.add('hidden');
  $("#takePhoto").classList.remove('hidden');$("#retakePhoto").classList.add('hidden');$("#confirmPhoto").classList.add('hidden');
  $("#cameraHint").textContent=`Сфотографируйте заказ перед установкой статуса «${status}» для упаковки.`;
  $('#packagingPhotoFile').value='';$('#packagingGalleryFile').value='';
  startPackagingCamera();
}
function stopPackagingCamera(){packagingStream?.getTracks().forEach(track=>track.stop());packagingStream=null;$("#cameraVideo").srcObject=null}
function cancelPackagingCamera(){stopPackagingCamera();packagingBlob=null;packagingStatus=null;$("#cameraOverlay").classList.add('hidden')}
$("#cancelCamera").onclick=cancelPackagingCamera;
$("#takePhoto").onclick=()=>{
  const video=$("#cameraVideo");if(!video.videoWidth){$("#cameraError").textContent='Подождите, пока камера включится.';return}
  const canvas=document.createElement('canvas'),scale=Math.min(1,1280/video.videoWidth);
  canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
  canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  canvasJpeg(canvas,blob=>{
    if(!blob){$("#cameraError").textContent='Не удалось сделать снимок.';return}
    packagingBlob=blob;$("#cameraPreview").src=URL.createObjectURL(blob);stopPackagingCamera();
    $("#cameraVideo").classList.add('hidden');$("#cameraPreview").classList.remove('hidden');
    $("#takePhoto").classList.add('hidden');$("#retakePhoto").classList.remove('hidden');$("#confirmPhoto").classList.remove('hidden');
  });
};
for(const id of ['packagingPhotoFile','packagingGalleryFile'])$(`#${id}`).onchange=event=>selectedPhotoToJpeg(event.target.files?.[0],blob=>{
  packagingBlob=blob;stopPackagingCamera();
  const preview=$('#cameraPreview');if(preview.src.startsWith('blob:'))URL.revokeObjectURL(preview.src);
  preview.src=URL.createObjectURL(blob);$('#cameraVideo').classList.add('hidden');preview.classList.remove('hidden');
  $('#takePhoto').classList.add('hidden');$('#retakePhoto').classList.remove('hidden');$('#confirmPhoto').classList.remove('hidden');
  $('#cameraError').textContent='';
},$('#cameraError'));
$("#retakePhoto").onclick=()=>{URL.revokeObjectURL($("#cameraPreview").src);packagingBlob=null;$("#cameraPreview").classList.add('hidden');$("#cameraVideo").classList.remove('hidden');$("#takePhoto").classList.remove('hidden');$("#retakePhoto").classList.add('hidden');$("#confirmPhoto").classList.add('hidden');startPackagingCamera()};
$("#confirmPhoto").onclick=async()=>{
  if(!packagingBlob||!packagingStatus)return;
  const button=$("#confirmPhoto");button.disabled=true;$("#cameraError").textContent='';
  try{
    const response=await fetch('/api/packaging-photo',{method:'POST',headers:{'Content-Type':'image/jpeg','X-Department-Code':'2202','X-Order-Id':selectedId},body:packagingBlob});
    if(!response.ok)throw new Error((await response.json()).error||'Не удалось сохранить фото');
    const status=packagingStatus;missingPackagingPhotos.delete(selectedId);URL.revokeObjectURL($("#cameraPreview").src);cancelPackagingCamera();commitStatus('Упаковка',status);
  }catch(error){$("#cameraError").textContent=error.message||'Не удалось сохранить фото. Повторите попытку.'}
  finally{button.disabled=false}
};
function materialFormValues(form){return JSON.stringify([...new FormData(form).entries()])}
function hasUnsavedMaterial(){const form=department==='Менеджер'?$('#estimateRowForm'):$('#addMaterial');return form&&form.dataset.initialValues!==materialFormValues(form)}
function closeSheet(force){
  const form=$('#estimateRowForm')||$('#addMaterial');
  if(form?.dataset.saving==='true'){showToast('Подождите, позиция сохраняется');return}
  if(force!==true&&hasUnsavedMaterial()){const dialog=$('#unsavedDialog');if(!dialog.open)dialog.showModal();return}
  const sheet=$("#orderSheet");sheet.style.transition='';sheet.style.transform='';
  $("#sheetBackdrop").classList.add("hidden");sheet.classList.remove("open");sheet.setAttribute("aria-hidden","true");
}
$("#closeSheet").onclick=closeSheet;$("#sheetBackdrop").onclick=closeSheet;
$('#continueMaterial').onclick=()=>$('#unsavedDialog').close();
$('#discardMaterial').onclick=()=>{$('#unsavedDialog').close();closeSheet(true)};
window.addEventListener('beforeunload',event=>{if($('#orderSheet').classList.contains('open')&&hasUnsavedMaterial()){event.preventDefault();event.returnValue=''}});
const swipeSheet=$("#orderSheet");let swipeStart=null,swipeDistance=0;
swipeSheet.addEventListener('touchstart',event=>{
  if(event.touches.length!==1||swipeSheet.scrollTop>0||event.target.closest('button,input,textarea,select'))return;
  swipeStart=event.touches[0].clientY;swipeDistance=0;
},{passive:true});
swipeSheet.addEventListener('touchmove',event=>{
  if(swipeStart===null)return;
  const distance=event.touches[0].clientY-swipeStart;
  if(distance<=8){if(distance<0)swipeStart=null;return}
  if(swipeSheet.scrollTop>0){swipeStart=null;return}
  event.preventDefault();swipeDistance=distance;swipeSheet.style.transition='none';swipeSheet.style.transform=`translate(-50%, ${distance}px)`;
},{passive:false});
function finishSheetSwipe(){
  if(swipeStart===null)return;
  const shouldClose=swipeDistance>100;swipeStart=null;swipeDistance=0;
  swipeSheet.style.transition='transform .25s ease';
  if(shouldClose){swipeSheet.style.transform='';swipeSheet.style.transition='';closeSheet()}
  else{swipeSheet.style.transform='translate(-50%, 0)';setTimeout(()=>{swipeSheet.style.transition='';swipeSheet.style.transform=''},260)}
}
swipeSheet.addEventListener('touchend',finishSheetSwipe);swipeSheet.addEventListener('touchcancel',finishSheetSwipe);
function showToast(text){const t=$("#toast");t.textContent=text;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)}
restoreSession();

function renderClientAccess(){
 const q=$('#clientAccessSearch').value.toLowerCase().trim();const shown=accessClients.filter(c=>c.phone.includes(q)||c.names.join(' ').toLowerCase().includes(q));
 $('#clientAccessList').innerHTML=shown.length?shown.map(c=>`<article class="client-access-row"><strong>${escapeHTML(c.names.join(' / ')||'Клиент')}</strong><span>${escapeHTML(c.phone)} · Заказов: ${c.orders}</span>${c.registered?`<button type="button" class="secondary access-reset" data-phone="${escapeHTML(c.phone)}">Выдать новый код</button>`:'<small>Ещё не зарегистрирован</small>'}<div class="access-result" role="status"></div></article>`).join(''):'<p>Клиенты не найдены</p>';
}
async function loadClientAccess(){if(accessBusy||department!=='Менеджер')return;accessBusy=true;$('#clientAccessList').textContent='Загружаем клиентов…';try{const r=await fetch('/api/client-access',{cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.error||'Не удалось загрузить клиентов');if(department!=='Менеджер')return;accessClients=data.clients;renderClientAccess()}catch(e){$('#clientAccessList').textContent=e.message}finally{accessBusy=false}}
$('#clientAccessPanel').ontoggle=()=>{if($('#clientAccessPanel').open)loadClientAccess()};
$('#clientAccessSearch').oninput=renderClientAccess;
$('#clientAccessList').onclick=async event=>{
 const button=event.target.closest('.access-reset');if(!button||department!=='Менеджер')return;
 const result=button.closest('article').querySelector('.access-result'),phone=button.dataset.phone;
 result.innerHTML='<p>Заменить код? Старый код перестанет работать.</p><div class="access-actions"><button type="button" class="primary access-confirm">Выдать новый</button><button type="button" class="secondary access-cancel">Отмена</button></div>';
 result.querySelector('.access-cancel').onclick=()=>result.replaceChildren();
 result.querySelector('.access-confirm').onclick=async()=>{
 button.disabled=true;result.textContent='Создаём новый код…';
 try{const response=await fetch('/api/client-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})}),data=await response.json();if(!response.ok)throw Error(data.error||'Не удалось выдать код');
 const text=`JEVON — ваш новый код для входа: ${data.code}. Старый код больше не действует. Сохраните код и не передавайте другим людям.`;
 result.innerHTML=`<span>Новый код · сохраните перед закрытием</span><strong class="access-code">${escapeHTML(data.code)}</strong><div class="access-actions"><a class="primary" target="_blank" rel="noopener noreferrer" href="https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(text)}">Отправить в WhatsApp</a><button type="button" class="secondary access-copy">Копировать код</button></div>`;
 result.querySelector('.access-copy').onclick=async e=>{try{await navigator.clipboard.writeText(data.code);e.target.textContent='Скопировано'}catch{e.target.textContent='Выделите код и скопируйте'}};
 }catch(e){result.textContent=e.message}finally{button.disabled=false}
 };
};

function renderEstimate(estimate,drawingReady=Boolean(drawings[estimate.orderId]),editing=false){
 const host=$('#estimateSection');if(!host||selectedId!==estimate.orderId||department!=='Менеджер')return;
 host.innerHTML=`<div class="estimate-heading"><h3>Смета заказа</h3><details class="cutting-menu estimate-menu"><summary aria-label="Действия со сметой">⋯</summary><div><button type="button" id="editEstimate">Изменить</button><button type="button" id="addEstimate">Добавить</button></div></details><span class="badge ${drawingReady?'done':'work'}">${drawingReady?'Раскрой готов':'Раскрой заполняется'}</span></div><p>Услуги по сохранённому раскрою. Цены в сомони.</p>
 ${estimate.rows.length?`<div class="estimate-table-wrap"><table class="estimate-table"><thead><tr><th>Услуга</th><th>Количество</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${estimate.rows.map((row,index)=>`<tr><td><strong>${escapeHTML(row.type)}</strong>${editing?`<button type="button" class="estimate-edit-row" data-estimate-index="${index}">Изменить позицию</button>`:''}${row.edited?'<small>Изменено менеджером</small>':''}${row.description?`<small>${escapeHTML(row.description)}</small>`:''}${row.thickness?`<small>Толщина: ${escapeHTML(row.thickness)}</small>`:''}</td><td>${escapeHTML(row.billableQuantity)}<small>${escapeHTML(row.unit)}</small>${row.multiplier>1&&!row.edited?`<small>${escapeHTML(row.quantity)} шт. × ${row.multiplier} сӯрох</small>`:''}</td><td>${money(row.priceCents)}</td><td><strong>${money(row.amountCents)}</strong></td></tr>`).join('')}</tbody></table></div><div class="estimate-total"><span>Итого по смете</span><strong>${money(estimate.totalCents)} с</strong></div>`:'<p>Конструктор ещё не добавил услуги в раскрой.</p>'}
 ${estimate.excluded.length?'<p class="estimate-note">Материалы и фурнитура учитываются отдельно в накладной; их стоимость не входит в сумму услуг.</p>':''}
 <div class="estimate-actions"><button type="button" class="secondary" id="refreshEstimate">Обновить смету</button><button type="button" class="secondary" id="editServicePrices">Нархнома / цены услуг</button></div><div id="servicePriceEditor"></div><div id="estimateRowEditor"></div>${editing?'<button type="button" class="secondary" id="finishEstimateEdit">Закончить редактирование</button>':''}`;
 $('#editEstimate').onclick=()=>{if($('#estimateRowForm')){showToast('Сохраните или отмените текущую позицию');return}renderEstimate(estimate,drawingReady,true)};$('#addEstimate').onclick=()=>{host.querySelector('.estimate-menu').open=false;showEstimateRowEditor(estimate)};if($('#finishEstimateEdit'))$('#finishEstimateEdit').onclick=()=>{if($('#estimateRowForm')){showToast('Сохраните или отмените текущую позицию');return}renderEstimate(estimate,drawingReady)};host.querySelectorAll('[data-estimate-index]').forEach(button=>button.onclick=()=>showEstimateRowEditor(estimate,estimate.rows[Number(button.dataset.estimateIndex)]));
 $('#refreshEstimate').onclick=()=>refreshEstimate();$('#editServicePrices').onclick=()=>editServicePrices(estimate.orderId);
}
async function refreshEstimate(){
 const id=selectedId,host=$('#estimateSection');if(!host||department!=='Менеджер'||$('#servicePricesForm')||$('#estimateRowForm')||$('#finishEstimateEdit'))return;
 const button=$('#refreshEstimate');if(button)button.disabled=true;
 try{const response=await fetch(`/api/estimates?id=${encodeURIComponent(id)}`,{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error);if(selectedId===id&&host===$('#estimateSection'))renderEstimate(result);}
 catch(error){showToast(error.message||'Не удалось обновить смету');}
 finally{if(button)button.disabled=false;}
}
async function editServicePrices(orderId){
 const host=$('#servicePriceEditor');if(!host)return;
 host.innerHTML='<p>Загрузка нархнома…</p>';
 try {
 const response=await fetch('/api/service-prices',{cache:'no-store'}),result=await response.json();if(!response.ok)throw new Error(result.error);
 if(selectedId!==orderId||host!==$('#servicePriceEditor'))return;
 host.innerHTML=`<form id="servicePricesForm"><h4>Нархнома</h4><p>Изменённые цены применяются ко всем сметам услуг.</p>${result.prices.map(p=>`<label class="service-price-row"><span>${escapeHTML(p.type)}<small>За 1 ${escapeHTML(p.unit)}${p.multiplier>1?` · ${p.multiplier} сӯрох на 1 шт.`:''}</small></span><input type="text" inputmode="decimal" aria-label="Цена: ${escapeHTML(p.type)}" value="${money(p.priceCents)}" data-type="${escapeHTML(p.type)}" required></label>`).join('')}<p class="error" role="alert"></p><div class="estimate-actions"><button type="submit" class="primary">Сохранить нархнома</button><button type="button" class="secondary" id="cancelServicePrices">Отмена</button></div></form>`;
 $('#cancelServicePrices').onclick=()=>host.replaceChildren();
 $('#servicePricesForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;
 try{const prices=[...form.querySelectorAll('input[data-type]')].map(input=>{const value=input.value.trim().replace(',','.');if(!/^\d+(?:\.\d{1,2})?$/.test(value))throw new Error('Введите цену с точностью до двух знаков');const priceCents=Math.round(Number(value)*100);if(priceCents>100000000)throw new Error('Цена слишком большая');return {type:input.dataset.type,priceCents}});
 const saved=await fetch('/api/service-prices',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({prices})});const payload=await saved.json();if(!saved.ok)throw new Error(payload.error);host.replaceChildren();await refreshEstimate();showToast('Нархнома сохранена. Смета пересчитана');
 }catch(error){form.querySelector('.error').textContent=error.message;}finally{button.disabled=false;}};
 }catch(error){if(host===$('#servicePriceEditor'))host.textContent=error.message;}
}
setInterval(()=>{if(department==='Менеджер'&&selectedId&&!document.hidden&&$('#orderSheet').classList.contains('open'))refreshEstimate();},60000);

function renderManagerReceipt(section,items,orderId){
 const materials=items.filter(isReceivable),acceptedCount=materials.filter(item=>item.receivedAt&&item.received>0&&item.condition==='Принято').length;
 const title=item=>item.type.replace(/^Распил /,'').replace(/ (?:5|6|3,4)м²$/,'').replace(/^Кромкование/,'Кромка');
 const state=item=>!item.receivedAt?{label:'Не принято',className:'wait'}:Number(item.received)===0?{label:'Не привезли',className:'late'}:item.condition==='Принято'?{label:'Принято',className:'done'}:{label:item.condition||'Есть проблема',className:'late'};
 section.innerHTML=`<details class="manager-receipt"><summary><strong>Листы и кромка</strong><span>${acceptedCount} из ${materials.length} принято</span><i aria-hidden="true">⌄</i></summary><div class="manager-receipt-body">${materials.length?materials.map(item=>{const status=state(item);return `<details class="manager-receipt-item"><summary><strong>${escapeHTML(title(item))}${item.description?' · '+escapeHTML(item.description):''}</strong><span class="badge ${status.className}">${escapeHTML(status.label)}</span></summary><div class="manager-receipt-info"><p>${item.thickness?'Толщина: '+escapeHTML(item.thickness)+' · ':''}Количество: ${escapeHTML(item.planned)} ${escapeHTML(cuttingUnits[item.type]||'лист')} · Получено: ${item.receivedAt?escapeHTML(item.received):'—'}</p>${item.note?`<p>Причина: ${escapeHTML(item.note)}</p>`:''}${item.receivedAt?`<small>Проверено производством: ${escapeHTML(item.receivedAt)} UTC</small>`:''}${item.photoKey?`<details class="material-photo-details" data-photo-url="/api/material-photo?orderId=${encodeURIComponent(orderId)}&itemId=${item.id}"><summary>Фото повреждения</summary><img alt="Фото повреждения материала" loading="lazy"></details>`:''}</div></details>`}).join(''):'<p>Листы и кромка пока не добавлены.</p>'}</div></details>`;
 section.querySelectorAll('.material-photo-details').forEach(details=>details.ontoggle=()=>{if(details.open){const img=details.querySelector('img');if(!img.getAttribute('src'))img.src=details.dataset.photoUrl}});
}

function showEstimateRowEditor(estimate,row=null){
 if($('#estimateRowForm')){showToast('Сохраните или отмените текущую позицию');return}
 const host=$('#estimateRowEditor');if(!host)return;
 const fromCutting=row?.rowId?.startsWith('material:'),units=['шт.','лист','м²','п.м.','сверление','уп.'];
 host.innerHTML=`<form id="estimateRowForm" class="material-add"><h4>${row?'Изменить позицию':'Добавить позицию в смету'}</h4><label>Наименование<input name="type" value="${escapeHTML(row?.type||'')}" maxlength="120" ${fromCutting?'readonly':''} required></label><label>Описание<input name="description" value="${escapeHTML(row?.description||'')}" maxlength="500"></label><label>Единица расчёта<select name="unit" ${fromCutting?'disabled':''}>${units.map(unit=>`<option ${row?.unit===unit?'selected':''}>${unit}</option>`).join('')}</select></label><label>Количество ${fromCutting?'('+escapeHTML(row.unit)+')':''}<input name="quantity" type="text" inputmode="decimal" value="${row?.billableQuantity??''}" placeholder="Например: 25,6" required></label><label>Цена за единицу, сомони<input name="price" type="text" inputmode="decimal" value="${row?money(row.priceCents):''}" required></label><p>Изменения относятся только к смете этого заказа. Раскрой и общая нархнома сохраняются отдельно.</p><p class="error" role="alert"></p><div class="estimate-actions"><button type="submit" class="primary">Сохранить</button><button type="button" class="secondary" id="cancelEstimateRow">Отмена</button></div></form>`;
 $('#estimateRowForm').dataset.initialValues=materialFormValues($('#estimateRowForm'));
 $('#cancelEstimateRow').onclick=()=>host.replaceChildren();
 $('#estimateRowForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;form.dataset.saving='true';
 try{
 const decimal=value=>{const normalized=value.trim().replace(',','.');if(!/^\d+(?:\.\d+)?$/.test(normalized))throw new Error('Введите корректное количество и цену');return Number(normalized)};
 const quantity=decimal(form.elements.quantity.value),priceText=form.elements.price.value.trim().replace(',','.');if(!/^\d+(?:\.\d{1,2})?$/.test(priceText))throw new Error('В цене допускаются два знака после запятой');
 const priceCents=Math.round(Number(priceText)*100),payload={orderId:estimate.orderId,rowId:row?.rowId,type:form.elements.type.value.trim(),description:form.elements.description.value.trim(),quantity,unit:fromCutting?row.unit:form.elements.unit.value,priceCents};
 const response=await fetch('/api/estimates',{method:row?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error);if(selectedId===estimate.orderId&&host===$('#estimateRowEditor'))renderEstimate(result.estimate);showToast('Смета сохранена');
 }catch(error){form.querySelector('.error').textContent=error.message;}finally{button.disabled=false;form.dataset.saving='false';}};
 host.scrollIntoView({behavior:'smooth',block:'center'});
}
