import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.JEVON_LOCAL === "1" ? {
    turbopack: { resolveAlias: { "cloudflare:workers": "./scripts/postgres-storage.mjs" } },
  } : {}),
};

export default nextConfig;
