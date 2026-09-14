import { NextResponse } from "next/server";
import { clientKey, loginRateLimiter } from "@/lib/auth/rate-limit";
import { accessConfig } from "@/lib/auth/config";
import { redirectTo, safeNextPath } from "@/lib/auth/guard";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  issueSession,
  timingSafeEqual,
} from "@/lib/auth/session";
import { checkBodySize, checkSameOrigin } from "@/lib/http/request-guards";

const FAILURE_DELAY_MS = process.env.NODE_ENV === "test" ? 0 : 500;
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
  // A client already at its own cap or the process-wide cap is refused without a compare: the
  // outcome is identical to a wrong passphrase, so nothing about the block is observable.
  const blocked = loginRateLimiter.isBlocked(key, now);
  const validPassphrase =
    !blocked && timingSafeEqual(passphrase, config.passphrase);
  if (!validPassphrase) {
    if (!blocked) loginRateLimiter.recordFailure(key, now);
    // A fixed per-request delay slows sequential guessing and equalises timing across failure kinds.
    await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
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
