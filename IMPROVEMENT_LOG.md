# Improvement log — audit/improvements-2026-09-11

Each entry: task, files, before → after evidence, verification. Governance: one branch, one
PR (#32), task contract `docs/tasks/TASK-029-production-readiness-quick-wins.md`.

| Task | Files | Before → after | Verification |
|---|---|---|---|
| M1-1 Security headers | `apps/web/next.config.ts`, `apps/web/tests/edges.test.tsx` | no headers → nosniff, DENY framing, referrer policy, permissions policy, HSTS, `frame-ancestors 'none'` on `/(.*)` | `make test-unit` (edges suite asserts the rule set) |
| M1-2 `/ready` probe | `apps/api/paxpivot/api.py`, `infrastructure/database.py`, `tests/unit/test_api_v1.py`, `tests/integration/test_sources_terminals_db.py` | liveness only → `/ready` 200 when DB answers and is at migration head, 503 `{"status":"unavailable"}` otherwise, no detail | unit: unreachable port → 503; integration: migrated DB → 200, wrong head → 503 |
| M1-3 Error boundaries | `apps/web/app/error.tsx`, `apps/web/app/not-found.tsx`, `tests/edges.test.tsx` | Next default pages → honest "failure on our side" (hides error text) and "page does not exist" with a way back | edges suite incl. axe |
| M2-1 Images + topology (prepared) | `apps/api/Dockerfile`, `apps/web/Dockerfile`, `deploy/api-entrypoint.sh`, `deploy/Caddyfile`, `compose.prod.yml`, `next.config.ts` (`output: standalone`), `Makefile` (`build-images`) | none → reproducible api/web images, Caddy TLS topology | `docker compose -f compose.prod.yml config`; `make build-images` locally |
| M2-2 Runbook | `docs/DEPLOYMENT.md` | none → secrets, preflight, start/upgrade, backup/restore, rollback | review |
| M2-3 Proxy-aware API start | `deploy/api-entrypoint.sh` | dev-only uvicorn → migrate-then-serve with `--proxy-headers`, access log | image build |
| Deploy | — | **blocked**: host/domain, ADR-005 acceptance, backup cadence are product decisions (AUDIT.md §6) | — |

## Run 2 — `audit/improvements-2026-09-11b` ("fully working")

| Task | Files | Before → after | Verification |
|---|---|---|---|
| QW-1 loop fix | `apps/web/components/screens/plan/PlanScreen.tsx`, `apps/web/tests/screens/plan.test.tsx` | empty Plan "Find routes" → `/trips` → "Plan a trip" → `/` loop → empty Plan links to the live `/terminals` and says the network and sources are live | plan suite pins no "Find routes" on the empty state and the `/terminals` link |
| TASK-031…036 | `docs/tasks/TASK-03{1..6}-*.md` | no roadmap → decision-complete task contracts for parsing under the SRC-009 gate and the pilot-first planner | docs only |
