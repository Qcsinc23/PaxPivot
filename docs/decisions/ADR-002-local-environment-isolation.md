# ADR-002 — Per-checkout local environment isolation

## Status

Accepted — foundation-agent decision under TASK-005; 2026-09-10.

## Context

ADR-001 fixed the Compose project name to `paxpivot` and the loopback ports to 55432/56379
while `make setup` generated a random `POSTGRES_PASSWORD` per checkout. Every checkout or Git
worktree therefore shared one named volume, `paxpivot_postgres-data`, initialised with the
first checkout's password. A second checkout generated a different password and could not
authenticate, and two checkouts could not run services at the same time because the ports
collided. This was observed in practice: one running project listed config files from two
different checkouts.

## Decision

`make setup` derives a stable identity from the checkout path (SHA-256 of the resolved root)
and writes it to the ignored `.env`: `COMPOSE_PROJECT_NAME=paxpivot-<10 hex>`,
`POSTGRES_PORT` in 50000–53999 and `REDIS_PORT` in 54000–57999. `compose.yml` no longer sets
`name:` and reads both ports from the environment, so each checkout owns
`<project>_postgres-data` and its own loopback ports. `DATABASE_URL`/`REDIS_URL` are generated
against those ports. Random per-checkout credentials stay; nothing is made deterministic or
weaker. A pre-existing `.env` without the identity keys is upgraded in place with the legacy
project name and ports so its already-initialised volume keeps working; existing values are
never rewritten.

## Alternatives considered

Deterministic shared credentials would let checkouts share one database, but shared mutable
schema state between worktrees is the actual hazard. Relying on Compose's directory-basename
default fails for two clones with the same folder name and still leaves the port collision.
Choosing free ports at setup time is non-deterministic across sessions; hashed ports are stable
and collide rarely. Containerising web/API would not address the shared volume.

## Consequences

Independent checkouts start, migrate and test independently. Each initialises its own database
on first `make services`/`make dev`; that is expected. Docs must not quote fixed ports; read
them from `.env`. Hashed ports may collide with another local service in rare cases; the
escape hatch is editing the port lines in `.env`. CI is unaffected: `make setup` writes a
fresh identity before `make check`, and the workflow's `docker compose down --volumes` reads
the same `.env`.

## Contract impact

`paxpivot.tooling.local_identity(root) -> LocalIdentity`, `write_env(root) -> Path` and
`LEGACY_IDENTITY`. `.env.example` documents the three new keys. No domain, API or schema change.

## Migration / rollout

Run `make setup` in each existing checkout once; it appends the legacy identity. New checkouts
need nothing. To retire a legacy volume, run `docker compose down --volumes` inside that checkout.

## Verification

`tests/unit/test_local_env.py` proves determinism, distinctness, secret length/mode 0600 and
the idempotent legacy upgrade. `tests/integration/test_local_env_isolation.py` resolves two
generated checkouts with `docker compose config` and asserts different project names and
ports with the same declared volume, which yields different physical volumes.
