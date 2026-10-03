"use client";
import { useEffect, useState } from "react";
import { ClientGate } from "../client-gate";
import { type SavedOrder } from "../saved-orders";
import { ClientNav, type ClientTab } from "../client-nav";

type Summary = { id: string; product: string; status: string; progress: number; deadline: string | null };
type Listed = { saved: SavedOrder; order?: Summary; unavailable?: boolean };
const completed = (status?: string) => status === "Заказ забрали";

export default function SavedOrdersPage(){return <ClientGate><OrdersContent/></ClientGate>}
function OrdersContent() {
  const [items, setItems] = useState<Listed[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [view, setView] = useState<ClientTab>("active");

  useEffect(() => {
    let active = true;
    const requested = new URLSearchParams(window.location.search).get("view");
    if (requested === "completed" || requested === "settings") setView(requested);
    const token = new URLSearchParams(window.location.search).get("t") || "";
    setToken(token);
    fetch('/api/client-orders',{cache:'no-store'}).then(async response=>{if(!response.ok)throw Error('Не удалось загрузить заказы');return response.json() as Promise<{items:{token:string;order:Summary}[]}>}).then(data=>{if(active){setItems(data.items.map((item:{token:string;order:Summary})=>({saved:{token:item.token,id:item.order.id,product:item.order.product,savedAt:Date.now()},order:item.order})));setLoading(false)}}).catch(()=>{if(active)setLoading(false)});
    return () => { active = false; };
  }, []);

  const visible = items.filter(item => view === "completed" ? completed(item.order?.status) : !completed(item.order?.status));
  return <main className="shell with-client-nav">
    <header><div><strong>JEVON</strong><span>Статус заказов</span></div></header>
    {view === "settings" ? <><section className="card saved-heading"><h1>Настройки</h1><p>Доступ к вашим заказам защищён телефоном и паролем.</p></section><section className="card client-settings"><h2>Мои заказы</h2><p>Здесь собраны заказы, оформленные на ваш номер телефона.</p><button className="client-logout" onClick={async()=>{await fetch("/api/client-auth",{method:"DELETE"});location.reload()}}>Выйти из кабинета</button></section></> : <>
    <section className="card saved-heading"><h1>{view === "completed" ? "Завершённые заказы" : "Активные заказы"}</h1><p>{view === "completed" ? "Заказы, которые вы уже забрали." : "Заказы в работе и готовые к выдаче."}</p></section>
    {loading ? <section className="card"><p>Загружаем заказы…</p></section> : visible.length ? <div className="saved-list">{visible.map(({saved, order, unavailable}) => <article className="card saved-card" key={saved.token}>
      <div className="saved-card-title"><div><span className="eyebrow">Заказ № {saved.id}</span><h2>{order?.product || saved.product || "Заказ JEVON"}</h2></div><span className={`saved-status ${completed(order?.status) ? "ready" : ""}`}>{order?.status || (unavailable ? "Недоступен" : "Загрузка")}</span></div>
      {order && <><div className="progress-label"><span>Готовность</span><strong>{order.progress}%</strong></div><div className="bar"><i style={{width:`${order.progress}%`}} /></div><p className="saved-date">Срок проекта: {order.deadline ? order.deadline.split("-").reverse().join(".") : "Не назначен"}</p></>}
      <div className="saved-actions"><a href={`/?t=${encodeURIComponent(saved.token)}`}>Открыть заказ</a></div>
    </article>)}</div> : <section className="card empty-saved"><h2>{view === "completed" ? "Завершённых заказов пока нет" : "Активных заказов пока нет"}</h2><p>{items.length ? "Когда статус заказа изменится, он автоматически появится в нужном разделе." : "Откройте личную ссылку, которую отправил менеджер JEVON. Заказ появится здесь автоматически."}</p></section>}
    <p className="hint">Показаны только заказы, оформленные на ваш телефон.</p>
    </>}
    <ClientNav current={view} token={token} />
  </main>;
}
