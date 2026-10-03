"use client";
import { useEffect, useState } from "react";
import { ClientGate } from "./client-gate";
import { saveOrder } from "./saved-orders";
import { ClientNav } from "./client-nav";

type Stage = { name: string; status: string };
type Order = { id: string; product: string; deadline: string | null; status: string; progress: number; receiptStatus?: string | null; drawingUrl?: string | null; photoAvailable?: boolean; stages: Stage[] };

export default function Home(){return <ClientGate><OrderHome/></ClientGate>}
function OrderHome() {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [shareToken, setShareToken] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("t");
    if (!token) { window.location.replace("/orders"); return; }
    setShareToken(token);
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/order?t=${encodeURIComponent(token)}`, { cache: "no-store" });
        if(response.status===401||response.status===404){window.location.replace("/orders");return}
        const result = await response.json() as { error?: string; order?: Order };
        if (!response.ok) throw new Error(result.error || "Не удалось загрузить заказ");
        if (active && result.order) { saveOrder(token, result.order.id, result.order.product); setOrder(result.order); setError(""); }
      } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : "Не удалось загрузить заказ"); }
      finally { if (active) setLoading(false); }
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const date = order?.deadline ? order.deadline.split("-").reverse().join(".") : "Не назначен";
  const startedStages = order?.stages.filter(stage => stage.status === "Готово" || stage.status === "В работе") || [];
  const nextStage = startedStages.length ? order?.stages.find(stage => stage.status === "Требуется") : undefined;
  const visibleStages = nextStage ? [...startedStages, { ...nextStage, status: "В очереди" }] : startedStages;
  return <main className="shell with-client-nav">
    <header><div><strong>JEVON</strong><span>Мой заказ</span></div><a className="all-orders-link" href={`/orders?t=${encodeURIComponent(shareToken)}`}>Мои заказы</a></header>
    {loading ? <section className="card"><p>Загружаем заказ…</p></section> : error && !order ? <section className="card"><h1>Заказ не найден</h1><p>{error}</p></section> : order && <>
      <section className="card overview"><span className="eyebrow">Ход выполнения заказа</span><h1>Заказ № {order.id}</h1><p className="product">{order.product}</p>
        <div className="facts"><div><small>Текущий статус</small><strong className="state">{order.status}</strong></div><div><small>Срок проекта</small><strong>{date}</strong></div></div>
        <div className="progress-label"><span>Готовность</span><strong>{order.progress}%</strong></div>
        <div className="stage-indicator" role="group" aria-label="Готовность этапов заказа">{order.stages.map(stage => {
          const state = stage.status === "Готово" ? "complete" : stage.status === "В работе" ? "current" : stage.status === "Не требуется" ? "skipped" : nextStage?.name === stage.name ? "upcoming" : "pending";
          const label = stage.name === "Конструктор" ? "Чертёж" : stage.name;
          const status = state === "upcoming" ? "В очереди" : stage.status === "Требуется" ? "Ещё не начат" : stage.status;
          return <div className={`indicator-step ${state}`} key={stage.name} aria-label={`${label}: ${status}`} title={`${label}: ${status}`}><span className="indicator-segment" /><span className="indicator-name">{label}</span></div>;
        })}</div>
        {order.receiptStatus && <div className={`receipt-status ${order.receiptStatus === "Листы приняты" ? "receipt-done" : ""}`}><span>Приёмка материалов</span><strong>{order.receiptStatus}</strong></div>}
        {order.drawingUrl && <a className="drawing-link" href={order.drawingUrl} target="_blank" rel="noopener noreferrer">Смотреть чертёж <span aria-hidden="true">↗</span></a>}
      </section>
      <section className="card"><h2>Этапы заказа</h2>{visibleStages.length ? <div className="stages">{visibleStages.map((stage, index) => <div className="stage" key={stage.name}><span className="step">{index + 1}</span><strong>{stage.name === "Конструктор" ? "Чертёж" : stage.name}</strong><span className={`pill ${stage.status === "Готово" ? "done" : stage.status === "В работе" ? "work" : "waiting"}`}>{stage.status}</span></div>)}</div> : <p className="next-stage">Скоро начнём ваш проект.</p>}</section>
      {order.photoAvailable && <details className="card finished-photo" onToggle={event => setPhotoOpen(event.currentTarget.open)}><summary>Фото готового заказа <span aria-hidden="true">⌄</span></summary>{photoOpen && shareToken && <img src={`/api/photo?t=${encodeURIComponent(shareToken)}`} alt={`Готовый заказ № ${order.id}`} referrerPolicy="no-referrer" />}</details>}
      <p className="hint">Информация обновляется автоматически. Если у вас есть вопрос, напишите менеджеру JEVON.</p>
      {error && <p className="error">Не удалось обновить информацию. Повторите попытку позже.</p>}
    </>}
    <ClientNav token={shareToken} />
  </main>;
}
