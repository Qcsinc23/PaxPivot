# TASK-030 — Pilot deployment to the VPS

## Status

`done` — merged to `main` in d803fe5 (PR #34); deployment verified live (Handoff below).

## Assigned role

`foundation`

## Goal

Deploy the pilot to the existing Hostinger VPS behind its Traefik, with decisions delegated by
the product owner (host, domain, TLS path, ADR-005 acceptance, backup cadence) recorded.

## Owned paths

```text
compose.prod.yml (proxy under the `caddy` profile), deploy/compose.traefik.yml
docs/DEPLOYMENT.md, docs/decisions/ADR-005-*.md (Amendments), docs/tasks/TASK-030-vps-deployment.md
```

## Acceptance criteria

- [x] `https://paxpivot.qcs-cargo.com/login` serves 200 with a valid certificate and the hardening headers.
- [x] Anonymous `/terminals` → redirect to `/login`; signed-in `/terminals` renders the live registry (seeded terminals, "Not checked yet").
- [x] API not reachable from the internet; `/ready` 200 inside the network.
- [x] Daily backup cron installed and a first backup + restore test performed.
- [x] Other apps on the host unaffected (same containers running before/after).

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
docker compose --env-file /dev/null -f compose.prod.yml -f deploy/compose.traefik.yml config --quiet   # with placeholder env
```

## Out of scope

- Off-host backup replication; per-user auth; enabling any source (TASK-023/025 stay blocked).

## Blocked / contract change needed

`None`

## Handoff

**Deployed:** 2026-09-11, `/opt/paxpivot` on `srv782537` (82.25.85.157), images `paxpivot-{api,web}:d803fe5`
(built on the host from 8b4e3e6, identical application code), started with
`compose.prod.yml -f deploy/compose.traefik.yml --no-build`; seed inserted 1 source and 4 terminals.

**Live verification (from outside):** `https://paxpivot.qcs-cargo.com/login` 200 with a valid
certificate and 4 hardening headers; `http://` → 301 https; anonymous `/terminals` → 307 to
`/login?next=%2Fterminals`; sign-in → 303 with session cookie; signed-in `/terminals` 200 showing
the four seeded terminals with "Not checked yet"; `/advanced` shows the directory source as
"Needs review"; API port 8000 unreachable from the internet; `/ready` 200 inside the network.
Host container count 66 → 70 (only the four PaxPivot containers added).

**Backups:** `/etc/cron.d/paxpivot-backup` (daily 03:15 UTC, `pg_dump -Fc`, 30-day retention on
host); first backup taken and restored into a scratch database (4 terminals) successfully.

**Known limitations / risks:** backups stay on the host (off-host copy is a follow-up); the
pilot boundary is the shared passphrase held in `/opt/paxpivot/.env.production` (root-only);
no source is enabled, so every terminal reads "Not checked yet" until TASK-023/025 proceed.
