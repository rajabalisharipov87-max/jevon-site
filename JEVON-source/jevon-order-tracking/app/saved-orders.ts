export type SavedOrder = { token: string; id: string; product: string; savedAt: number };

const storageKey = "jevon_customer_orders_v1";
const tokenPattern = /^[a-f0-9]{48}$/;

export function getSavedOrders(token: string): SavedOrder[] {
  if (!tokenPattern.test(token)) return [];
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is SavedOrder => entry && tokenPattern.test(entry.token) && /^\d{2}\/\d{3}$/.test(entry.id))
      .filter(entry => entry.token === token).slice(0, 1);
  } catch { return []; }
}

export function saveOrder(token: string, id: string, product: string) {
  if (!tokenPattern.test(token) || !/^\d{2}\/\d{3}$/.test(id)) return;
  try {
    const previous: SavedOrder[] = [];
    localStorage.setItem(storageKey, JSON.stringify([{ token, id, product, savedAt: Date.now() }, ...previous].slice(0, 30)));
  } catch { /* Private browsing may disallow storage; the personal link still works. */ }
}
