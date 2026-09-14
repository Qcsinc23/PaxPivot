import { NextResponse } from "next/server";
import {
  clientKey,
  failureDelayMs,
  loginRateLimiter,
} from "@/lib/auth/rate-limit";
import { accessConfig } from "@/lib/auth/config";
import { redirectTo, safeNextPath } from "@/lib/auth/guard";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  issueSession,
  timingSafeEqual,
} from "@/lib/auth/session";
import { checkBodySize, checkSameOrigin } from "@/lib/http/request-guards";

/** `failureDelayMs`'s real values, skipped only in tests so they run instantly. */
const TEST_ENV = process.env.NODE_ENV === "test";
/** A passphrase plus its hidden `next` path never approaches this; see TASK-046. */
const BODY_LIMIT_BYTES = 8 * 1024;

/** POST passphrase → signed HttpOnly session cookie → redirect. Never echoes the input. */
export async function POST(request: Request) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure.response;
  const sizeFailure = checkBodySize(request, BODY_LIMIT_BYTES);
  if (sizeFailure) return sizeFailure.response;

  const config = accessConfig();
  if (config.mode !== "configured") {
    return new NextResponse("Sign-in is not available.", { status: 503 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }
  const passphrase = String(form.get("passphrase") ?? "");
  const next = safeNextPath(form.get("next"));
  const key = clientKey(request);
  const now = Date.now();
  // Always compare in constant time, before any rate-limit decision, so nothing about a later
  // block is observable through the compare's own timing (TASK-046 review).
  const validPassphrase = timingSafeEqual(passphrase, config.passphrase);
  // Only the per-client cap can refuse a correct passphrase; the global ceiling below only ever
  // slows down a wrong one (see lib/auth/rate-limit.ts for why a blocking global ceiling is a
  // denial-of-service against the pilot's one legitimate user).
  const clientBlocked = loginRateLimiter.isClientBlocked(key, now);
  if (clientBlocked || !validPassphrase) {
    let delayMs = failureDelayMs(false);
    if (!clientBlocked) {
      // A client already at its own cap doesn't need to keep inflating the global counter.
      const globalThrottled = loginRateLimiter.recordFailure(key, now);
      delayMs = failureDelayMs(globalThrottled);
    }
    await new Promise((resolve) => setTimeout(resolve, TEST_ENV ? 0 : delayMs));
    return redirectTo(`/login?error=1&next=${encodeURIComponent(next)}`);
  }
  loginRateLimiter.recordSuccess(key);
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: next, "Cache-Control": "no-store" },
  });
  response.cookies.set(
    SESSION_COOKIE,
    await issueSession(config.sessionSecret),
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        new URL(request.url).protocol === "https:" ||
        process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    },
  );
  return response;
}
