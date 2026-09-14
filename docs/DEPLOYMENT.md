# Deployment runbook (pilot, Docker Compose)

Status: **deployed to the pilot VPS** (decisions delegated to the foundation agent on
2026-09-11 and recorded in ADR-005 Amendments):

| Decision | Choice |
|---|---|
| Host | the existing Hostinger VPS `srv782537` (Ubuntu 24.04, Docker, Dokploy/Traefik on 80/443; host clock UTC) |
| Domain | `paxpivot.qcs-cargo.com` (A record → the VPS; a dedicated subdomain, so HSTS `includeSubDomains` is safe) |
| TLS / ingress | the host's existing Traefik v2 (`letsencrypt` resolver) via `deploy/compose.traefik.yml`; Caddy profile off |
| Access boundary | ADR-005 shared-passphrase pilot sign-in accepted for the single-user pilot |
| Backups | daily `pg_dump` at 03:15 UTC (`/etc/cron.d/paxpivot-backup`) to `/opt/paxpivot/backups`, dumps older than 30 days deleted; on the host only — an off-host copy is still open (decision D-5 in [the plan](plans/2026-09-14-reconciled-plan.md)) |
| Install path | `/opt/paxpivot` (git clone of `main`; the host has no `make`, so images are built there with `docker build` and tagged by commit) |

## Topology (`compose.prod.yml`, plus `deploy/compose.traefik.yml` on a Traefik host)

`proxy` (Caddy, only with `--profile caddy`) → `web` (Next standalone, port 3000, internal) →
`api` (FastAPI, port 8000, internal only, migrates to head on start) → `postgres` (PostGIS 16,
named volume) and `redis` (ephemeral; nothing imports redis or rq). On the pilot host Traefik
terminates TLS instead of Caddy. Only 80/443 are published, and the public host routes every
path to `web`: `/health` and `/ready` are reachable only from inside the stack. No worker or
scheduler runs inside the stack; source checks and backups run from host cron.

## Secrets (`.env.production`, never committed; `chmod 600`)

| Key | Rule |
|---|---|
| `PAXPIVOT_DOMAIN` | public hostname; DNS A/AAAA must point at the host before first start. Use a dedicated subdomain: the web tier sends HSTS with `includeSubDomains` for one year |
| `PAXPIVOT_TAG` | image tag to run (default `local`); tag images by commit (see below) so the previous tag stays available for rollback |
| `POSTGRES_PASSWORD` | random, ≥ 32 chars |
| `PAXPIVOT_API_TOKEN` | random, ≥ 32 chars; shared by `web` and `api` only |
| `PAXPIVOT_SESSION_SECRET` | random, ≥ 32 chars |
| `PAXPIVOT_PILOT_PASSPHRASE` | ≥ 20 chars; the single pilot user's sign-in |
| `FIRECRAWL_API_KEY` | the product owner's Firecrawl key (server-side only). Without it `check-sources` retrieves nothing and exits 2 |

Generate with `openssl rand -hex 32`. Rotating `PAXPIVOT_SESSION_SECRET` signs everyone out.

## Preflight checklist

1. CI `Quality` (`make check`, `make migrate-test`) is green on the `main` commit being deployed.
2. Both images build and each is smoke-tested: web `/login` → 200 with headers, anonymous
   `/terminals` → 307, and a **signed-in** `/terminals` must not contain "configuration problem"
   (live routes are `force-dynamic`, never prerendered); api `/health` → ok, `/ready` → 200
   against a migrated database.
3. `docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml config --quiet` is valid.
4. Host: Docker Engine + Compose v2, ports 80/443 owned by the proxy, disk for the Postgres volume.
5. A restore test of the previous backup has been performed on this host (see below).

## First start / upgrade (on the VPS)

```bash
cd /opt/paxpivot && git pull --ff-only
TAG=$(git rev-parse --short HEAD)
docker build -f apps/api/Dockerfile -t paxpivot-api:$TAG .
docker build -f apps/web/Dockerfile -t paxpivot-web:$TAG .
# set PAXPIVOT_TAG=$TAG in .env.production (note the previous value for rollback), then:
docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml up -d --wait --no-build
# (a host without a reverse proxy: add `--profile caddy` and drop the traefik override)
docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml exec api python -m paxpivot.tooling seed
curl -fsS https://$PAXPIVOT_DOMAIN/login >/dev/null   # 200: proxy + web + TLS up
docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml exec api python -c \
  "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/ready').read())"
```

On a machine with `make`, `make build-images PAXPIVOT_TAG=$TAG` runs the same two builds.
`api` runs `alembic upgrade head` on every start; `web` fails closed (503) unless both
sign-in secrets are set (ADR-005).

The `web` service has no Docker healthcheck, so `--wait` returns as soon as its container is
running. For a few seconds after a restart Traefik can answer 404 until Next.js is serving
(observed on 2026-09-14): re-check `/login` before treating a 404 as a failed deploy. Avoid switching
tags within a few minutes of a scheduled check (00:00, 06:00, 12:00, 18:00 UTC), so a restart never
costs a check run.

## Source checks (TASK-025)

`/etc/cron.d/paxpivot-checks` runs at 00:00, 06:00, 12:00 and 18:00 UTC:
`docker compose … exec -T api python -m paxpivot.tooling check-sources >> /opt/paxpivot/backups/checks.log 2>&1`
— one metadata-only retrieval per approved source through Firecrawl (4 credits per run, about 16
a day), appended as immutable observations; `/advanced` and `/terminals` show the resulting
states. Nothing is parsed. A healthy run ends with
`Source checks: recorded=4 skipped=5 rejected=0 provider_failures=0`.

Freshness is derived when read (TASK-041): a source whose last successful read is older than
6.5 hours shows as **Stale**. A stopped cron, host or provider therefore becomes visible in the
app, but nothing notifies anyone yet (no heartbeat; decision D-4 in the plan).

## Source reliability report (TASK-042)

```bash
docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml \
  exec -T api python -m paxpivot.tooling source-report 30
```

Read-only. It measures only the sources a `check-sources` run would read (the run's own skip
decision, with the Firecrawl provider); disabled, paused, restricted, kill-switched and unwired
sources print as `SKIPPED … not measured (<reason>)` because their silence is a decision or a
configuration fact, not an outage. For each measured source it prints checks read
against checks expected, the longest gap, gaps over 6.5 h, content changes, an upper bound on
change-detection p95, and a PASS / WATCH / STOP / UNKNOWN verdict against the pilot's source-health
gate (pass at ≥ 95 % completion and detection ≤ 6.5 h; stop below 90 % or on a gap over 18.5 h).
A source first observed inside the window is measured from its first check, and a source whose
reads carry no content hash has unmeasurable detection; either can only WATCH. Exit 1 when a
measured source must stop, 2 when there are no observations. Run it weekly until the 30-day gate
and keep the output with the plan.

## Backup and restore

The daily dump is automatic (`/etc/cron.d/paxpivot-backup`; errors go to
`/opt/paxpivot/backups/backup.log`). A manual dump and a restore test into a scratch database:

```bash
docker compose --env-file .env.production -f compose.prod.yml exec -T postgres \
  pg_dump -U paxpivot -Fc paxpivot > paxpivot-$(date -u +%F).dump
docker compose --env-file .env.production -f compose.prod.yml exec -T postgres \
  sh -c 'createdb -U paxpivot restore_test && pg_restore -U paxpivot -d restore_test' < paxpivot-YYYY-MM-DD.dump
```

Observations and terminal facts are append-only; a lost volume is lost history, and until an
off-host copy exists, a lost host is lost backups too.

## Rollback

`PAXPIVOT_TAG=<previous sha> docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml up -d --wait --no-build`
(`--no-build` makes a missing tag fail loudly instead of silently building the current checkout;
images are tagged per commit by the build commands above). Migrations are forward-only in
production; do not `alembic downgrade` on a database with observations (it drops tables).

## Logs

`docker compose … logs -f api web`. The API (`deploy/api-entrypoint.sh`) logs allowlisted audit
events and access lines (no request bodies, no tokens); Traefik logs TLS/HTTP. No trip data is
logged. Check runs append to `/opt/paxpivot/backups/checks.log`.

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
