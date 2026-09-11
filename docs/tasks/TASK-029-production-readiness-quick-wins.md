# TASK-029 — Production-readiness quick wins and deployment scaffold

## Status

`done` — merged to `main` in 214b5f9 (PR #32); post-merge Quality green; Handoff recorded below.

## Assigned role

`foundation`

## Goal

Execute the `AUDIT.md` quick wins (security headers, `/ready` probe, honest web error
boundaries) and prepare, without deploying, a reproducible production topology (api/web images,
Caddy TLS Compose file, runbook). Deployment itself is blocked on product decisions (AUDIT.md §6).

## Why this task exists

PRD §14.7 requires a reverse-proxied, TLS, health-checked Compose deployment with backups; the
repository had no container images, no production topology, no readiness probe and no runbook.

## Dependencies

- Required merged tasks: `TASK-028`.
- ADRs: none new (ADR-001 topology extended by `compose.prod.yml`; ADR-005 unchanged).

## Owned paths

```text
AUDIT.md, IMPROVEMENT_LOG.md, docs/DEPLOYMENT.md
apps/web/next.config.ts, apps/web/app/{error,not-found}.tsx, apps/web/tests/edges.test.tsx, apps/web/Dockerfile
apps/api/paxpivot/api.py (/ready), apps/api/paxpivot/infrastructure/database.py (database_ready, migration_head), apps/api/Dockerfile
deploy/{api-entrypoint.sh,Caddyfile}, compose.prod.yml, Makefile (build-images), .gitignore (.env.production)
tests/unit/test_api_v1.py, tests/integration/test_sources_terminals_db.py
docs/tasks/TASK-029-production-readiness-quick-wins.md
```

## Interfaces produced

```text
GET /ready -> 200 {"status":"ready"} | 503 {"status":"unavailable"}   (public, no detail)
infrastructure/database.py::database_ready(engine) -> bool; migration_head() -> set[str]
apps/web/next.config.ts::SECURITY_HEADERS; output "standalone"
make build-images; compose.prod.yml; deploy/*
```

## Acceptance criteria

- [x] Every web response carries nosniff, `X-Frame-Options: DENY`, referrer/permissions
      policies, HSTS and `frame-ancestors 'none'` (tested).
- [x] `/ready` is 200 only when the database answers and is at the migration head; 503 with no
      detail otherwise (unit: unreachable port; integration: wrong head).
- [x] `error.tsx` hides the error text and reads as a failure on our side; `not-found.tsx` is
      about the address (tested, axe).
- [x] `docker compose -f compose.prod.yml config` valid; `make build-images` builds both images.
- [x] `docs/DEPLOYMENT.md` covers secrets, preflight, start/upgrade, backup/restore, rollback.
- [x] Nothing deployed; no auth model change; no scheduler/worker.

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
make migrate-test
make build-images
docker compose --env-file /dev/null -f compose.prod.yml config --quiet   # with placeholder env
```

## Out of scope

- Deploying to any host; backup automation; per-user auth; request-logging pipeline; worker.

## Blocked / contract change needed

`None` for this task. Deployment blocked: see AUDIT.md §6.

## Handoff

**Branch:** `audit/improvements-2026-09-11` from `main` @ `c286e6e`.
**Commit:** a934eef (PR #32, merged as 214b5f9).  **Migrations:** none.
**Verification run:** on dcc8664 (final code change) — format-check/lint/typecheck/test-unit (214; Vitest 329)/test-integration (35)/test/build/migrate/migrate-check/compose-check PASS; migrate-test PASS (19 CHECK rules); build-images PASS; web and api images smoke-tested. Two adversarial review passes; final: 0 Critical / 0 Important. CI Quality green on the head and the merge commit.
**Known limitations / risks:** images built locally only (not in CI, to keep the gate fast);
Caddy obtains certificates from Let's Encrypt at first start, which needs DNS in place.
**Next dependency:** product-owner decisions in AUDIT.md §6.
