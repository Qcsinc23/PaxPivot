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
 * 2. `Origin`, when present, must have the same host *and* scheme as the request's own
 *    effective origin: host is compared against the `Host` header, and scheme against
 *    `X-Forwarded-Proto` when present, else the request URL's own protocol. `Host` is what
 *    Traefik forwards unchanged (`passHostHeader` defaults to true and nothing in
 *    `deploy/compose.traefik.yml` overrides it) one hop from the client — the same single-hop,
 *    no-CDN topology verified live for `clientKey()` in `lib/auth/rate-limit.ts` (2026-09-14) —
 *    so trusting it here needs no separate `X-Forwarded-Host` lookup. Comparing only the host
 *    and not the scheme would let `Origin: http://<host>` pass against an `https` request.
 *
 * A real browser sets both headers, and both parts of `Origin`, consistently, so a legitimate
 * same-origin request always passes; checking them independently only matters against a
 * non-browser client that supplies one correctly and forges the rest.
 *
 * When *both* `Sec-Fetch-Site` and `Origin` are absent, the request is allowed through the rest
 * of this check: a script cannot make a cross-site POST while stripping `Sec-Fetch-Site`
 * (browsers set it unconditionally on fetch/form submissions) or `Origin` (also set
 * unconditionally on POST), so a request with neither is not a browser cross-site forgery — it
 * is a non-browser client, and SameSite=Lax already keeps a stray browser session cookie off of
 * it regardless.
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
    let originUrl: URL;
    try {
      originUrl = new URL(origin);
    } catch {
      return { response: forbidden() };
    }
    const host = (request.headers.get("host") ?? "").toLowerCase();
    const originHost = originUrl.host.toLowerCase();
    const originScheme = originUrl.protocol.replace(":", "").toLowerCase();
    if (originHost !== host || originScheme !== effectiveScheme(request)) {
      return { response: forbidden() };
    }
  }
  return null;
}

/** `X-Forwarded-Proto` when Traefik set one, else the request URL's own protocol. */
function effectiveScheme(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0]!.trim().toLowerCase();
  }
  try {
    return new URL(request.url).protocol.replace(":", "").toLowerCase();
  } catch {
    return "";
  }
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
