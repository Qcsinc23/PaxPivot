# ADR-005 — Pilot access boundary: human → web, web → API

## Status

Accepted — foundation-agent decision under TASK-027; 2026-09-11.

## Context

ADR-004 added a server-to-server bearer credential (`PAXPIVOT_API_TOKEN`) between the Next
server and the PaxPivot API. That is not human authentication: nothing stopped an anonymous
browser from loading `/terminals` on a deployed web server, which would then use its own token.
Pilot §16.1 requires private authenticated access only; PRD §14.7 deploys behind a reverse
proxy with TLS. The product is a single-user private pilot, so the smallest genuine boundary
is wanted — not a vendor identity platform, and not "the API token is the protection".

## Decision

Two boundaries, documented and enforced separately.

**Human → web application.** A passphrase sign-in with a signed session cookie, implemented in
the repository with WebCrypto only:

- `PAXPIVOT_PILOT_PASSPHRASE` (≥ 20 chars) is what the one pilot user types at `/login`;
  `POST /auth/session` compares it in constant time and sets `pp_session`, an
  `HttpOnly; SameSite=Lax; Secure` cookie holding `<issued-ms>.<HMAC-SHA256>` signed with
  `PAXPIVOT_SESSION_SECRET` (≥ 32 chars), valid 12 hours. `POST /auth/logout` clears it.
- `proxy.ts` (Next 16's request interception file) runs `lib/auth/guard.ts` on every request:
  public paths are `/login`, `/auth/*`, `/_next/*`, `/favicon.ico`; everything else needs a
  valid cookie or is redirected to `/login?next=<same-origin path>`.
- **Fail closed.** `lib/auth/config.ts` decides the mode from the environment: both secrets
  present and long enough → `configured`; in `NODE_ENV=production` anything less → `misconfigured`,
  and the proxy answers 503 "not configured for access" for every private route (the login page
  stays reachable and explains). Only outside production, with *both* secrets absent, is the app
  `development_open` — the local `make dev` experience.
- Pilot-only: one principal, no user table, no roles, no rate limiting beyond what the reverse
  proxy provides. Brute force is mitigated by passphrase length and TLS, not by the app.

**Web server → PaxPivot API.** Unchanged from ADR-004: `lib/api/client.ts::readApi` sends the
server-side bearer token from server components only and refuses to run in a browser; the API
denies every `/api/v1` request without it. This token never authenticates a human and never
reaches a client bundle (a test enforces that only `lib/api/client.ts` and `lib/auth/config.ts`
read secret variables; `make build` output is scanned in the task Handoff).

**Deployment assumption.** A TLS-terminating reverse proxy in front of the web server; the API
bound to the private network only. The web app's `Secure` cookie flag is set whenever the
request is HTTPS or `NODE_ENV=production`.

**Configuration failure is not absence (B1).** A missing `PAXPIVOT_API_URL`/`PAXPIVOT_API_TOKEN`
renders `components/shell/NotConfigured` — "PaxPivot data is not available right now. This is a
configuration problem, not evidence that no terminals or sources exist." — never an empty
registry. `401` and unreachable API remain "a failure on our side"; a `200 []` is the only
honest empty state; `404` on a terminal detail is Next's `notFound()`.

## Alternatives considered

Reverse-proxy basic auth alone: not enforced by the application, silently absent when the
proxy is misconfigured, and invisible to tests. A vendor identity provider or auth framework:
disproportionate for one user and adds a dependency and an external account to the trust
boundary. Reusing the API bearer token as the human credential: conflates the two boundaries
and would put a server secret in a browser. Per-user accounts/RBAC: not required by the pilot.

## Consequences

Every deployed private route is behind a session; production cannot run open. The pilot user
must set two secrets in the web server's environment (and the API token, as before). Replacing
the passphrase with real multi-user authentication later replaces `lib/auth/*` and the two
route handlers without touching pages or the API. Session revocation is by secret rotation.

## Contract impact

`apps/web/proxy.ts`; `apps/web/lib/auth/{config,session,guard}.ts`; `apps/web/app/login/page.tsx`;
`apps/web/app/auth/{session,logout}/route.ts`; `apps/web/components/shell/NotConfigured.tsx`;
`.env.example` documents `PAXPIVOT_API_URL`, `PAXPIVOT_API_TOKEN`, `PAXPIVOT_SESSION_SECRET`,
`PAXPIVOT_PILOT_PASSPHRASE`. No API or schema change.

## Verification

`apps/web/tests/auth.test.ts` (session sign/verify/tamper/expiry, fail-closed configuration,
guard matrix, proxy redirect/allow/refuse, sign-in cookie flags and rejection, secrets-scan);
live-route tests for `not_configured`; `make build` followed by a grep of `.next/static` for the
secret names (Handoff).

## Amendments

- **2026-09-11, TASK-030.** The product owner delegated the deployment decisions. The pilot is
  deployed behind the VPS's existing Traefik (TLS via its `letsencrypt` resolver) at
  `paxpivot.qcs-cargo.com` with this shared-passphrase boundary accepted for the single-user
  pilot; daily on-host database backups (30 days). Per-user authentication remains the gate
  before any multi-user use.

- **2026-09-14, TASK-046.** A security audit of the now-internet-facing pilot found that "brute
  force is mitigated by passphrase length and TLS, not by the app" (above) is no longer enough:
  nothing capped the *aggregate* cost of parallel guessing, only the existing fixed 500 ms
  per-request delay slowed a single sequential guesser. This amendment adds an application-level
  ceiling and two related hardenings, all within `apps/web`, no API or schema change, no Traefik
  middleware (Traefik is shared Dokploy-managed host infrastructure — TASK-046 is out of scope
  for touching it):

  - **Login rate limit** (`apps/web/lib/auth/rate-limit.ts`). An in-memory `LoginRateLimiter`
    counts failed `POST /auth/session` attempts per client over a 15-minute window, with two
    independent tiers. **Per-client cap:** 10 failures blocks that client — even with the
    correct passphrase, until the window slides — and this is the *only* check that can ever
    refuse a correct passphrase; it depends only on that client's own history, so the pilot
    user's own IP is affected only by its own failures. **Global ceiling (a slowdown, not a
    lockout):** once 200 failures land in the window from any mix of clients, a further *wrong*
    passphrase gets a longer failure delay (5 s instead of 500 ms) — the ceiling never refuses a
    correct passphrase from a client that isn't itself over its own cap. A first draft of this
    limiter had the global ceiling *block* everyone once tripped; a security review of this task
    found that turns it into a trivial, cheap denial-of-service against the pilot's one
    legitimate user: 200 / 10 = 20 distinct client keys, each failing 10 times, trips it, and a
    trickle of roughly 13 failed requests a minute spread over those 20 IPs sustains the trip
    indefinitely — a ~20-IP botnet or open-proxy list is a low bar. This revision guarantees the
    global ceiling can only ever slow down further guessing, never lock out a legitimate
    sign-in; the trade-off is that a large-enough distributed attack still gets to *try*
    indefinitely (just slowly), which is why the passphrase's own length (≥ 20 chars, ADR-005
    above) remains the real entropy floor this defense leans on — a global slowdown buys time
    against automation, it does not substitute for passphrase strength. One structured log line
    (`{"event":"auth_global_rate_limit_tripped"}`, no IP, no passphrase, no per-client counts)
    is emitted the moment the ceiling trips, once per trip, so an operator can notice sustained
    distributed guessing without the log itself becoming a way to fingerprint clients. A blocked
    (per-client-capped) request is denied with the same `/login?error=1` redirect as a wrong
    passphrase — nothing distinguishes the two to the client — and the constant-time passphrase
    compare always runs before either rate-limit decision, so a block's timing carries no signal
    either. A successful sign-in clears only that client's own failure history, never the global
    counter. The limiter is in-process memory only: correct because `compose.prod.yml` runs
    exactly one `web` replica; it resets on restart and does not survive a redeploy, accepted
    for a single-user pilot (see the module's `ponytail:` comment for the exact bounds).

    **Client identity — verified facts, not inference.** An earlier draft of this amendment
    said the right-most-`X-Forwarded-For` trust decision was "confirmed against
    `deploy/compose.traefik.yml`"; that file carries only Traefik *routing* labels and says
    nothing about header trust, so the claim was an overstatement caught in review. The actual
    verification, done live and read-only against the deployed host on **2026-09-14**: the DNS A
    record for `paxpivot.qcs-cargo.com` resolves directly to the VPS (`82.25.85.157`) with no CDN
    or other proxy in front, and the host's Traefik v2.11 static configuration
    (`/etc/dokploy/traefik/traefik.yml`, Dokploy-managed) defines entrypoints `web` (:80) and
    `websecure` (:443) with neither `forwardedHeaders.trustedIPs` nor `forwardedHeaders.insecure`
    set — so Traefik does not treat any client-supplied `X-Forwarded-*` header as authoritative,
    and the `X-Forwarded-For` it hands to `web` ends in the actual TCP peer address it saw. No
    empirical forged-header probe was run against the live host — the operator shares that
    network, and a wrong assumption tested live would risk locking them out — so this rests on
    reading the static configuration, not on an attack rehearsal. **Re-verify if the topology
    changes**: adding a CDN or another reverse proxy in front of Traefik, or changing either
    entrypoint's `forwardedHeaders` settings, can change which `X-Forwarded-For` entry (if any)
    is trustworthy; a deployment with more hops in front of `web` would need to trust the
    Nth-from-the-right entry instead of the last one, for the same reason this one trusts the
    last. A client can still send its own `X-Forwarded-For` with any forged prefix it likes —
    the whole point of the attack this task closes is that the client is untrusted — but under
    the verified configuration it cannot make Traefik *not* append the true peer address as the
    header's right-most entry, which is the only entry `clientKey()` reads.

  - **Same-origin POST enforcement** (`apps/web/lib/http/request-guards.ts::checkSameOrigin`).
    `SameSite=Lax` alone stops a cross-site *authenticated* POST from carrying the session
    cookie, but not a cross-site POST to `/auth/session` itself (no cookie needed to guess a
    passphrase) or a same-site-cookie-adjacent CSRF variant. Every POST handler now runs two
    independent checks, either of which can refuse the request: `Sec-Fetch-Site`, when present,
    must be `same-origin` or `none`; `Origin`, when present, must have the same host *and*
    scheme as the request's own effective origin — host against the `Host` header, scheme
    against `X-Forwarded-Proto` when present else the request URL's own protocol (an earlier
    draft compared host only, which review found let `Origin: http://<host>` pass against an
    `https` request). `Host` is what Traefik forwards unchanged (`passHostHeader` defaults to
    true and nothing in `deploy/compose.traefik.yml` overrides it) one hop from the client — the
    same single-hop, no-CDN topology verified live above — so trusting it needs no separate
    `X-Forwarded-Host` lookup. The checks are independent rather than a fallback chain (checking
    `Origin` only when `Sec-Fetch-Site` is absent) precisely so a request cannot pass by
    satisfying only whichever header is checked first; a real browser sets both, and both parts
    of `Origin`, consistently, so this never affects a legitimate same-origin request. A request
    with *neither* header is allowed through this check: real browsers set at least one of them
    unconditionally on every fetch/form POST, so their absence means a non-browser client, not a
    same-origin browser request stripped of its markers, and rejecting such clients outright
    would also break legitimate non-browser tooling with no attack this check is meant to stop.

  - **Body size limits** (`apps/web/lib/http/request-guards.ts::checkBodySize`). Next's
    `bodySizeLimit` config applies to Server Actions, not Route Handlers, so all three POST
    handlers now reject before calling `formData()` when `Content-Length` is missing or exceeds
    a small ceiling: 8 KiB for `/auth/session` and `/auth/logout` (a passphrase and a same-origin
    path comfortably fit in bytes, not kilobytes), 16 KiB for `/trips/new` (its largest
    legitimate field is a 200-character destination; the full form is well under 1 KiB even
    URL-encoded). A missing `Content-Length` is rejected rather than trusted to a streamed read,
    since omitting it is also how a client would hide an otherwise-oversized body.

  No change to the passphrase/session mechanism itself, the fail-closed configuration modes, or
  the cookie attributes described above.

  **Verification:** `apps/web/tests/rate-limit.test.ts`, `apps/web/tests/request-guards.test.ts`,
  and the "request hardening (TASK-046)" tests added to `apps/web/tests/auth.test.ts` and
  `apps/web/tests/trips-route.test.ts` (see `docs/tasks/TASK-046-web-request-hardening.md`).
