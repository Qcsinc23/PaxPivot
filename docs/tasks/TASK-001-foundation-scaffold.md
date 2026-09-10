# TASK-001 — Foundation scaffold

## Status

`review`

## Assigned role

`foundation`

## Goal

Create the minimal production-grade PaxPivot repository scaffold and shared development contracts required before parallel feature implementation begins.

## Why this task exists

This task implements the **Foundation** milestone in `PAXPIVOT_PRODUCTION_PRD.md` and must satisfy `docs/agent/SCAFFOLD_GATE.md`. The goal is not to build product features yet; it is to establish one coherent repository structure, reproducible toolchain, database/migration baseline, CI checks, and the first stable domain/application contracts that downstream build-agent tasks can safely consume.

## Dependencies

- `PAXPIVOT_PRODUCTION_PRD.md`
- `paxpivot.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/agent/SCAFFOLD_GATE.md`
- `docs/agent/WORKFLOW.md`

## Owned paths

The foundation agent may create or modify these paths for this task:

```text
AGENTS.md
README.md
CONTRIBUTING.md
.editorconfig
.gitignore
.env.example
.tool-versions
.node-version
.python-version
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
pyproject.toml
uv.lock
Makefile
justfile
docker-compose.yml
compose.yml
apps/**
packages/**
src/**
workers/**
tests/**
.github/workflows/**
docs/architecture/**
docs/decisions/**
docs/tasks/**
```

Use only the files that fit the chosen scaffold. Do not create duplicate command runners or duplicate backend layouts merely because multiple paths are authorized.

## Read-only context

Do not change product scope in these files during this task:

```text
PAXPIVOT_PRODUCTION_PRD.md
paxpivot.md
```

## Interfaces consumed

None. This task establishes the initial shared implementation contracts.

## Interfaces produced

The scaffold must establish stable, documented equivalents of the following concepts before downstream tasks begin:

```text
SourceState
SourceIdentity / provenance identity
SourceObservation result shape
Terminal identity + verified entrance shape
Traveler/party facts required for eligibility
EligibilityDecision result shape
SourceProvider / retrieval-provider protocol
Application error/result convention
```

Exact module paths and symbol names are chosen by the foundation agent and must be recorded in the Handoff section and in the first downstream task files.

Do not prematurely define multi-hop route contracts unless required to keep the foundation coherent. Follow YAGNI.

## Required scaffold decisions

The foundation agent must make and document these concrete choices rather than leaving them ambiguous:

- monorepo/application directory layout;
- Node package manager and workspace strategy;
- Python dependency/virtual-environment strategy;
- supported Node and Python versions;
- TypeScript strictness/configuration;
- Python formatter/linter/typechecker/test runner;
- JavaScript/TypeScript formatter/linter/test runner;
- database migration framework;
- Docker Compose development topology;
- one canonical repository command surface;
- CI workflow and cache strategy;
- local environment variable loading convention.

Use the production PRD's intended stack: Next.js/TypeScript for web, FastAPI/Pydantic for backend, PostgreSQL/PostGIS for durable data, Redis for background jobs where required, Docker Compose for local orchestration, and a provider-adapter architecture.

## Acceptance criteria

- [x] Repository layout reflects the boundaries in `docs/architecture/BOUNDARIES.md`.
- [x] Next.js/TypeScript app boots with strict TypeScript checking.
- [x] FastAPI/Pydantic app boots with a minimal health endpoint only; no premature product feature implementation.
- [x] PostgreSQL/PostGIS local service is configured.
- [x] Redis local service is configured if selected worker tooling requires it.
- [x] Migration framework is initialized and can apply/verify a baseline migration.
- [x] Initial shared domain/application contracts listed above exist and are covered by focused tests.
- [x] `.env.example` contains variable names/documentation only and no secrets.
- [x] Local private data and environment artifacts remain ignored by Git.
- [x] Stable one-command operations exist for setup, format, lint, typecheck, unit tests, integration tests, full tests, build, migration, migration check, and development startup.
- [x] CI runs the canonical quality checks on pull requests.
- [x] CI detects formatting/lint/type/test/build failures.
- [x] Migration workflow prevents or detects conflicting migration heads/drift as appropriate to the chosen framework.
- [x] Repository documentation states the exact tool versions and startup/check commands.
- [x] `docs/tasks/TASK_TEMPLATE.md` is updated so example verification placeholders are replaced by the real canonical commands or clearly directs tasks to use the canonical root commands.
- [x] The foundation agent creates the next 3–6 bounded, non-overlapping task files suitable for the build agent.
- [x] No Space-A movement source is scraped or parsed as part of this foundation task.
- [x] No AI feature, historical intelligence, multi-hop routing, or boarding-probability feature is implemented in this task.
- [x] No unrelated files or sample/private data are committed.

## Required tests

At minimum, establish and run tests proving:

```text
backend health endpoint returns expected status/shape
SourceState accepts only defined source states
provenance/source observation contract retains required identity/timestamps
eligibility decision contract cannot omit controlling policy/version identity
terminal contract distinguishes verified terminal entrance from generic base/airfield coordinates
provider interface can be substituted by a deterministic fake in tests
frontend basic smoke/build check succeeds
migration baseline applies to an empty test database
```

Add only the tests required to prove the scaffold/contracts. Product behavior belongs in later tasks.

## Verification commands

Canonical commands (run from repository root; all PASS on the final scaffold):

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
make migrate-test
make compose-check
```

`make check` aggregates formatting, lint, types, full tests, build, migration and Compose
validation. `make setup check migrate-test` was also run successfully. `make dev` was
smoke-tested with HTTP 200 and expected content from web / and API /health; processes
were stopped afterward. No live source was queried.

## Out of scope

- Do not implement Firecrawl source scraping yet.
- Do not implement live AMC schedule parsing yet.
- Do not build complete route search yet.
- Do not implement multi-hop graph search yet.
- Do not implement Ask PaxPivot yet.
- Do not implement notification providers yet beyond interface placeholders only when required.
- Do not create speculative microservices.
- Do not introduce Kubernetes.
- Do not introduce Neo4j.
- Do not add a vector database without a separately approved requirement.
- Do not redesign product scope in either PRD.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** foundation/task-001-scaffold

**Commit:** Initial scaffold commit containing this handoff; exact commit and CI/merge
result will be recorded in the integration follow-up before final handoff.

**Repository structure chosen:** apps/web Next.js; apps/api/paxpivot/{domain,application,
infrastructure} plus api.py composition and tooling.py; apps/api/migrations; tests/{unit,
integration,fixtures}. One root Python project and one pnpm workspace. No duplicate backend.

**Runtime/tool versions:** Node 24.15.0, pnpm 10.15.1, Python 3.12.13, uv 0.6.9;
Next.js 16.3.4, FastAPI 0.135.4, Pydantic 2.13.5, SQLAlchemy 2.0.52, Alembic 1.18.5.
All formatter/linter/test versions are pinned and documented in README; dependency lockfiles committed.

**Canonical commands:** Root Makefile; verification commands above plus make format,
make services and make dev. See README for local startup and .env loading.

**Files changed:** Root package/runtime/environment/Compose/Make files, .gitignore,
README/CONTRIBUTING, apps/api and apps/web, tests, .github/workflows/quality.yml,
docs/architecture/{CONTRACTS,SCAFFOLD_EVIDENCE}.md, ADR-001, TASK_TEMPLATE, TASK-001–004.
Both PRDs, AGENTS.md and the inherited CLAUDE.md are unchanged.

**Interfaces added/changed:** Exact paths and semantics in docs/architecture/CONTRACTS.md.
SourceState, SourceIdentity, Provenance, SourceObservation, RetrievalState, ExtractionState
in apps/api/paxpivot/domain/source.py; Coordinates, VerifiedEntrance, Terminal in
 domain/terminal.py; TravelerFacts, PartyFacts, EligibilityDecision in domain/eligibility.py;
Success[T], Failure, Result[T], ApplicationError in application/result.py;
SourceProvider.observe in application/ports/source_provider.py;
Authenticator.authenticate / Principal in application/ports/auth.py. Auth stub denies all.
Only GET /health is registered. No route/opportunity contracts introduced.

**Migrations:** 0001_postgis enables PostGIS; no product tables. One head. Downgrade
preserves a potentially pre-existing extension. Drift checks use public schema and exclude
only spatial_ref_sys; unique test databases use template0 and are always removed.

**Verification run:** 2026-09-10 local final implementation.

```text
make setup -> PASS; frozen lockfiles and exact runtime check
make format-check -> PASS; Ruff + Prettier
make lint -> PASS; Ruff + ESLint
make typecheck -> PASS; strict mypy (19 files), Next typegen + strict tsc
make test-unit -> PASS; 29 Python tests + 1 Vitest smoke
make test-integration -> PASS; 2 tests (real API boot and isolated migrations)
make test -> PASS; all unit/integration suites
make build -> PASS; Python sdist/wheel and production Next build
make migrate -> PASS; local development DB at 0001_postgis
make migrate-check -> PASS; one head, PostGIS present, no app schema drift
make migrate-test -> PASS; empty DB, repeated upgrade, injected drift detection, downgrade/reapply
make compose-check -> PASS; secret-safe Compose config validation
make setup check migrate-test -> PASS; canonical CI sequence locally
make dev + local HTTP smoke -> PASS; web / and API /health HTTP 200 with expected bodies
```

**Build-agent task files created:**

- TASK-002-source-state-explanations.md — pure metadata-only explanations for all source states.
- TASK-003-verified-entrance-selection.md — select existing verified entrance, never base coordinates.
- TASK-004-provider-conformance-fixtures.md — synthetic deterministic provider conformance suite.

All three own non-overlapping paths and depend only on TASK-001 merged to main. No feature
implementation in these tasks has started.

**Known limitations / risks:** Scaffold only. No actual auth, private resources, product
persistence, approved source, parser, eligibility engine, route generation, AI, notifications
or historical intelligence is enabled. Source metadata state is not permission to process
or publish movement details. Local Compose uses AMD64 emulation on ARM and is not a production
deployment. Inherited CLAUDE.md is a malformed symlink outside task ownership; canonical
pytest confines discovery to tests and AGENTS.md remains the instruction entrypoint.
Starlette emits upstream TestClient deprecation warnings, with tests passing. RQ is selected
and Redis configured, but no background jobs are started. Next agentRules is disabled to
prevent duplicated generated agent instruction files.

**Next dependency:** GitHub CI verification and merge to main to release the scaffold gate;
then TASK-002–004 are independently dispatchable. Future live ingestion/persistence/auth
still require their respective foundation contracts and approvals.
