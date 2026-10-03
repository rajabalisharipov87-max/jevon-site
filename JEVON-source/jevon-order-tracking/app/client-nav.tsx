export type ClientTab = "active" | "completed" | "settings";

const links: { tab: ClientTab; label: string; icon: React.ReactNode }[] = [
  { tab: "active", label: "Активные заказы", icon: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></> },
  { tab: "completed", label: "Завершённые заказы", icon: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></> },
  { tab: "settings", label: "Настройки", icon: <><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/></> },
];

export function ClientNav({ current, token = "" }: { current?: ClientTab; token?: string }) {
  return <nav className="client-nav" aria-label="Разделы клиента">{links.map(({tab, label, icon}) => <a key={tab} href={`/orders?view=${tab}&t=${encodeURIComponent(token)}`} className={current === tab ? "active" : ""} aria-current={current === tab ? "page" : undefined}>
    <svg viewBox="0 0 24 24" aria-hidden="true">{icon}</svg><span>{label}</span>
  </a>)}</nav>;
}
