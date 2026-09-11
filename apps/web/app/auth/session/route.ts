import { NextResponse } from "next/server";
import { accessConfig } from "@/lib/auth/config";
import { redirectTo, safeNextPath } from "@/lib/auth/guard";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  issueSession,
  timingSafeEqual,
} from "@/lib/auth/session";

const FAILURE_DELAY_MS = process.env.NODE_ENV === "test" ? 0 : 500;

/** POST passphrase → signed HttpOnly session cookie → redirect. Never echoes the input. */
export async function POST(request: Request) {
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
  if (!timingSafeEqual(passphrase, config.passphrase)) {
    // A fixed per-request delay slows sequential guessing and equalises timing across failure kinds.
    await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
    return redirectTo(`/login?error=1&next=${encodeURIComponent(next)}`);
  }
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
