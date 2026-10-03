import { env } from "cloudflare:workers";

const roles: Record<string, { department: string; name?: string; group?: string }> = {
  "1001": { department: "Начальник цеха" },
  "1101": { department: "Менеджер" },
  "2202": { department: "Производство" },
  "3303": { department: "Снабжение" },
  "5505": { department: "Конструктор", name: "Далер", group: "1" },
  "6606": { department: "Конструктор", name: "Умед", group: "2" },
  "7707": { department: "Конструктор", name: "Озод", group: "3" },
  "8808": { department: "Конструктор", name: "Анвар", group: "4" },
};

const secret = () => (env as unknown as { BRIDGE_SECRET?: string }).BRIDGE_SECRET;
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function signature(payload: string) {
  const key = secret();
  if (!key) throw new Error("Session signing secret missing");
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return encode(new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(payload))));
}

export const roleFor = (code: string) => roles[code] ?? null;
export async function makeSession(code: string) {
  const expiry = Math.floor(Date.now() / 1000) + 12 * 3600;
  const payload = `${code}.${expiry}`;
  return `${payload}.${await signature(payload)}`;
}
export async function getRoleCode(request: Request): Promise<string | null> {
  const token = request.headers.get("Cookie")?.match(/(?:^|;\s*)jevon_role=([^;]+)/)?.[1];
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !roleFor(parts[0]) || !/^\d+$/.test(parts[1]) || Number(parts[1]) < Date.now() / 1000) return null;
  const expected = await signature(`${parts[0]}.${parts[1]}`);
  if (parts[2].length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ parts[2].charCodeAt(i);
  return mismatch === 0 ? parts[0] : null;
}
