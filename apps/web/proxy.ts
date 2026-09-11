import { NextResponse, type NextRequest } from "next/server";
import { guard } from "@/lib/auth/guard";
import { SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Every request to a private route passes the pilot access guard (ADR-005): a valid session
 * cookie continues, an anonymous request is sent to `/login`, and a misconfigured production
 * deployment is refused outright rather than served open. Never logs the cookie.
 */
export async function proxy(request: NextRequest) {
  const decision = await guard(
    request.nextUrl.pathname,
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (decision.action === "allow") return NextResponse.next();
  if (decision.action === "refuse") {
    return new NextResponse("PaxPivot is not configured for access.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  // Next requires an absolute Location from the proxy; `request.url` carries the host the
  // reverse proxy forwarded, so no host is guessed. Route handlers may answer relatively.
  const next = decision.next + request.nextUrl.search;
  const login = new URL(`/login?next=${encodeURIComponent(next)}`, request.url);
  return NextResponse.redirect(login, 307);
}
