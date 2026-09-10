# TASK-001 — Foundation scaffold

## Status

`ready`

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

- [ ] Repository layout reflects the boundaries in `docs/architecture/BOUNDARIES.md`.
- [ ] Next.js/TypeScript app boots with strict TypeScript checking.
- [ ] FastAPI/Pydantic app boots with a minimal health endpoint only; no premature product feature implementation.
- [ ] PostgreSQL/PostGIS local service is configured.
- [ ] Redis local service is configured if selected worker tooling requires it.
- [ ] Migration framework is initialized and can apply/verify a baseline migration.
- [ ] Initial shared domain/application contracts listed above exist and are covered by focused tests.
- [ ] `.env.example` contains variable names/documentation only and no secrets.
- [ ] Local private data and environment artifacts remain ignored by Git.
- [ ] Stable one-command operations exist for setup, format, lint, typecheck, unit tests, integration tests, full tests, build, migration, migration check, and development startup.
- [ ] CI runs the canonical quality checks on pull requests.
- [ ] CI detects formatting/lint/type/test/build failures.
- [ ] Migration workflow prevents or detects conflicting migration heads/drift as appropriate to the chosen framework.
- [ ] Repository documentation states the exact tool versions and startup/check commands.
- [ ] `docs/tasks/TASK_TEMPLATE.md` is updated so example verification placeholders are replaced by the real canonical commands or clearly directs tasks to use the canonical root commands.
- [ ] The foundation agent creates the next 3–6 bounded, non-overlapping task files suitable for the build agent.
- [ ] No Space-A movement source is scraped or parsed as part of this foundation task.
- [ ] No AI feature, historical intelligence, multi-hop routing, or boarding-probability feature is implemented in this task.
- [ ] No unrelated files or sample/private data are committed.

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

The foundation agent must replace this section with the exact final canonical commands it establishes, then run them on the final scaffold.

Required logical checks:

```text
setup
format-check or format + clean-diff check
lint
typecheck
test-unit
test-integration
test
build
migrate on clean test database
migrate-check
Docker Compose/config validation
```

The task cannot move to `done` until all final commands are recorded here with fresh PASS results.

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

Fill this in before review/done.

**Branch:**

**Commit:**

**Repository structure chosen:**

**Runtime/tool versions:**

**Canonical commands:**

**Files changed:**

**Interfaces added/changed:**

**Migrations:**

**Verification run:**

```text
command -> PASS/FAIL summary
```

**Build-agent task files created:**

**Known limitations / risks:**

**Next dependency:**
