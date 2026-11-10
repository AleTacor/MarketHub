import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @param {string} phase */
export default function nextConfig(phase) {
  /** @type {import('next').NextConfig} */
  const config = {
    // The shared package ships TypeScript source.
    transpilePackages: ["@markethub/shared"],
    reactStrictMode: true,
    // Pin the workspace root so Next doesn't pick up lockfiles outside the repo.
    outputFileTracingRoot: monorepoRoot,
  };

  if (phase === PHASE_DEVELOPMENT_SERVER) {
    // `pnpm dev` runs without nginx, so Next proxies the backend paths itself.
    // In Docker nginx routes these paths before they reach Next, so these never match there.
    const auth = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";
    const shop = process.env.SHOP_SERVICE_URL ?? "http://localhost:4002";
    config.rewrites = async () => [
      { source: "/api/auth/:path*", destination: `${auth}/api/auth/:path*` },
      { source: "/api/:path*", destination: `${shop}/api/:path*` },
      { source: "/uploads/:path*", destination: `${shop}/uploads/:path*` },
    ];
  }

  return config;
}
