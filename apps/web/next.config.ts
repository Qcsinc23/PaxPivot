import { resolve } from "node:path";
import type { NextConfig } from "next";

/** Hardening headers for every response; HSTS is ignored by browsers over plain HTTP, so it is safe locally. */
export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const config: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  // Self-contained server for the container image (apps/web/Dockerfile).
  output: "standalone",
  // Builds run from apps/web (`pnpm --filter web build`); the workspace root holds the lockfile.
  outputFileTracingRoot: resolve(process.cwd(), "../.."),
  async headers() {
    return [{ source: "/(.*)", headers: [...SECURITY_HEADERS] }];
  },
};
export default config;
