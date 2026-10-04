import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev mode blocks HMR for pages opened by LAN address (e.g. a kiosk tablet).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  ...(process.env.JEVON_LOCAL === "1" ? {
    turbopack: { resolveAlias: { "cloudflare:workers": "./scripts/postgres-storage.mjs" } },
  } : {}),
};

export default nextConfig;
