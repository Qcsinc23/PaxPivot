# TASK-027 — Deployment and configuration truthfulness

## Status

`review` — this PR; becomes `done` once merged (see Handoff).

## Assigned role

`foundation`

## Goal

(B1) A missing API URL/token renders as a configuration error, never as an empty registry.
(B2) Define and implement the human → web access boundary for the single-user private pilot,
distinct from the web → API bearer boundary, failing closed in production. Decision: ADR-005.

## Why this task exists

TASK-021/022 mapped `not_configured → empty`, which presents an operational failure as "no
terminals / no sources". The deployed web server had no human authentication at all: the API
token protected the API, not the pages. Pilot §16.1 requires private authenticated access.

## Dependencies

- Required merged tasks: `TASK-026`.
- ADR: `ADR-005`.

## Owned paths

```text
apps/web/proxy.ts                                  NEW (Next 16 request interception)
apps/web/lib/auth/{config,session,guard}.ts        NEW
apps/web/app/login/page.tsx, apps/web/app/auth/{session,logout}/route.ts   NEW
apps/web/components/shell/NotConfigured.tsx        NEW
apps/web/app/{terminals,advanced}/page.tsx, apps/web/app/terminals/[terminalId]/page.tsx
apps/web/styles/components.css                      .pp-input
apps/web/tests/auth.test.ts NEW; apps/web/tests/screens/{terminals-live,advanced-live}.test.tsx
.env.example
docs/decisions/ADR-005-pilot-access-boundary.md
docs/tasks/TASK-026-*.md (status), docs/tasks/TASK-027-config-auth-boundary.md
```

## Interfaces consumed

```text
apps/web/lib/api/client.ts::readApi (ApiFailure reasons, unchanged)
next/server::NextRequest, NextResponse
```

## Interfaces produced

```text
components/shell/NotConfigured.tsx::NotConfigured({ title }), NOT_CONFIGURED_TITLE/BODY
lib/auth/config.ts::accessConfig(env) -> configured | development_open | misconfigured
lib/auth/session.ts::issueSession, verifySession, timingSafeEqual, SESSION_COOKIE, SESSION_TTL_MS
lib/auth/guard.ts::guard(pathname, cookie, config, now) -> allow | login | refuse; isPublicPath; safeNextPath
proxy.ts::proxy(request)   (redirect 307 → /login, 503 when misconfigured in production)
routes: GET /login (form), POST /auth/session, POST /auth/logout
env: PAXPIVOT_SESSION_SECRET, PAXPIVOT_PILOT_PASSPHRASE (server-only)
```

## Acceptance criteria

- [x] B1: `not_configured` → `NotConfigured` error state with the agreed copy on `/terminals`,
      `/terminals/{id}`, `/advanced`; `200 []` → honest empty; `401`/unreachable → error;
      `404` detail → `notFound()`. No secret or variable name in the rendered output.
- [x] B2: anonymous request to a private route → 307 to `/login?next=<same-origin path>`;
      valid session cookie → allowed; forged/expired/tampered → login; `/login`, `/auth/*`,
      `/_next/*` public; production without both secrets → 503 on private routes (fail closed);
      development with neither secret → open; partial/short secrets → misconfigured.
- [x] Sign-in sets `HttpOnly; SameSite=Lax; Secure` cookie only for the exact passphrase
      (constant time), never echoes the input, only redirects to same-origin paths; logout clears.
- [x] Only `lib/api/client.ts` and `lib/auth/config.ts` read secret variables (static test);
      `make build` output contains none of the secret names (Handoff).

## Required tests

```text
apps/web/tests/auth.test.ts                       (7 tests)
apps/web/tests/screens/terminals-live.test.tsx    not_configured ×2
apps/web/tests/screens/advanced-live.test.tsx     not_configured
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

## Review / merge rules

`docs/agent/MERGE_POLICY.md`; foundation review recorded in the PR.

## Out of scope

- Multi-user accounts, RBAC, rate limiting, password reset, an auth vendor; API changes.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `foundation/TASK-027-config-auth-boundary` from `main` @ `594938b`.

**Commit:** reported in the PR.

**Files changed:** the owned paths above.

**Interfaces added/changed:** see "Interfaces produced". `not_configured` no longer maps to
`status: "empty"` on any live page.

**Migrations:** none.

**Verification run:** recorded in the PR after the final change.

**Known limitations / risks:** single shared passphrase (pilot-only, ADR-005); session
revocation is secret rotation; brute-force mitigation is passphrase length + reverse-proxy
controls; the login page renders inside the app shell (navigation links redirect to login).

**Next dependency:** TASK-028 (Postgres/Compose startup reliability).
