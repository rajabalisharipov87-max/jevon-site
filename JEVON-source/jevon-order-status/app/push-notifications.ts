import { env } from "cloudflare:workers";

const settings = () => env as unknown as { PUSH_PUBLIC_KEY?: string; PUSH_PRIVATE_JWK?: string };
const encode = (data: string | Uint8Array) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const allowedPushHost = (endpoint: string) => {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && url.username === "" && url.password === "" && !url.port && endpoint.length < 2048 &&
      (url.hostname === "fcm.googleapis.com" || url.hostname === "updates.push.services.mozilla.com" || url.hostname === "web.push.apple.com" || url.hostname === "push.services.mozilla.com");
  } catch { return false; }
};

export async function ensurePushTable() {
  await env.DB!.prepare("CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, role_code TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
}

export async function notifyRoles(roles: string[]) {
  const { PUSH_PUBLIC_KEY, PUSH_PRIVATE_JWK } = settings();
  if (!PUSH_PUBLIC_KEY || !PUSH_PRIVATE_JWK || !roles.length) return;
  try {
    await ensurePushTable();
    const unique = [...new Set(roles)];
    const placeholders = unique.map(() => "?").join(",");
    const { results } = await env.DB!.prepare(`SELECT endpoint FROM push_subscriptions WHERE role_code IN (${placeholders}) LIMIT 100`).bind(...unique).all<{ endpoint: string }>();
    if (!results.length) return;
    const key = await crypto.subtle.importKey("jwk", JSON.parse(PUSH_PRIVATE_JWK), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    await Promise.allSettled(results.map(async ({ endpoint }) => {
      if (!allowedPushHost(endpoint)) return;
      const origin = new URL(endpoint).origin;
      const header = encode(JSON.stringify({ typ: "JWT", alg: "ES256" }));
      const payload = encode(JSON.stringify({ aud: origin, exp: Math.floor(Date.now() / 1000) + 3600, sub: "mailto:rajabalisharipov87@gmail.com" }));
      const unsigned = `${header}.${payload}`;
      const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned)));
      const response = await fetch(endpoint, { method: "POST", headers: { "Authorization": `vapid t=${unsigned}.${encode(signature)}, k=${PUSH_PUBLIC_KEY}`, "TTL": "3600", "Content-Length": "0" }, body: "", signal: AbortSignal.timeout(3500) });
      if (response.status === 404 || response.status === 410) await env.DB!.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint).run();
      else if (!response.ok) console.warn("Push service rejected a notification", response.status);
    }));
  } catch (error) { console.warn("Push delivery failed", error); }
}

export { allowedPushHost };
