# PaxPivot

PaxPivot is a source-aware Space-A journey planner. This repository currently contains
only the TASK-001 foundation: a placeholder Next.js page, FastAPI liveness endpoint,
shared contracts, local infrastructure and quality gates. No source retrieval, parsing,
trip storage, eligibility engine, routing, AI or notifications are enabled.

Read [AGENTS.md](AGENTS.md), [production PRD](PAXPIVOT_PRODUCTION_PRD.md), the
[inherited baseline](paxpivot.md), and the assigned task before implementation.

## Toolchain

- Node **24.15.0**, pnpm **10.15.1** (one workspace/lockfile).
- Python **3.12.13**, uv **0.6.9** (one root virtualenv/lockfile).
- Next.js **16.3.4**, TypeScript **5.9.3**, React **19.2.4**.
- FastAPI **0.135.4**, Pydantic **2.13.5**, SQLAlchemy **2.0.52**, Alembic **1.18.5**.
- Ruff **0.15.5**, mypy **1.19.1**, pytest **9.0.2**; ESLint **9.39.4**,
  Prettier **3.8.1**, Vitest **4.0.18**.
- Docker Engine + Compose v2+ (verified locally with Engine 29.3.1 / Compose 5.1.1),
  GNU Make 3.81+.
- Compose PostGIS image `postgis/postgis:16-3.5` (verified PostgreSQL 16.9 / PostGIS 3.5.2),
  Redis `7.4.8-alpine`. The PostGIS image runs as linux/amd64; ARM Macs need Docker emulation.
  These are local development images, not an approved production deployment.

Install the exact Node/Python versions with your runtime manager, then pnpm and uv.
`make setup` verifies the runtime pins, installs frozen dependencies, and creates a
random local database password in `.env` with mode 0600. Existing `.env` values are
preserved. `.env.example` is documentation only. Never use production credentials here.
CI installs Python explicitly because the pinned uv release predates that Python patch.

## Commands

Run from the repository root:

| Command | Purpose |
| --- | --- |
| `make setup` | Frozen dependency installation and private local environment initialization |
| `make dev` | Start healthy Compose services, migrate, run API + web; Ctrl-C stops app processes |
| `make services` | Start local PostgreSQL/PostGIS and Redis and wait for health |
| `make format` | Format Python and web code |
| `make format-check` | Check formatting without writing |
| `make lint` | Ruff + ESLint |
| `make typecheck` | Strict mypy + Next type generation + strict TypeScript |
| `make test-unit` | Python contract/security tests + web smoke tests |
| `make test-integration` | Isolated empty-database migration checks + real API process boot |
| `make test` | All unit and integration tests |
| `make build` | Python sdist/wheel + production Next.js build |
| `make migrate` | Apply Alembic head to local development database |
| `make migrate-check` | Verify single head, applied head, PostGIS and schema drift |
| `make migrate-test` | Migrate a fresh uniquely named local DB, prove drift detection and rollback/reapply |
| `make compose-check` | Validate Compose without exposing resolved secrets |
| `make check` | All required quality/build/test/migration/config checks |

Web: http://127.0.0.1:3000. API liveness: http://127.0.0.1:8000/health
returns `{"status":"ok"}`. It does not prove provider/database readiness.
Postgres binds loopback 55432; Redis binds loopback 56379. No RQ jobs, worker or scheduler
are started yet. After development, `docker compose stop` stops these local services
without deleting the named PostgreSQL volume.

Root `.env` is loaded by backend tooling with existing process environment taking
precedence; Compose reads the same file. The web has no provider/environment needs and
must never receive backend credentials. Access logs are disabled in the canonical API
startup. Log only the allowlisted structured events; never request/provider payloads.

## Layout and handoff

- `apps/web`: Next App Router; no duplicate Python domain rules in TypeScript.
- `apps/api/paxpivot/domain`: immutable Pydantic contracts, no framework/provider/DB imports.
- `apps/api/paxpivot/application`: result conventions and provider/auth ports.
- `apps/api/paxpivot/infrastructure`: deny-all auth stub, DB metadata and audit logging.
- `apps/api/paxpivot/api.py`: HTTP composition; only `/health` is registered.
- `apps/api/migrations`: foundation-owned single Alembic history.
- `tests/unit`, `tests/integration`, `tests/fixtures`: synthetic-only test inputs.

See [ADR-001](docs/decisions/ADR-001-foundation.md),
[contract guide](docs/architecture/CONTRACTS.md),
[scaffold gate evidence](docs/architecture/SCAFFOLD_EVIDENCE.md), and
[TASK-001](docs/tasks/TASK-001-foundation-scaffold.md).

The first build tasks are TASK-002 (source-state explanations), TASK-003 (verified entrance
selection), and TASK-004 (provider conformance fixtures). They may start only after this
foundation is merged to main. Production use requires the PRD release gates and real auth.
