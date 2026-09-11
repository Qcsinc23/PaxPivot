# TASK-026 — Database and observation correctness hardening

## Status

`review` — this PR; becomes `done` once merged (see Handoff).

## Assigned role

`foundation`

## Goal

Make the read/write distinction, supersession semantics, CHECK-constraint contract and the
source-check clock enforced rather than documented, before any real source retrieval is enabled.

## Why this task exists

TASK-020's read unit of work delegated to the write helper and repositories exposed writes to GET
routes; ADR-004's supersession prose and the current-selection SQL disagreed; `alembic check`
cannot see CHECK constraints, which carry the safety-critical rules; `SourceCheckRun.started_at`
was a naive-tolerant `datetime` despite the task contract. Each is a correctness gap the next
milestone (real retrieval) would build on.

## Dependencies

- Required merged tasks: `TASK-020`, `TASK-024`.
- ADR: `ADR-004` amendment (recorded in the ADR).

## Owned paths

```text
apps/api/paxpivot/infrastructure/{database,repositories,schema_probe}.py
apps/api/paxpivot/application/ports/repositories.py
apps/api/paxpivot/application/{read_services,source_checks}.py
apps/api/paxpivot/api.py
apps/api/paxpivot/tooling.py                          migrate-test runs the parity probe
apps/api/migrations/versions/0003_supersession_integrity.py
tests/integration/{test_db_correctness,test_local_env_isolation}.py
tests/unit/{test_source_checks,support_sources}.py
docs/decisions/ADR-004-*.md, docs/architecture/CONTRACTS.md
docs/tasks/TASK-026-db-correctness-hardening.md
```

## Interfaces consumed

```text
infrastructure/database.py::transaction (unchanged)
domain/source.py::SourceObservation.supersedes_observation_id
```

## Interfaces produced

```text
infrastructure/database.py::read_snapshot(engine) -> Iterator[Connection]   (REPEATABLE READ, READ ONLY, always rollback)
application/ports/repositories.py::SourceReader, ObservationReader, TerminalReader, KillSwitchReader
   (SourceRepository etc. now extend the readers; read services and api.Repositories take readers)
infrastructure/repositories.py::SqlSourceObservationRepository.latest_per_source — leaves-then-temporal
migrations 0003: uq_source_observations_observation_source, fk_source_observations_supersedes_same_source,
   ck_source_observations_supersedes_not_self (single-column self FK dropped)
infrastructure/schema_probe.py::verify_check_parity(connection) -> ParityReport, CheckParityError
application/source_checks.py::SourceCheckRun.started_at: AwareDatetime; run_source_checks rejects naive now
Removed: infrastructure/database.repositories (replaced by read_snapshot)
```

## Acceptance criteria

- [x] A1 `read_snapshot`: REPEATABLE READ + READ ONLY; SELECT works; two reads share one snapshot while
      a concurrent write commits; INSERT/UPDATE/DELETE and the repository `append` fail with a
      database "read-only" error; exit never commits. `transaction`: commit on success, whole unit
      rolled back on failure. GET routes use `read_snapshot` and reader ports.
- [x] A2 Explicit supersession outranks temporal order: simple, chain, older-source-time
      withdrawal, unrelated latest eligible, cross-source and unknown targets refused by FK,
      self refused by domain and CHECK, history retained, stable tie-break. ADR-004 matches the SQL.
- [x] A3 `verify_check_parity` exercises 19 rules (every domain enum member inserts, invented values
      refused by the named constraint, each invariant's counter-example refused); dropping
      `ck_source_observations_positive_requires_retrieval` makes it raise; `make migrate-test` runs it.
- [x] A4 `started_at: AwareDatetime`; aware UTC and non-UTC accepted, naive rejected; naive `now` rejected.
- [x] Mutation proofs: removing `postgresql_readonly` fails the A1 test; removing the supersession
      filter fails the A2 test; dropping a CHECK fails the A3 test.

## Required tests

```text
tests/integration/test_db_correctness.py     (7 tests: A1 ×3, A2 ×3, A3 ×1)
tests/unit/test_source_checks.py             test_started_at_must_be_timezone_aware
```

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
```

## Review / merge rules

`docs/agent/MERGE_POLICY.md`; foundation review recorded in the PR.

## Out of scope

- No broad repository rewrite, no generic graph engine, no schema-diff framework, no global
  datetime-contract rewrite, no retrieval/Firecrawl/parsing/routing/AI.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `foundation/TASK-026-db-correctness` from `main` @ `56be156`.

**Commit:** reported in the PR.

**Files changed:** the owned paths above. Also `tests/integration/test_local_env_isolation.py`:
it shelled out to `docker compose config` with the inherited environment, so once any earlier test
in the process had loaded the checkout's `.env` (`tooling.configure`) both synthetic checkouts
resolved to the real project name; it now scrubs `COMPOSE_*`/`POSTGRES_*`/`REDIS_*` from the
subprocess environment (a latent ordering bug surfaced by the new module's alphabetical position).

**Interfaces added/changed:** see "Interfaces produced".

**Migrations:** `0003_supersession_integrity` (single head).

**Verification run:** recorded in the PR after the final change.

**Known limitations / risks:** the parity probe is a fixed table of the 0002/0003 rules and must
be extended by the migration that adds a new CHECK; `alembic check` still owns structure.

**Next dependency:** TASK-027 (deployment/configuration/auth boundary).
