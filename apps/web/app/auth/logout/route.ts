import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

/** Clears the session cookie with the same attributes it was set with, then returns to sign-in. */
export async function POST(request: Request) {
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
