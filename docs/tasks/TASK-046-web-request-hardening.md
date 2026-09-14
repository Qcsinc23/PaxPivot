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
lib/auth/rate-limit.ts::failureDelayMs(globalThrottled) -> number
lib/auth/rate-limit.ts::LoginRateLimiter (isClientBlocked, isGlobalThrottled, recordFailure,
                                           recordSuccess, trackedClients)
lib/auth/rate-limit.ts::loginRateLimiter  (process-wide singleton the route handler uses)
lib/auth/rate-limit.ts::WINDOW_MS, MAX_FAILURES_PER_CLIENT, MAX_FAILURES_GLOBAL,
                        MAX_TRACKED_CLIENTS, FAILURE_DELAY_MS, GLOBAL_THROTTLE_DELAY_MS
```

## Acceptance criteria

- [x] 11th failed `POST /auth/session` attempt from one client within the window is blocked —
      the *per-client* cap, which alone can refuse even a correct passphrase — while a different
      client is entirely unaffected by it.
- [x] The global failure ceiling (200 in the window, reachable by 20 distinct clients each
      failing 10 times) never blocks a correct passphrase from a client that is not itself over
      its own per-client cap: once tripped, only a further *wrong* passphrase gets a longer
      failure delay. (Revised from the first draft, where the global ceiling blocked everyone —
      a security review found that a cheap, sustained distributed attack could use it to lock
      out the pilot's one legitimate user indefinitely.)
- [x] The constant-time passphrase compare always runs, before either rate-limit decision is
      applied — a block's timing carries no information about whether it was a block.
- [x] Client identity for the rate limiter is the right-most `X-Forwarded-For` entry (the one
      Traefik itself appends, verified live against the deployed host on 2026-09-14 — see the
      ADR-005 amendment and `lib/auth/rate-limit.ts`); a forged prefix does not change the
      derived identity or let an attacker reset their own count.
- [x] The limiter's memory is bounded: expired entries are evicted and the tracked-client count
      never exceeds its configured cap. A structured log line, with no per-client identifying
      detail, is emitted once per trip of the global ceiling.
- [x] A POST to `/auth/session`, `/auth/logout` or `/trips/new` with `Sec-Fetch-Site` present and
      not `same-origin`/`none`, or with an `Origin` whose host or scheme does not match the
      request's effective host/scheme (`Host`; `X-Forwarded-Proto` else the request URL's own
      protocol), is rejected with 403. A same-origin request (matching `Sec-Fetch-Site`, matching
      `Origin` host and scheme, or neither header present) is accepted.
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
                                         Origin rejected, neither header present allowed,
                                         Sec-Fetch-Site and Origin checked independently (not a
                                         fallback), Origin scheme checked against
                                         X-Forwarded-Proto (including a multi-valued header,
                                         using only its first entry) and against the request
                                         URL's own protocol when that header is absent; checkBodySize:
                                         missing/over-limit/non-numeric/negative Content-Length
                                         rejected, at-limit and small accepted, a maximal
                                         legitimate trip form's byte size accepted.
apps/web/tests/rate-limit.test.ts       clientKey: right-most XFF entry, forged-prefix
                                         resistance, no-header fallback; failureDelayMs: the
                                         longer delay only when throttled; LoginRateLimiter per-
                                         client cap: 11th failure blocked, window expiry via
                                         injectable clock, own success clears own history only,
                                         XFF-spoofing does not reset the count, memory cap on
                                         tracked clients, expired entries evicted; global
                                         ceiling: never blocks a fresh/untouched client even once
                                         tripped, 20-distinct-clients-x-10-failures reachability,
                                         onGlobalThrottleTripped fires exactly once per trip and
                                         again after a re-trip, the default logger emits one
                                         structured event with no identifying detail.
apps/web/tests/auth.test.ts             "request hardening (TASK-046)": cross-site/mismatched-
                                         Origin POST to /auth/session and /auth/logout rejected,
                                         same-origin accepted; oversize/undeclared-length sign-in
                                         body rejected; 11 failures from one client block even a
                                         correct passphrase, a different client still succeeds;
                                         a global ceiling tripped by 20+ distinct clients never
                                         blocks a fresh client's correct passphrase; the
                                         constant-time compare always runs, proven by a mocked
                                         timingSafeEqual call-count check for both a wrong and a
                                         correct passphrase once the client is already blocked
                                         (regression added in TASK-046 review round 2, after a
                                         mutation that skips the compare when blocked passed all
                                         401 prior tests undetected).
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

**Branch:** `foundation/TASK-046-web-request-hardening`, rebased onto `main` @ `abf7010`
(TASK-053 merged after this branch was cut; unrelated — commercial handoff feature under
`apps/web/app/trips/[tripId]`, not touched by this task).

**Commit:** `089c973`, `37ae122`, `0256dd9`, `c348135`, `de46b50`, `d960bc4`, `97fa9d8`,
`6597ab9` (PR: see title above).

**Files changed:** the owned paths above.

**Interfaces added/changed:** see "Interfaces produced". No existing interface's signature
changed; `/auth/session`, `/auth/logout`, `/trips/new` gained guard checks ahead of their
existing logic.

**Migrations:** none.

**Verification run:** on `6597ab9`, `make check` (format-check, lint, typecheck, test-unit —
283 Python + 424 Vitest, test-integration — 40, build, migrate, migrate-check, compose-check)
exited 0. `pnpm exec vitest run` in `apps/web`: 30 files, 424 tests passed (the Vitest count
grew from 377 across two review rounds plus TASK-053's own tests arriving via rebase),
including `request-guards.test.ts` (22, up from 18), `rate-limit.test.ts` (15, up from 11),
`auth.test.ts` (11, up from 9) and `trips-route.test.ts` (7, unchanged).

**Mutation-testing evidence (review round 2):** applied, locally and temporarily, the exact
mutation the reviewer described — `session/route.ts`'s `validPassphrase` computed as
`clientBlocked ? false : timingSafeEqual(...)` instead of always running the compare. Re-ran
`apps/web/tests/auth.test.ts`: exactly one test failed —
`"always runs the constant-time compare, even once the client is already blocked (regression,
TASK-046 review 2)"` — at the call-count assertion (`expected 233 to be 234`), with all other
10 tests in the file still passing. Reverted the mutation immediately after (confirmed via
`git diff` showing no change to `session/route.ts`) and re-ran the full suite green before
committing the real fix (the test itself, added in `6597ab9`).

**Known limitations / risks:** the rate limiter is per-process memory (`ponytail:` comment in
`lib/auth/rate-limit.ts`) — correct for the pilot's single `web` replica, reset on restart, and
not shared across a future multi-replica deployment. Client identity trusts the right-most
`X-Forwarded-For` entry; this is a *verified* fact about the deployed host as of 2026-09-14
(direct DNS to the VPS, no CDN; Traefik v2.11's `web`/`websecure` entrypoints have neither
`forwardedHeaders.trustedIPs` nor `forwardedHeaders.insecure` set — see the ADR-005 amendment
for the exact configuration read), not an assumption from `deploy/compose.traefik.yml` alone
(an earlier draft overstated that file as the evidence; it only carries routing labels). Adding
a CDN or another reverse-proxy hop in front of Traefik, or changing either entrypoint's
`forwardedHeaders` settings, invalidates this and must be re-verified before trusting the same
header entry again. The global failure ceiling (200 failures / 15 min, reachable by 20 distinct
clients each failing 10 times) now only ever *slows down* further wrong guesses — it cannot
block a correct passphrase from an otherwise-untouched client, so it cannot be used to lock out
the pilot's one legitimate user; a large-enough distributed attack can still keep guessing
indefinitely, just slowly, which is why the passphrase's own length (≥ 20 chars, ADR-005) is the
real entropy floor this defense leans on. (A first draft had the global ceiling block everyone
once tripped; a security review found that made a ~20-IP distributed attack a cheap, indefinite
denial-of-service against the pilot's one user, and this was corrected before merge.) The 5 s
delay holds one connection open per wrong attempt from a client under its own cap while the
ceiling stays tripped; this residual is bounded and disclosed rather than mitigated with an
added concurrency cap, which is not required for this single-user pilot (see the ADR-005
amendment for the full reasoning).

**Next dependency:** none known; TASK-044 and TASK-045 are independent parallel tasks.
