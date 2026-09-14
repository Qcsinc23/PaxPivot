# PaxPivot

PaxPivot is a source-aware Space-A journey planner. It is a **working source-truth system
with a planner-shaped interface**, deployed as a private single-user pilot. It is not yet a
planner: no departure is parsed, no opportunity is built, no route is ranked, and no AI is
connected.

Read [AGENTS.md](AGENTS.md), [production PRD](PAXPIVOT_PRODUCTION_PRD.md), the
[inherited baseline](paxpivot.md), and the assigned task before implementation. The current
plan and the decisions it waits on are in
[docs/plans/2026-09-14-reconciled-plan.md](docs/plans/2026-09-14-reconciled-plan.md).

## Current state

What works end to end today:

- **Source truth.** Four official AMC terminal pages are registered and approved for
  metadata-only retrieval. `check-sources` reads them through Firecrawl every 6 hours and appends
  immutable observations carrying provider identity, policy version, page status, a content hash
  and the page's own "current as of" stamp. The retrieved document itself is discarded
  in-process and never stored. Thirteen source states are distinguishable, and a failure to
  retrieve is never rendered as absence. See [DEPLOYMENT](docs/DEPLOYMENT.md).
- **Honest freshness.** Every read reports the state as it stands now: a successful read older
  than 6.5 hours is shown as stale, and the stored observation is never changed
  ([TASK-041](docs/tasks/TASK-041-derived-source-staleness.md)). `make source-report` computes
  the pilot's source-health gate (checks completed, gaps, change detection) from the recorded
  observations ([TASK-042](docs/tasks/TASK-042-source-reliability-report.md)).
- **Trip requests.** `POST/GET /api/v1/trips` and `GET /api/v1/trips/{id}` persist what the
  traveler asked for (origin terminal, destination text, window, party size) behind the
  principal gate. The Plan form posts to `/trips/new` and lands on the trip page, which lists
  every registered pilot terminal worth checking — origin first, explicitly not a ranking — each
  with its own source state, read age, official-page link and the registered restricted 72-hour
  schedule link the traveler must open themselves, and states plainly that PaxPivot does not read
  departure schedules yet. Below that list, a commercial fallback card hands the traveler to a
  prefilled Google Flights search built from the trip's own destination, dates and party size,
  plus a curated (non-authoritative) suggested origin airport list; it always offers a second,
  plain search link, shows the mandatory "Live handoff" label, and never fetches from Google or
  shows a fare.
- **Pilot access.** A shared passphrase sets a signed, `HttpOnly`, `Secure` session cookie; the
  web server calls the API with a server-only bearer token that never reaches a browser. A
  production deployment without both secrets fails closed ([ADR-005](docs/decisions/ADR-005-pilot-access-boundary.md)).
- **Read surfaces.** Terminals, terminal detail, source health (under Advanced) and Trips render
  live API data. Every empty, error and unconfigured state is explicit about which one it is.

The API surface, as registered today:

| Method | Path | Auth |
| --- | --- | --- |
| `GET` | `/health` | none — liveness only |
| `GET` | `/ready` | none — `200` only when the database answers at migration head |
| `GET` | `/api/v1/terminals` | bearer |
| `GET` | `/api/v1/terminals/{terminal_id}` | bearer |
| `GET` | `/api/v1/sources/health` | bearer |
| `GET` | `/api/v1/trips` | bearer |
| `GET` | `/api/v1/trips/{trip_id}` | bearer |
| `POST` | `/api/v1/trips` | bearer |

No `/routes`, `/compare`, `/eligibility`, `/readiness` or `/ask` route exists. The API is internal
to the deployment; the public host serves only the web application.
`tests/unit/test_docs_consistency.py` fails when this table, the migration range, the task
statuses named here, the make commands or the links drift from the repository.

What does not exist yet:

- **No parsed movements.** The AMC terminal pages carry no departure rows. The only
  departure-level sources are the 72-hour schedule artifacts, which are notice-marked/CUI and
  are therefore registered as `restricted_user_open_only`: PaxPivot may point a traveler at the
  official document but may not retrieve, parse, hash, store or display its movement rows
  ([TASK-037](docs/tasks/TASK-037-schedule-artifact-sources.md), baseline `SRC-003`).
- **Blocked slices.** TASK-032 (schedule parser) and TASK-033 (published departures) wait on
  written permission to process those artifacts. TASK-035 (eligibility engine) waits only on the
  product owner confirming the pilot traveler class. TASK-036 (opportunities and route cards)
  waits on both.
- **No eligibility engine, readiness data, destination resolver, route search, ranking,
  comparison, notifications or AI.** `apps/api/paxpivot/domain/eligibility.py` holds the
  decision contract; nothing produces a decision. `/ask` renders an honest empty state with the
  composer disabled, and `/profile`, `/profile/eligibility`, `/profile/readiness`,
  `/trips/{id}/compare` and `/trips/{id}/routes/{id}` are honest empty states fed by no API.
- **No alerting, scheduler or worker.** Source checks are driven by host cron; if they stop, the
  app shows the sources as stale within 6.5 hours, but nothing notifies a person. Redis and `rq`
  are declared dependencies and run in Compose, but nothing imports either. Backups are taken
  daily on the host only.

Migrations `0001`–`0005` are applied; the next revision is `0006`. The pilot runs at
`paxpivot.qcs-cargo.com`.

## Toolchain

- Node **24.15.0**, pnpm **10.15.1** (one workspace/lockfile).
- Python **3.12.13**, uv **0.6.9** (one root virtualenv/lockfile).
- Next.js **16.3.4**, TypeScript **5.9.3**, React **19.2.4**, lucide-react **1.44.0**,
  Fontsource Manrope/DM Serif Display **5.3.0**; web tests use Testing Library, jsdom **30.0.1**
  and axe-core **4.13.0**.
- FastAPI **0.135.4**, Pydantic **2.13.5**, SQLAlchemy **2.0.52**, Alembic **1.18.5**.
  `redis` **8.1.0** and `rq` **2.12.0** are installed for a future worker and are unused today.
- Ruff **0.15.5**, mypy **1.19.1**, pytest **9.0.2**; ESLint **9.39.4**,
  Prettier **3.8.1**, Vitest **4.1.11**.
- Docker Engine + Compose v2+ (verified locally with Engine 29.3.1 / Compose 5.1.1),
  GNU Make 3.81+.
- Compose PostGIS image `postgis/postgis:16-3.5` (verified PostgreSQL 16.9 / PostGIS 3.5.2),
  Redis `7.4.8-alpine`. The PostGIS image runs as linux/amd64; ARM Macs need Docker emulation.
  These are local development images; the pilot's production topology is in
  [DEPLOYMENT](docs/DEPLOYMENT.md).

Install the exact Node/Python versions with your runtime manager, then pnpm and uv.
`make setup` verifies the runtime pins, installs frozen dependencies, and creates `.env`
(mode 0600) with a random local database password plus a per-checkout Compose project name
and loopback ports derived from the checkout path ([ADR-002](docs/decisions/ADR-002-local-environment-isolation.md)).
Each checkout or worktree therefore owns its own database volume and ports; an older `.env`
is upgraded in place to the legacy `paxpivot` project so its volume keeps working. Existing
`.env` values are preserved. `.env.example` is documentation only. Never use production
credentials here.
CI installs Python explicitly because the pinned uv release predates that Python patch.

## Commands

Run from the repository root:

| Command | Purpose |
| --- | --- |
| `make setup` | Frozen dependency installation and private local environment initialization |
| `make dev` | Start healthy Compose services, migrate, seed, run API + web; Ctrl-C stops app processes |
| `make services` | Start local PostgreSQL/PostGIS and Redis and wait for health |
| `make seed` | Insert the reference terminals and source registry (idempotent) |
| `make check-sources` | One retrieval pass over the registered sources; exit 2 without `FIRECRAWL_API_KEY`, 3 when the provider failed |
| `make source-report` | Read-only source-health gate over the last `DAYS` (default 30); exit 1 when a source must stop, 2 with no observations |
| `make format` | Format Python and web code |
| `make format-check` | Check formatting without writing |
| `make lint` | Ruff + ESLint |
| `make typecheck` | Strict mypy + Next type generation + strict TypeScript |
| `make test-unit` | Python contract/security tests + web shell/component/accessibility tests |
| `make test-integration` | Isolated empty-database migration checks + real API process boot |
| `make test` | All unit and integration tests |
| `make build` | Python sdist/wheel + production Next.js build |
| `make build-images` | Build the api/web images for the Compose topology |
| `make build-images-check` | CI/local gate: build both deployable images without pushing |
| `make audit` | Dependency-vulnerability gate: `pnpm audit --prod` plus a production-only `pip-audit` (needs network) |
| `make migrate` | Apply Alembic head to local development database |
| `make migrate-check` | Verify single head, applied head, PostGIS and schema drift |
| `make migrate-test` | Migrate a fresh uniquely named local DB, prove drift detection and rollback/reapply |
| `make cold-start-check` | Local only: wipes this checkout's database volume, then proves N cold starts connect immediately after `--wait` (TASK-028) |
| `make compose-check` | Validate Compose without exposing resolved secrets, for both the local-dev and production (`compose.prod.yml` + `deploy/compose.traefik.yml`) topologies |
| `make check` | All required quality/build/test/migration/config checks |

Web: http://127.0.0.1:3000. API liveness: http://127.0.0.1:8000/health returns
`{"status":"ok"}`; `/ready` answers `200` only when the database answers and is at migration
head, and `503` otherwise. Liveness does not prove provider or database readiness.
Postgres and Redis bind loopback ports from `POSTGRES_PORT`/`REDIS_PORT` in `.env`. No RQ
jobs, worker or scheduler are started. After development, `docker compose stop` stops these local services
without deleting the named PostgreSQL volume.

Root `.env` is loaded by backend tooling with existing process environment taking
precedence; Compose reads the same file. `FIRECRAWL_API_KEY` is the one credential the
retrieval path needs and belongs to the API process only. The web has no provider needs and
must never receive backend credentials. Log only the allowlisted structured events; never
request/provider payloads.

## Layout and handoff

- `apps/web`: Next App Router with the Espresso App UI foundation (tokens, shell, primitives,
  semantic components, typed view models; see
  [UI_FOUNDATION](docs/architecture/UI_FOUNDATION.md) and ADR-003). `/showcase` renders every
  component from synthetic fixtures and is refused in production. Screens render
  application-supplied view models; they never duplicate Python domain rules, compute
  eligibility or source freshness, or reorder a ranked list.
- `apps/api/paxpivot/domain`: immutable Pydantic contracts, no framework/provider/DB imports.
- `apps/api/paxpivot/application`: the processing gate, the retrieval pipeline, parsers, read
  services (including derived freshness), trip requests, the source-reliability gate, and
  provider/auth ports.
- `apps/api/paxpivot/infrastructure`: SQLAlchemy Core schema and repositories, the Firecrawl
  provider, the bearer auth boundary, reference-data bootstrap and the CHECK-parity probe.
- `apps/api/paxpivot/api.py`: HTTP composition; `/health`, `/ready` and the authorized
  `/api/v1` read/write routes.
- `apps/api/migrations`: single Alembic history, revisions `0001`–`0005`.
- `apps/api/paxpivot/tooling.py`: the local/operator CLI behind the `make` targets.
- `tests/unit`, `tests/integration`, `tests/fixtures`: synthetic-only test inputs. Captured
  source samples live in the gitignored `private-fixtures/` and never enter the repository.

See [ADR-001](docs/decisions/ADR-001-foundation.md),
[contract guide](docs/architecture/CONTRACTS.md),
[scaffold gate evidence](docs/architecture/SCAFFOLD_EVIDENCE.md),
[deployment runbook](docs/DEPLOYMENT.md), and the newest task contract under `docs/tasks/`
for the current slice.

Production use beyond the single pilot requires the PRD release gates, including real per-user
authorization and a permitted source of movement evidence.
