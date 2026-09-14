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

## Run 3 — milestone M1 "trustworthy source watch" (2026-09-14)

Plan and current status: `docs/plans/2026-09-14-reconciled-plan.md`. The product owner answered D-8
(agents commit, open PRs, merge per MERGE_POLICY and deploy). One task file and one PR per unit; each
PR carries a fresh-review record with 0 Critical / 0 Important at merge.

| Task | Files | Before → after | Verification |
|---|---|---|---|
| TASK-039 floating Ask clearance (PR #47, f02c4be) | `apps/web/styles/{tokens,components}.css`, `apps/web/components/shell/AskPaxPivotAction.tsx`, `apps/web/tests/shell.test.tsx` | the fixed Ask control rested on the last row and the disclaimer at the end of long pages → content reserves `--fab-height`; pages that hide the control (sticky action bar, `/ask`) keep a navigation-only reserve | regression test fails without the CSS; hit tests at 320–1280 px; client-side navigation checked; three review rounds |
| TASK-041 derived staleness (PR #48, 35d31c7) | `apps/api/paxpivot/application/read_services.py`, `domain/source.py`, `apps/web/lib/presentation/adapters/terminals.ts`, tests | a stopped check kept showing "Fresh" → a positive observation older than 6.5 h reads `source_stale` at read time, and stale evidence is never worded as "none published" | 7-case boundary test, rendering web test, tests written first |
| TASK-042 source reliability report (PR #49, 5ef033e) | `apps/api/paxpivot/application/{source_reliability,source_checks}.py`, `tooling.py`, `Makefile`, tests | the 30-day source-health gate could not be computed → `source-report` prints PASS / WATCH / STOP / UNKNOWN for every source a check run reads and SKIPPED with the reason for the rest | 14 cases; 10 seeded defects caught; four review rounds |
| TASK-040 documentation truth (PR #50, 979abc2) | README, CONTRIBUTING, CLAUDE.md, AUDIT.md, `.env.example`, DEPLOYMENT, CONTRACTS, UI_FOUNDATION, ADR-004, task statuses, `docs/plans/`, `tests/unit/test_docs_consistency.py` | entry-point documents described the TASK-001 scaffold and `CLAUDE.md` was an unreadable symlink → documents match the code and the VPS, and README drift fails CI | guard passes; 7 injected drift kinds each caught by their own test |
| Deploy | pilot VPS `/opt/paxpivot` | api + web 56cee3a → 5ef033e | `/ready` 200, public `/login` 200, signed-out `/terminals` 307, four terminal pages `fresh`, `source-report 30` exit 0 (all four WATCH: window not yet full) |

## Run 4 — production completion (2026-09-14)

The owner's goal: all features working and deployed live. Anything that cannot be done yet is noted,
and the rest is deployed. The audit and task plan are in [AUDIT.md](AUDIT.md).

Owner decisions this run:
- D-3: yes.
- D-1: (a) request written permission, and meanwhile build a planner that does not parse the
  artifacts.
- First job of route search: "where to go to fly".

Each row lands with its own PR, a fresh-review record and a deploy.

| Task | Files | Before → after | Verification |
|---|---|---|---|
| TASK-040 status (PR #51, df0723d) | `docs/tasks/TASK-040-documentation-truth.md`, plan status row, this log | TASK-040 read `review` after merging → `done` with merge commit and review result | fresh review 0/0/0; post-merge Quality green |
| TASK-043 web healthcheck (PR #52, 25f1264) | `compose.prod.yml`, `docs/DEPLOYMENT.md`, plan bullet, task file | `web` had no healthcheck, so `up --wait` returned before Next.js served → `node` fetch probe of `/login` (10s / 5s / 3 retries / 30s start period, engine-agnostic) | real Compose runs: healthy with the API absent; nothing listening → unhealthy after 51 s; five review rounds |
| Deploy | pilot VPS | api + web 5ef033e → 25f1264 | `up --wait` 14 s, `/login` 200 about 2 s later, `/terminals` 307, `/ready` 200, web healthy. A first attempt checked `/login` once, got the proxy's transient 404 and rolled back a good deploy; the retry polls for up to 60 s |
