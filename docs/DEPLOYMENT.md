# Deployment runbook (pilot, Docker Compose)

Status: **deployed to the pilot VPS** (decisions delegated to the foundation agent on
2026-09-11 and recorded in ADR-005 Amendments):

| Decision | Choice |
|---|---|
| Host | the existing Hostinger VPS `srv782537` (Ubuntu 24.04, Docker, Dokploy/Traefik on 80/443) |
| Domain | `paxpivot.qcs-cargo.com` (A record → the VPS; a dedicated subdomain, so HSTS `includeSubDomains` is safe) |
| TLS / ingress | the host's existing Traefik v2 (`letsencrypt` resolver) via `deploy/compose.traefik.yml`; Caddy profile off |
| Access boundary | ADR-005 shared-passphrase pilot sign-in accepted for the single-user pilot |
| Backups | daily `pg_dump` at 03:15 UTC to `/opt/paxpivot/backups`, 30 days kept on host (off-host copy is a follow-up) |
| Install path | `/opt/paxpivot` (git clone of `main`, images built on the host and tagged by commit) |

## Topology (`compose.prod.yml`, plus `deploy/compose.traefik.yml` on a Traefik host)

`proxy` (Caddy, automatic TLS for `PAXPIVOT_DOMAIN`) → `web` (Next standalone, port 3000,
internal) → `api` (FastAPI, port 8000, internal only, migrates to head on start) →
`postgres` (PostGIS 16, named volume) and `redis` (ephemeral). Only 80/443 are published.
No worker/scheduler runs: nothing is scheduled until a source is approved (TASK-025).

## Secrets (`.env.production`, never committed; `chmod 600`)

| Key | Rule |
|---|---|
| `PAXPIVOT_DOMAIN` | public hostname; DNS A/AAAA must point at the host before first start. Use a dedicated subdomain: the web tier sends HSTS with `includeSubDomains` for one year |
| `PAXPIVOT_TAG` | image tag to run (default `local`); build with `make build-images PAXPIVOT_TAG=<git sha>` so a previous tag exists for rollback |
| `POSTGRES_PASSWORD` | random, ≥ 32 chars |
| `PAXPIVOT_API_TOKEN` | random, ≥ 32 chars; shared by `web` and `api` only |
| `PAXPIVOT_SESSION_SECRET` | random, ≥ 32 chars |
| `PAXPIVOT_PILOT_PASSPHRASE` | ≥ 20 chars; the single pilot user's sign-in |
| `FIRECRAWL_API_KEY` | the product owner's Firecrawl key (server-side only). Without it `check-sources` retrieves nothing and exits 2 |

Generate with `openssl rand -hex 32`. Rotating `PAXPIVOT_SESSION_SECRET` signs everyone out.

## Preflight checklist

1. `make check` and `make migrate-test` green on the commit being deployed.
2. `make build-images` succeeds, and each image is smoke-tested: web `/login` → 200 with headers,
   anonymous `/terminals` → 307, and a **signed-in** `/terminals` must not contain
   "configuration problem" (live routes are `force-dynamic`, never prerendered); api `/health` → ok,
   `/ready` → 200 against a migrated database.
3. `docker compose --env-file .env.production -f compose.prod.yml config --quiet` is valid.
4. Host: Docker Engine + Compose v2, ports 80/443 free, disk for the Postgres volume.
5. A restore test of the previous backup has been performed on this host (see below).

## First start / upgrade

```bash
make build-images PAXPIVOT_TAG=$(git rev-parse --short HEAD)   # then set PAXPIVOT_TAG in .env.production
docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml up -d --wait --no-build   # Traefik host
# (a host without a reverse proxy: add `--profile caddy` and drop the traefik override)
docker compose --env-file .env.production -f compose.prod.yml exec api python -m paxpivot.tooling seed
curl -fsS https://$PAXPIVOT_DOMAIN/login >/dev/null   # 200: proxy + web + TLS up
docker compose --env-file .env.production -f compose.prod.yml exec api python -c \
  "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/ready').read())"
```

`api` runs `alembic upgrade head` on every start; `web` fails closed (503) unless both
sign-in secrets are set (ADR-005).

## Source checks (TASK-025)

`/etc/cron.d/paxpivot-checks` runs every 6 hours:
`docker compose … exec -T api python -m paxpivot.tooling check-sources` — one metadata-only
retrieval per approved source through Firecrawl (4 credits per run), appended as immutable
observations; `/advanced` and `/terminals` show the resulting states. Nothing is parsed.

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

`PAXPIVOT_TAG=<previous sha> docker compose --env-file .env.production -f compose.prod.yml up -d --wait --no-build`
(`--no-build` makes a missing tag fail loudly instead of silently building the current checkout)
(images are tagged per commit by `make build-images PAXPIVOT_TAG=<sha>`). Migrations are forward-only
in production; do not `alembic downgrade` on a database with observations (it drops tables).

## Logs

`docker compose … logs -f api web proxy`. The API logs allowlisted audit events and access
lines (no request bodies, no tokens); the proxy logs TLS/HTTP. No trip data is logged.

## Capturing parser corpus pages (TASK-031)

The image's working tree is read-only for the service user, so point the capture at a writable
directory and copy the files out for labeling. Bodies stay out of git and out of the database
(`private-fixtures/` is gitignored); delete captures after 90 days.

```bash
docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml \
  exec -T -e PAXPIVOT_CORPUS_DIR=/tmp/corpus api python -m paxpivot.tooling capture-corpus <source_id>
docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml \
  cp api:/tmp/corpus/. /opt/paxpivot/private-fixtures/parsers/amc-terminal-page/
```
