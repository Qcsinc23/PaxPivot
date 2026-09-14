import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { checkBodySize, checkSameOrigin } from "@/lib/http/request-guards";

/** The real logout form carries no fields; this only bounds a forged/streamed body. */
const BODY_LIMIT_BYTES = 8 * 1024;

/** Clears the session cookie with the same attributes it was set with, then returns to sign-in. */
export async function POST(request: Request) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure.response;
  const sizeFailure = checkBodySize(request, BODY_LIMIT_BYTES);
  if (sizeFailure) return sizeFailure.response;

  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/login", "Cache-Control": "no-store" },
  });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure:
      new URL(request.url).protocol === "https:" ||
      process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
