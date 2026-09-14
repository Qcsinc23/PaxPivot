/**
 * Request-shape checks shared by every POST route handler (TASK-046): same-origin enforcement
 * beyond `SameSite=Lax`, and a body-size ceiling applied before a handler ever calls
 * `formData()`. Used by `/auth/session`, `/auth/logout` and `/trips/new`; none of the three
 * needs anything the other two don't.
 */

export type GuardFailure = { response: Response };

function forbidden(): Response {
  return new Response("Forbidden", { status: 403 });
}

function tooLarge(): Response {
  return new Response("Payload too large", { status: 413 });
}

/**
 * Reject a cross-site POST. Two independent checks, either of which can refuse the request —
 * not a fallback chain — so a request cannot pass by satisfying only whichever header this
 * function happened to look at first:
 *
 * 1. `Sec-Fetch-Site`, sent by every current Chrome/Firefox/Safari and impossible for page
 *    script to set or override (it is a forbidden header name for `fetch`/`XMLHttpRequest`):
 *    when present, anything but `same-origin` (the real form) or `none` (a user-typed or
 *    bookmarked navigation — never script-initiated) is rejected outright.
 * 2. `Origin`, when present, must have the same host as the request's own `Host` header.
 *    Traefik forwards the original `Host` unchanged (`passHostHeader` defaults to true; see
 *    `deploy/compose.traefik.yml`, one hop from the client), so it is the request's own idea of
 *    its host and safe to trust here without an `X-Forwarded-Host` lookup.
 *
 * A real browser sets both consistently, so a legitimate same-origin request always passes
 * both; checking them independently only matters against a non-browser client that supplies
 * one correctly and forges the other.
 *
 * When *both* headers are absent, the request is allowed through the rest of this check: a
 * script cannot make a cross-site POST while stripping `Sec-Fetch-Site` (browsers set it
 * unconditionally on fetch/form submissions) or `Origin` (also set unconditionally on POST), so
 * a request with neither is not a browser cross-site forgery — it is a non-browser client, and
 * SameSite=Lax already keeps a stray browser session cookie off of it regardless.
 */
export function checkSameOrigin(request: Request): GuardFailure | null {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (
    secFetchSite !== null &&
    secFetchSite !== "same-origin" &&
    secFetchSite !== "none"
  ) {
    return { response: forbidden() };
  }
  const origin = request.headers.get("origin");
  if (origin !== null) {
    let originHost: string;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return { response: forbidden() };
    }
    const host = (request.headers.get("host") ?? "").toLowerCase();
    if (originHost !== host) return { response: forbidden() };
  }
  return null;
}

/**
 * Reject a request whose declared size is missing or exceeds `maxBytes`, before any handler
 * reads the body. `Content-Length` is what every real form POST carries (browsers always send
 * it for a known-length `application/x-www-form-urlencoded` body); a request that omits it —
 * whether a bare `fetch` with a streamed/chunked body or a client trying to hide its size — is
 * refused rather than trusted, since a missing declaration also disables Next's own body
 * handling from bounding the read.
 */
export function checkBodySize(
  request: Request,
  maxBytes: number,
): GuardFailure | null {
  const declared = request.headers.get("content-length");
  if (declared === null) return { response: tooLarge() };
  const length = Number(declared);
  if (!Number.isInteger(length) || length < 0 || length > maxBytes) {
    return { response: tooLarge() };
  }
  return null;
}
