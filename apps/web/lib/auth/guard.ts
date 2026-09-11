/**
 * The human → web application boundary (ADR-005), as a pure decision the proxy applies.
 * Distinct from the web server → API boundary (`lib/api/client.ts`, bearer token, server-only).
 */
import { accessConfig, type AccessConfig } from "./config";
import { verifySession } from "./session";

export type GuardDecision =
  | { action: "allow" }
  | { action: "login"; next: string }
  | { action: "refuse"; reason: string };

/** Paths that must work without a session: the login flow and Next's own assets. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

/** A same-origin redirect: a relative `Location`, so no host is ever guessed behind a proxy. */
export function redirectTo(path: string, status: 303 | 307 = 303): Response {
  return new Response(null, {
    status,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}

/**
 * Only a same-origin path may be a post-login destination. Resolved through the URL parser
 * against a sentinel origin, so browser quirks (`/\\evil`, tab/newline stripping, `//evil`)
 * cannot escape; a non-string (repeated query key) falls back to `/`.
 */
export function safeNextPath(candidate: unknown): string {
  if (typeof candidate !== "string" || !candidate.startsWith("/")) return "/";
  const url = new URL(candidate, "http://local.invalid");
  if (url.origin !== "http://local.invalid") return "/";
  return url.pathname + url.search;
}

export async function guard(
  pathname: string,
  sessionCookie: string | undefined,
  config: AccessConfig = accessConfig(),
  now: Date = new Date(),
): Promise<GuardDecision> {
  if (isPublicPath(pathname)) return { action: "allow" };
  if (config.mode === "development_open") return { action: "allow" };
  if (config.mode === "misconfigured")
    return { action: "refuse", reason: config.reason };
  if (await verifySession(config.sessionSecret, sessionCookie, now))
    return { action: "allow" };
  return { action: "login", next: pathname };
}
