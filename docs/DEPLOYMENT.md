# Deployment runbook (pilot, Docker Compose)

Status: **prepared, not yet deployed.** Deploying requires the product-owner decisions in
`AUDIT.md` §6 (host/domain, acceptance of the ADR-005 pilot access boundary, backup cadence).

## Topology (`compose.prod.yml`)

`proxy` (Caddy, automatic TLS for `PAXPIVOT_DOMAIN`) → `web` (Next standalone, port 3000,
internal) → `api` (FastAPI, port 8000, internal only, migrates to head on start) →
`postgres` (PostGIS 16, named volume) and `redis` (ephemeral). Only 80/443 are published.
No worker/scheduler runs: nothing is scheduled until a source is approved (TASK-025).

## Secrets (`.env.production`, never committed; `chmod 600`)

| Key | Rule |
|---|---|
| `PAXPIVOT_DOMAIN` | public hostname; DNS A/AAAA must point at the host before first start |
| `POSTGRES_PASSWORD` | random, ≥ 32 chars |
| `PAXPIVOT_API_TOKEN` | random, ≥ 32 chars; shared by `web` and `api` only |
| `PAXPIVOT_SESSION_SECRET` | random, ≥ 32 chars |
| `PAXPIVOT_PILOT_PASSPHRASE` | ≥ 20 chars; the single pilot user's sign-in |

Generate with `openssl rand -hex 32`. Rotating `PAXPIVOT_SESSION_SECRET` signs everyone out.

## Preflight checklist

1. `make check` and `make migrate-test` green on the commit being deployed.
2. `make build-images` succeeds (api + web images build from a clean checkout).
3. `docker compose --env-file .env.production -f compose.prod.yml config --quiet` is valid.
4. Host: Docker Engine + Compose v2, ports 80/443 free, disk for the Postgres volume.
5. A restore test of the previous backup has been performed on this host (see below).

## First start / upgrade

```bash
docker compose --env-file .env.production -f compose.prod.yml build
docker compose --env-file .env.production -f compose.prod.yml up -d --wait
docker compose --env-file .env.production -f compose.prod.yml exec api python -m paxpivot.tooling seed
curl -fsS https://$PAXPIVOT_DOMAIN/login >/dev/null   # 200: proxy + web + TLS up
docker compose --env-file .env.production -f compose.prod.yml exec api python -c \
  "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/ready').read())"
```

`api` runs `alembic upgrade head` on every start; `web` fails closed (503) unless both
sign-in secrets are set (ADR-005).

## Backup and restore (manual until M3-1)

```bash
# backup (daily; keep 30 days off-host)
docker compose --env-file .env.production -f compose.prod.yml exec -T postgres \
  pg_dump -U paxpivot -Fc paxpivot > paxpivot-$(date -u +%F).dump
# restore test into a scratch database
docker compose --env-file .env.production -f compose.prod.yml exec -T postgres \
  sh -c 'createdb -U paxpivot restore_test && pg_restore -U paxpivot -d restore_test' < paxpivot-YYYY-MM-DD.dump
```

Observations and terminal facts are append-only; a lost volume is lost history.

## Rollback

`docker compose … up -d --wait` with the previous image tag. Migrations are forward-only in
production; do not `alembic downgrade` on a database with observations (it drops tables).

## Logs

`docker compose … logs -f api web proxy`. The API logs allowlisted audit events and access
lines (no request bodies, no tokens); the proxy logs TLS/HTTP. No trip data is logged.
