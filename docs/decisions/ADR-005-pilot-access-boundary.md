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
