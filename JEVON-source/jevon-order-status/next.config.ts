import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev mode blocks HMR for pages opened by LAN address (e.g. a kiosk tablet).
  // Extra hosts (e.g. a public IP) come from DEV_ORIGINS, comma-separated.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", ...(process.env.DEV_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean)],
  ...(process.env.JEVON_LOCAL === "1" ? {
    turbopack: { resolveAlias: { "cloudflare:workers": "./scripts/postgres-storage.mjs" } },
  } : {}),
};

export default nextConfig;
