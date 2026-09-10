# ADR-001 — Foundation layout, toolchain and trust boundaries

## Status

Accepted — foundation-agent decision under TASK-001; 2026-09-10.

## Context

The repository held product requirements only. Build agents need stable shared contracts,
reproducible checks and a minimal stack without starting product implementation.

## Decision

Use one pnpm 10.15.1 workspace with Next.js 16.3.4/TypeScript under apps/web and one
uv 0.6.9-managed Python 3.12.13 project under apps/api/paxpivot. Node is 24.15.0.
Pin direct web tools and lock all Python/web resolutions. Strict TypeScript includes
noUncheckedIndexedAccess; strict mypy checks backend and tests. Ruff handles Python
format/lint; ESLint/Prettier handle web lint/format; pytest and Vitest run tests.
Root Makefile is the sole agent-facing command surface. Package scripts are implementation
details. CI uses the same make checks on PRs and main with pnpm/uv lock-keyed caches.

Dependency direction is API -> application ports/contracts, with infrastructure wired at
the composition boundary. Domain imports only stdlib/Pydantic, never FastAPI/SQLAlchemy.
Do not duplicate authoritative domain models in the web. API-specific TypeScript contracts
will be generated or established by foundation when real endpoints are introduced.

Choose SQLAlchemy 2 + Alembic with one migration head. The baseline enables PostGIS only.
Product tables remain a later foundation task. Migrations use the public schema; PostGIS's
spatial_ref_sys is excluded from app drift checks. Explicit public search_path prevents
PostGIS image-installed tiger/topology relations being mistaken for application tables.
Unexpected public tables still fail, proven by an injected drift integration test.
The downgrade leaves the possibly pre-existing PostGIS extension intact.

Compose runs PostgreSQL 16/PostGIS 3.5 plus Redis 7.4 with loopback bindings and health
checks. PostGIS uses linux/amd64 because this image has no ARM manifest. Web/API run on
host for fast reload. RQ is the selected future worker library; no worker/scheduler or
jobs start in the scaffold. Redis is ephemeral; durable facts belong in PostgreSQL.
This is a local topology only. Deployment/TLS/backups/production auth require later gates.

Backend tooling loads root .env (process environment wins); setup generates local-only
random credentials without printing them and preserves existing configuration. Next gets
no backend secrets. Authenticator is a typed port with a deny-all stub. Only the health
endpoint and static placeholder are public. No private endpoint may be added without auth
composition. Logging uses static event names and random correlation IDs, no sensitive payload.

SourceProvider returns metadata-only SourceObservation or a typed application Failure.
Retrieval failures are observations, never absence claims. The caller must enforce a
source-specific processing register before an adapter is used. No live adapters, approved
sources or source content fields exist here. Policy-version identity is evidence identity,
not permission. Fresh does not itself authorize an opportunity or dissemination.

## Alternatives considered

Separate Python packages would duplicate packaging without independent deployable units.
A TypeScript backend would violate the intended stack. Multiple command runners would
create divergent checks. Containers for all local app processes add build overhead now.
SQLite cannot prove PostGIS migrations. Product tables and a universal parser are premature.

## Consequences

Build tasks can implement pure helpers and conformance fixtures now. They cannot add private
HTTP surfaces, persistence, real ingestion, eligibility rules or route graphs without the
next relevant foundation contracts. ARM development uses emulation. This is scaffold readiness,
not production readiness. No probability model, public movement archive or AI is introduced.

## Contract impact

See docs/architecture/CONTRACTS.md for exact paths and exported symbols. All shared types,
ports and database metadata remain foundation-owned.

## Migration / rollout

Run make setup, make migrate and make migrate-check. Empty database verification is
make migrate-test. Merge foundation to main before dependent task implementation.

## Verification

make check plus make migrate-test prove contract validation, fake substitution, default-deny
auth, frontend smoke/build, API process boot, empty-database baseline, rollback/reapply,
and drift detection. CI runs these same commands.
