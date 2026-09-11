# PaxPivot — Production-Readiness Audit (2026-09-11, main @ c286e6e)

## 1. Executive Summary

**Health grade: B.** The codebase is small, disciplined and unusually well-tested for its age:
strict typing on both stacks, 213 unit + 34 integration + 325 web tests all green, database
invariants enforced by CHECK constraints and an append-only trigger, a read-only snapshot seam,
a fail-closed pilot access boundary, and CI that runs the same `make` gate as local. What it is
not, yet, is *deployable*: there is no container image, no production Compose topology, no
reverse proxy/TLS, no readiness probe, no runbook, and no backup/restore story — every one of
which PRD §14.7 requires. The product itself is intentionally not "feature complete": every
live route renders honest data or honest emptiness, and real source retrieval is gated on
product-owner approvals (TASK-023/025).

Top 3 risks: (1) no deployment artifacts, so "production" today would be hand-assembled;
(2) single shared pilot passphrase and shared API bearer token (ADR-005, interim by design);
(3) no backup/restore or log-retention policy for a database whose observations are append-only.
Top 3 opportunities: (1) a reproducible production topology (images + Compose + Caddy TLS) that
CI can at least build; (2) an API readiness probe and web error boundaries so failures are
honest at the edges; (3) hardening headers on the web tier at zero product cost.

## 2. Repo Map

Purpose: Space-A journey planner (private single-user pilot). Stack: Next.js 16 / React 19 /
TypeScript (apps/web), FastAPI / Pydantic / SQLAlchemy Core / Alembic on PostgreSQL 16 + PostGIS
(apps/api), Redis reserved, pnpm + uv, one root `Makefile` as the only command surface, GitHub
Actions `Quality` job. Architecture: UI → presentation adapters → read API → application read
services → repository ports → SQL; domain contracts are frozen Pydantic models; source processing
passes one gate (`authorize_processing`) and one pipeline (`record_observation`).

- `apps/api/paxpivot/domain` — contracts (source registry, policy, observations, terminals).
- `apps/api/paxpivot/application` — gate, pipeline, read services, ports, source checks.
- `apps/api/paxpivot/infrastructure` — Core tables, SQL repositories, seed, auth, schema probe.
- `apps/api/paxpivot/api.py` — FastAPI composition root, `/health`, `/api/v1/*` (bearer-gated).
- `apps/api/migrations` — 0001 PostGIS, 0002 sources/terminals, 0003 supersession integrity.
- `apps/web/app` — routes; `proxy.ts` pilot access guard; `lib/auth`, `lib/api`, `lib/presentation`.
- `docs/` — ADR-001…005, task contracts TASK-001…028, workflow/merge policy.

Surprises: no Dockerfile anywhere; `compose.yml` is local-only (Postgres + Redis); CI has no
deploy job; the web tier has no `error.tsx`/`not-found.tsx`.

## 3. Audit Report

Severity · Impact(1–5)×Effort(S/M/L/XL). Facts cite `path:line`; judgments are marked (J).

### DevEx & operations — the gap that matters
- **Critical · 5×L — No deployable artifacts.** No `Dockerfile` for api or web; `compose.yml:3-36`
  defines only postgres/redis; no reverse proxy/TLS; `.github/workflows/quality.yml` has no build
  or deploy job. PRD §14.7 requires web/api/worker/scheduler/postgres/redis/reverse-proxy with
  TLS, secrets outside source control, backups, restore tests, health checks. Consequence: a
  deployment today is hand-assembled and unrepeatable.
- **High · 4×S — No readiness probe.** `apps/api/paxpivot/api.py:50-54` `/health` is liveness
  only (documented as such). An orchestrator cannot tell "process up" from "database usable".
- **High · 4×M — No backup/restore policy or runbook.** Observations are append-only by trigger
  (`migrations/versions/0002_sources_terminals.py:303-312`); losing the volume loses history.
  No document states backup cadence, restore test, or retention (pilot §16.4 table exists in
  paxpivot.md but nothing implements it).
- **Medium · 3×S — Uvicorn started without proxy-header handling.** `tooling.py:230` runs
  uvicorn for dev only; no production command sets `--proxy-headers`/`--forwarded-allow-ips`, so
  behind a reverse proxy client IPs/scheme would be wrong in logs. (J) fine for local, wrong for prod.
- **Medium · 3×S — No structured request logging.** `infrastructure/audit.py:9-15` logs only
  three allowlisted events; API requests themselves are not logged (PRD §19 observability).

### Security
- **High · 4×S — Missing security headers on the web tier.** `apps/web/next.config.ts:2` sets
  only `poweredByHeader: false`; no `X-Content-Type-Options`, `X-Frame-Options`/frame-ancestors,
  `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`.
- **Medium (accepted, ADR-005) · 3×L — Shared pilot passphrase + shared API bearer.** Documented
  as pilot-only; per-user auth is a product decision (Open Questions).
- **Low — Dependencies clean.** `pnpm audit --prod` and `pip-audit` (py3.12): no known
  vulnerabilities; lockfiles present and frozen in CI (`Makefile:6-7`). Secrets scan: clean;
  `.env` ignored; secrets never reach the client bundle (test-enforced, `apps/web/tests/auth.test.ts`).

### Architecture & design — healthy
Boundaries are explicit and tested (read-only snapshot, reader ports, single processing gate,
adapters that only format). (J) The one soft spot is `api.py` doubling as composition root and
router; acceptable at three routes.

### Code quality — healthy
Strict mypy/TS, ruff/eslint at zero warnings in CI. No swallowed exceptions found in
`apps/api/paxpivot` (grep `except Exception` → only the drift probe in `tooling.py:141`, re-raised).

### Testing — strong
Behaviour-asserting tests at every layer, mutation-proved guards (TASK-026), CHECK-constraint
parity probe, cold-start proof. Gap: **Low · 2×S** — web has no test for global error/404
boundaries because none exist (see DevEx).

### Performance — not a concern at pilot scale
Read services issue O(sources) queries per request (`read_services.py` calls
`list_terminal_sources` per terminal); (J) fine for a four-terminal registry, revisit at ~100.

### Dependencies — healthy
Exact pins on web, bounded ranges on Python, single lockfile each, `pnpm outdated` empty.

### Documentation — good, one hole
README/ADRs/task contracts are accurate and current. Hole: no deployment/runbook document.

### Strengths to preserve
Honest empty/error states everywhere; append-only observation history; policy gate before any
processing; fail-closed access; one command surface; every PR reviewed with recorded verification.

## 4. Improvement Strategy

1. **Make the deployment reproducible before making it real.** Target: `docker build` for api and
   web, a `compose.prod.yml` with Caddy TLS, Postgres, Redis, api, web, and a runbook with a
   preflight checklist. Trade-off: no worker/scheduler service yet (nothing to schedule — TASK-025
   blocked); no managed-DB option. Done signal: `make build-images` succeeds locally and in CI;
   `docker compose -f compose.prod.yml config` is valid.
2. **Honest failure at the edges.** Target: `/ready` probe (DB + migration head), web
   `error.tsx`/`not-found.tsx`. Done: probe returns 503 with the DB down; boundaries tested.
3. **Zero-cost hardening.** Security headers; uvicorn proxy headers in the production command.
   Done: headers asserted by test; production command documented.
4. **Not fixing now (deliberate):** per-user auth, backups automation, request logging pipeline,
   worker/scheduler — each needs a product decision or a source approval (Open Questions).

## 5. Task Plan

| ID | Title | Effort | Impact | Risk | Deps | Execute-now |
|---|---|---|---|---|---|---|
| M0-1 | Pin current `/health` + live-route error behaviour with tests (already covered) | S | 3 | none | — | n/a (exists) |
| M1-1 | Security headers on the web tier | S | 4 | low | — | **yes** (Quick Win) |
| M1-2 | API `/ready` readiness probe (DB + migration head, 503 otherwise) | S | 4 | low | — | **yes** (Quick Win) |
| M1-3 | Web `error.tsx` + `not-found.tsx` honest boundaries | S | 4 | low | — | **yes** (Quick Win) |
| M2-1 | Dockerfiles (api, web standalone) + `compose.prod.yml` (Caddy TLS, api, web, postgres, redis) + `make build-images` | M | 5 | medium | M1-2 | **yes** (prepared; deploy is blocked) |
| M2-2 | `docs/DEPLOYMENT.md` runbook: secrets, preflight, migrate/seed, backup/restore procedure, rollback | M | 4 | none | M2-1 | **yes** |
| M2-3 | Production API command with `--proxy-headers` and structured access log | S | 3 | low | M2-1 | **yes** |
| M3-1 | Backup automation (pg_dump cron + restore test) | M | 4 | medium | product decision | no |
| M3-2 | Per-user authentication replacing the pilot passphrase | L | 4 | high | product decision | no |
| M3-3 | Request logging pipeline / observability (PRD §19) | M | 3 | low | hosting decision | no |
| — | **Deploy to a host** | M | 5 | high | domain, host, secrets, ADR-005 acceptance | **blocked** |

Quick Wins: M1-1, M1-2, M1-3.

Top-3 sketches:
- **M2-1:** multi-stage `apps/api/Dockerfile` (uv sync --frozen --no-dev, run `alembic upgrade`
  at start then uvicorn with `--proxy-headers`); `apps/web/Dockerfile` using Next `output:
  "standalone"`; `compose.prod.yml` with Caddy (`caddy reverse_proxy web:3000`), api on the
  internal network only, env from `.env.production` (never committed). Gotcha: Next standalone
  needs `output: "standalone"` in `next.config.ts` and copies of `.next/static` + `public`.
- **M1-2:** `/ready` opens `read_snapshot`, runs `SELECT 1` and compares Alembic head; returns
  `{"status":"ready"}` or 503 `{"status":"unavailable"}` — no error text. Gotcha: do not import
  Alembic at request time in the hot path; cache the script head once.
- **M1-1:** `headers()` in `next.config.ts` for `/(.*)`; HSTS is ignored over plain HTTP so it
  is safe to always send.

## 6. Open Questions (human decisions)

1. **Where does the pilot deploy?** PRD §14.7 says "existing VPS" via Compose; needs host,
   domain, DNS and who holds the secrets. Deployment is blocked until decided.
2. **Is the ADR-005 shared-passphrase boundary accepted for the pilot's first deployment**, or
   must per-user auth (M3-2) land first?
3. **Backup cadence and retention** for the append-only observation history (pilot §16.4).
4. **TASK-023/025 inputs** (official terminal URLs, source approval, Firecrawl policy/budget)
   remain outstanding and are unrelated to deployability.
