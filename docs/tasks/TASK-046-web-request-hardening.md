# TASK-046 — Web request hardening (login rate limit, same-origin POSTs, body size limits)

## Status

`review`

## Assigned role

`foundation`

## Goal

A security audit of the now-internet-facing pilot found three gaps in the web tier's three POST
route handlers (`/auth/session`, `/auth/logout`, `/trips/new`): no cap on the aggregate cost of
parallel sign-in guessing, no defense against a cross-site POST beyond `SameSite=Lax`, and no
request body size limit (Next's `bodySizeLimit` does not apply to Route Handlers). Close all
three, proven by tests that fail without the change, with no API, schema, container, or Traefik
change.

## Why this task exists

ADR-005 accepted "brute force is mitigated by passphrase length and TLS, not by the app" when the
pilot was not yet internet-facing. `docs/DEPLOYMENT.md` records the pilot now deployed at
`paxpivot.qcs-cargo.com` behind the host's Traefik. The product owner asked for the app to be
production-ready; an internet-facing single-passphrase login with only a fixed 500 ms per-request
delay (`apps/web/app/auth/session/route.ts`) pays no aggregate cost for parallel guessing. The
other two gaps were found in the same audit pass over the web tier's POST surface.

## Dependencies

- Required merged task/contract: `TASK-027` (the auth boundary this task hardens).
- Required ADR: `ADR-005` (this task adds a dated amendment, not a new ADR — the human→web
  boundary itself is unchanged; only its brute-force and request-shape defenses grow).
- Required interface/schema: `apps/web/lib/auth/{config,session,guard}.ts` (consumed, unchanged).

## Owned paths

```text
apps/web/lib/http/request-guards.ts        NEW
apps/web/lib/auth/rate-limit.ts            NEW
apps/web/app/auth/session/route.ts
apps/web/app/auth/logout/route.ts
apps/web/app/trips/new/route.ts
apps/web/tests/request-guards.test.ts      NEW
apps/web/tests/rate-limit.test.ts          NEW
apps/web/tests/auth.test.ts
apps/web/tests/trips-route.test.ts
docs/decisions/ADR-005-pilot-access-boundary.md   (Amendments section only)
docs/tasks/TASK-046-web-request-hardening.md
```

## Read-only context

```text
AGENTS.md
docs/agent/WORKFLOW.md
docs/agent/MERGE_POLICY.md
docs/decisions/ADR-005-pilot-access-boundary.md
docs/tasks/TASK-027-config-auth-boundary.md
apps/web/lib/auth/{config,session,guard}.ts
apps/web/proxy.ts
deploy/compose.traefik.yml
docs/DEPLOYMENT.md
```

## Interfaces consumed

```text
apps/web/lib/auth/config.ts::accessConfig
apps/web/lib/auth/guard.ts::redirectTo, safeNextPath
apps/web/lib/auth/session.ts::issueSession, timingSafeEqual, SESSION_COOKIE, SESSION_TTL_MS
apps/web/lib/api/client.ts::writeApi (unchanged)
```

## Interfaces produced

```text
lib/http/request-guards.ts::checkSameOrigin(request) -> GuardFailure | null
lib/http/request-guards.ts::checkBodySize(request, maxBytes) -> GuardFailure | null
lib/auth/rate-limit.ts::clientKey(request) -> string
lib/auth/rate-limit.ts::LoginRateLimiter (isBlocked, recordFailure, recordSuccess, trackedClients)
lib/auth/rate-limit.ts::loginRateLimiter  (process-wide singleton the route handler uses)
lib/auth/rate-limit.ts::WINDOW_MS, MAX_FAILURES_PER_CLIENT, MAX_FAILURES_GLOBAL, MAX_TRACKED_CLIENTS
```

## Acceptance criteria

- [x] 11th failed `POST /auth/session` attempt from one client within the window is blocked
      (same `/login?error=1` response as a wrong passphrase — including when the 11th attempt's
      passphrase is correct); a different client is unaffected below the global ceiling; a
      global ceiling blocks a brand-new client once enough distinct clients have failed.
- [x] Client identity for the rate limiter is the right-most `X-Forwarded-For` entry (the one
      Traefik itself appends); a forged prefix does not change the derived identity or let an
      attacker reset their own count.
- [x] The limiter's memory is bounded: expired entries are evicted and the tracked-client count
      never exceeds its configured cap.
- [x] A POST to `/auth/session`, `/auth/logout` or `/trips/new` with `Sec-Fetch-Site` present and
      not `same-origin`/`none`, or with an `Origin` whose host does not match the request's
      `Host`, is rejected with 403. A same-origin request (matching `Sec-Fetch-Site`, matching
      `Origin`/`Host`, or neither header present) is accepted.
- [x] A POST to any of the three handlers with `Content-Length` missing or over its limit (8 KiB
      auth, 16 KiB trips) is rejected with 413, before `formData()` is called. A maximal
      legitimate request (a 200-character `destination_text` and the rest of the trip form) is
      accepted.
- [x] Existing `apps/web/tests/auth.test.ts` and `apps/web/tests/trips-route.test.ts` behaviour
      (session, guard, proxy, sign-in/sign-out, trip creation) still passes.
- [x] No unrelated files changed; no API, schema, container, compose, or Traefik change.

## Required tests

```text
apps/web/tests/request-guards.test.ts   checkSameOrigin: cross-site rejected, same-site rejected,
                                         same-origin accepted (Sec-Fetch-Site and Origin/Host
                                         paths), host comparison is case-insensitive, malformed
                                         Origin rejected, neither header present allowed;
                                         checkBodySize: missing/over-limit/non-numeric/negative
                                         Content-Length rejected, at-limit and small accepted, a
                                         maximal legitimate trip form's byte size accepted.
apps/web/tests/rate-limit.test.ts       clientKey: right-most XFF entry, forged-prefix
                                         resistance, no-header fallback; LoginRateLimiter: 11th
                                         failure blocked, window expiry via injectable clock,
                                         global ceiling, success path leaves other/global state
                                         alone, a client's own success clears only its own
                                         history, XFF-spoofing does not bypass the limit, memory
                                         cap on tracked clients, expired entries evicted.
apps/web/tests/auth.test.ts             "request hardening (TASK-046)": cross-site/mismatched-
                                         Origin POST to /auth/session and /auth/logout rejected,
                                         same-origin accepted; oversize/undeclared-length sign-in
                                         body rejected; 11 failures from one client block even a
                                         correct passphrase, a different client still succeeds.
apps/web/tests/trips-route.test.ts      "trip request route hardening (TASK-046)": cross-site and
                                         mismatched-Origin POST rejected, same-origin accepted;
                                         oversize and undeclared-length body rejected; a maximal
                                         legitimate trip form is not rejected for size.
```

## Verification commands

```bash
make setup
make format-check
make lint
make typecheck
make test-unit
make test-integration
make test
make build
make migrate
make migrate-check
make compose-check
```

## UI behaviour (screen tasks only)

Not a screen task; no UI changes. The existing `/login`, and any future logout/new-trip forms,
are unaffected in their happy path — see the same-origin/size test coverage above.

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies; foundation review recorded in the PR before merge.

## Out of scope

- Not included: any Traefik middleware change (`deploy/compose.traefik.yml` is shared,
  Dokploy-managed host infrastructure).
- Not included: API changes.
- Not included: dependency bumps (no new dependency was added).
- Not included: container or compose changes (`compose.prod.yml`, `deploy/`).
- Not included: `apps/web/app/trips/[tripId]` and its presentation adapters.
- Do not refactor: the passphrase/session mechanism, cookie attributes, or fail-closed
  configuration modes established by ADR-005/TASK-027.

## Blocked / contract change needed

`None`

## Handoff

Fill in before merge.

**Branch:** `foundation/TASK-046-web-request-hardening`, rebased onto `main` @ `81e98f1`
(TASK-049 merged after this branch was cut; unrelated — audit docs only).

**Commit:** `d1b69de`, `591abcc`, `dc6af24`, `31c6901`, `e312633` (PR: see title above).

**Files changed:** the owned paths above.

**Interfaces added/changed:** see "Interfaces produced". No existing interface's signature
changed; `/auth/session`, `/auth/logout`, `/trips/new` gained guard checks ahead of their
existing logic.

**Migrations:** none.

**Verification run:** on `e312633`, `make check` (format-check, lint, typecheck, test-unit —
283 Python + 377 Vitest, test-integration — 40, build, migrate, migrate-check, compose-check)
exited 0. `pnpm exec vitest run` in `apps/web`: 27 files, 377 tests passed, including the new
`request-guards.test.ts` (18), `rate-limit.test.ts` (11), and the extended `auth.test.ts` (9)
and `trips-route.test.ts` (7).

**Known limitations / risks:** the rate limiter is per-process memory (`ponytail:` comment in
`lib/auth/rate-limit.ts`) — correct for the pilot's single `web` replica, reset on restart, and
not shared across a future multi-replica deployment. Client identity trusts the right-most
`X-Forwarded-For` entry, correct only for exactly one proxy hop in front of `web`; adding a CDN
or a second proxy hop in front of Traefik would require trusting a different, deeper entry
instead. The global failure ceiling (200/15 min) means a large-enough distributed attack still
locks out the pilot's one legitimate user; this is an accepted trade-off (see the ADR-005
amendment) given the alternative (no ceiling at all) is strictly worse.

**Next dependency:** none known; TASK-044 and TASK-045 are independent parallel tasks.
