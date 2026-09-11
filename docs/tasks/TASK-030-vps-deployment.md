# TASK-030 — Pilot deployment to the VPS

## Status

`review` — this PR; becomes `done` once merged and the deployment is verified (see Handoff).

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

- [ ] `https://paxpivot.qcs-cargo.com/login` serves 200 with a valid certificate and the hardening headers.
- [ ] Anonymous `/terminals` → redirect to `/login`; signed-in `/terminals` renders the live registry (seeded terminals, "Not checked yet").
- [ ] API not reachable from the internet; `/ready` 200 inside the network.
- [ ] Daily backup cron installed and a first backup + restore test performed.
- [ ] Other apps on the host unaffected (same containers running before/after).

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

(filled after deployment)
