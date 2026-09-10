# TASK-005 — Local environment isolation

## Status

`done`

## Assigned role

`foundation`

## Goal

Independent checkouts/worktrees get their own Compose project, database volume and loopback ports so they never fail on a mismatched generated database password; and the `main` merge policy is configured and documented.

## Why this task exists

ADR-001 fixed the Compose project name and ports while generating a random password per checkout, so every checkout shared one volume initialised with the first password. Concurrent build tasks on separate worktrees need isolated mutable development state before parallel work expands. See ADR-002.

## Dependencies

- Required merged task/contract: `TASK-001`
- Required ADR: `ADR-002-local-environment-isolation.md` (created by this task)

## Owned paths

```text
compose.yml
.env.example
README.md
apps/api/paxpivot/tooling.py
tests/unit/test_local_env.py
tests/integration/test_local_env_isolation.py
docs/decisions/ADR-002-local-environment-isolation.md
docs/tasks/TASK-005-local-environment-isolation.md
docs/agent/MERGE_POLICY.md
docs/agent/WORKFLOW.md (one cross-reference line only)
```

## Read-only context

```text
AGENTS.md
docs/decisions/ADR-001-foundation.md
.github/workflows/quality.yml
Makefile
```

## Interfaces consumed

```text
apps/api/paxpivot/tooling.py::setup_env (existing make setup entrypoint)
```

## Interfaces produced

```text
apps/api/paxpivot/tooling.py::LocalIdentity, LEGACY_IDENTITY
apps/api/paxpivot/tooling.py::local_identity(root: Path) -> LocalIdentity
apps/api/paxpivot/tooling.py::write_env(root: Path) -> Path
.env keys COMPOSE_PROJECT_NAME, POSTGRES_PORT, REDIS_PORT
```

## Acceptance criteria

- [x] A fresh checkout's `.env` carries a project name and ports derived from its path; two different paths differ.
- [x] `compose.yml` has no fixed project name and takes both host ports from the environment.
- [x] `DATABASE_URL`/`REDIS_URL` point at the checkout's own ports.
- [x] Random per-checkout credentials and 0600 mode are unchanged; no deterministic password.
- [x] An existing `.env` without identity keys is upgraded idempotently to the legacy identity; existing values are never rewritten.
- [x] Tests prove two generated checkouts resolve to different Compose projects and ports via `docker compose config`.
- [x] `main` branch protection is applied (required `scaffold` check on the exact head, strict, admins enforced, no force push/deletion) and documented in `docs/agent/MERGE_POLICY.md`.
- [x] No unrelated files changed.

## Required tests

```text
tests/unit/test_local_env.py
tests/integration/test_local_env_isolation.py
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

## Out of scope

- No change to production deployment, credentials policy, CI topology or migrations.
- No containerisation of web/API processes.
- No shared or deterministic development password.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `foundation/TASK-005-local-env-isolation` from `main` @ `17891a1`.

**Commit:** Reported in the PR; single focused commit.

**Files changed:** Owned paths above only.

**Interfaces added/changed:** Listed under Interfaces produced. `setup_env` keeps its CLI name and now delegates to `write_env(ROOT)`.

**Migrations:** None.

**Verification run:** 2026-09-10, after the final change:

```text
make check (format-check, lint, typecheck, test, build, migrate, migrate-check, compose-check) -> PASS
  pytest unit 155 passed (4 new in test_local_env.py); integration 3 passed (1 new)
make migrate-test -> PASS
docker compose config in the existing checkout -> project paxpivot, ports 55432/56379 (legacy kept)
docker compose config in two generated checkouts -> distinct project names and ports
```

**Known limitations / risks:** Hashed ports can in rare cases collide with an unrelated local service; edit the port lines in `.env` if so. Existing checkouts keep the legacy `paxpivot` project and 55432/56379 ports on purpose so their initialised volume keeps working.

**Next dependency:** None. Enables concurrent worktree-based build tasks.
