# TASK-028 — Postgres/Compose startup reliability

## Status

`review` — this PR; becomes `done` once merged (see Handoff).

## Assigned role

`foundation`

## Goal

`docker compose up --wait` returns only when migrations and tests can immediately open a
database connection, so the intermittent CI failure recorded by TASK-020 cannot recur.

## Why this task exists

TASK-020's post-merge `Quality` run failed in the first database connection ~0.7 s after Compose
reported Postgres healthy (`server closed the connection unexpectedly`); the identical commit
passed on rerun. Retrying whole CI jobs hides a real race in the local/CI topology (ADR-001).

## Dependencies

- Required merged tasks: `TASK-027`.
- ADR: ADR-001 amendment (Compose healthcheck).

## Owned paths

```text
compose.yml                                  postgres healthcheck
apps/api/paxpivot/tooling.py                 cold_start_check / `cold-start-check`
Makefile                                     cold-start-check target
docs/decisions/ADR-001-foundation.md         Amendments
docs/tasks/TASK-027-*.md (status), docs/tasks/TASK-028-postgres-startup-reliability.md
```

## Reproduction (before any change)

Stress loop in a clean checkout: `compose down -v` → `compose up --wait` → `SELECT 1` →
`temporary_database()` → repeat ×20. **Result: 17/20 cycles failed** on the first connection
(`server closed the connection unexpectedly`; once `FATAL: the database system is starting
up`), each ~3.9 s after `--wait` returned. CI attempt-1 log for f430acb shows the same shape:
`Healthy` at 04:42:36.14, first connection failed at 04:42:38.

## Root cause (from the container log of a failing cycle)

The `postgis/postgis:16-3.5` entrypoint, on an empty volume, starts a **temporary server that
listens on the Unix socket only** ("listening on Unix socket …", no TCP), runs the init scripts
(`CREATE DATABASE`, PostGIS extensions, ~2.3 s), then performs a fast shutdown and starts the
real server on TCP. The healthcheck `pg_isready -U paxpivot -d paxpivot` has no `-h`, so it
probes the Unix socket and reports "accepting connections" during the temporary phase; Compose
`--wait` returns; the host's TCP connection lands during the shutdown/restart and is closed.
Initialised volumes never hit this path, which is why it only reproduces on cold starts (CI).

## Fix (one change, chosen from the reproduced evidence)

Healthcheck probes over TCP and executes a query:
`pg_isready -h 127.0.0.1 -U paxpivot -d paxpivot && psql -h 127.0.0.1 … -Atc 'SELECT 1'`,
interval 2 s, retries 45. The temporary server does not listen on TCP, so the check can only
succeed against the final server; `SELECT 1` also excludes the brief "starting up" window.
No retry was added to `temporary_database` or the engine: the property required is that
readiness is true when reported, not that callers paper over it.

**Verified with the override before editing the repo: 20/20 cold starts OK (was 3/20).**

## Acceptance criteria

- [x] Root cause reproduced and documented (above, with the entrypoint log phases).
- [x] `make cold-start-check` (new; local only, wipes the checkout volume) performs N cycles of
      `down -v` → `up --wait` → immediate `SELECT 1` → temporary DB create/migrate/drop, with
      no retry anywhere, and fails on the first refused connection.
- [x] 20/20 cycles pass with the committed `compose.yml` (Handoff).
- [x] `make compose-check`, `make migrate-test` and the full canonical suite pass.

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
make cold-start-check        # local only; destroys and recreates this checkout's database
```

## Review / merge rules

`docs/agent/MERGE_POLICY.md`; foundation review recorded in the PR.

## Out of scope

- Connection retries in application code; changing the Postgres image; CI job retries.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `foundation/TASK-028-postgres-startup` from `main` @ `467cc61`.

**Commit:** reported in the PR.

**Files changed:** the owned paths above.

**Interfaces added/changed:** `paxpivot.tooling.cold_start_check(cycles)`; `make cold-start-check`
(`CYCLES=` override). No domain/API/schema change.

**Migrations:** none.

**Verification run:** recorded in the PR after the final change.

**Known limitations / risks:** the probe is Linux/amd64-emulated PostGIS as in ADR-001; a
future image change should re-run `make cold-start-check`. `cold-start-check` is not part of
CI (it is destructive and slow); CI's own cold start is exercised once per run by design.

**Next dependency:** none in this hardening phase. TASK-023/025 remain blocked on product-owner input.
