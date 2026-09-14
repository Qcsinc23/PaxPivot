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
| `PAXPIVOT_HEARTBEAT_URL` | optional (TASK-045): a dead-man monitor ping URL for `deploy/run-checks.sh`. Leave unset to disable; see "Heartbeat" below |

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

Cron is installed from the repo (TASK-045), not hand-typed. Do this once on a new host, and again
whenever `deploy/cron/paxpivot-*` or the scripts they call change — both are safe to re-run:

```bash
cd /opt/paxpivot
chmod +x deploy/run-checks.sh deploy/backup.sh
install -m 0644 deploy/cron/paxpivot-checks deploy/cron/paxpivot-backup /etc/cron.d/
```

```bash
cd /opt/paxpivot && git pull --ff-only
./deploy/backup.sh   # pg_dump BEFORE the upgrade, so a bad deploy has a same-day restore point
TAG=$(git rev-parse --short HEAD)
PREVIOUS_TAG=$(grep '^PAXPIVOT_TAG=' .env.production | cut -d= -f2)   # keep for rollback/pruning
docker build -f apps/api/Dockerfile -t paxpivot-api:$TAG .
docker build -f apps/web/Dockerfile -t paxpivot-web:$TAG .
# set PAXPIVOT_TAG=$TAG in .env.production, then:
docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml up -d --wait --no-build
# (a host without a reverse proxy: add `--profile caddy` and drop the traefik override)
docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml exec api python -m paxpivot.tooling seed
docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml exec api python -c \
  "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/ready').read())"
```

On a machine with `make`, `make build-images PAXPIVOT_TAG=$TAG` runs the same two builds.
`api` runs `alembic upgrade head` on every start; `web` fails closed (503) unless both
sign-in secrets are set (ADR-005).

`web` has a Docker healthcheck (TASK-043): it probes `GET /login` on `127.0.0.1:$PORT` inside the
container every 10s, a route that renders without calling the API, so `--wait` blocks until
Next.js is actually serving, not merely until the container is running. Traefik's Docker provider
only adds a container to a router's pool once Docker reports it `healthy`, but on this shared
Dokploy/Traefik host that provider reload itself lags behind Docker's health state: a 2026-09-14
deploy observed the public `/login` still answering 404 for about 2 seconds after `--wait` returned
0 (TASK-045; corrects TASK-043's original claim that the request "no longer needs a retry window"
once `--wait` returns — that was wrong on this host). Poll instead of judging the first response:

```bash
code=""
for i in $(seq 1 30); do
  code=$(curl -o /dev/null -s -w '%{http_code}' https://$PAXPIVOT_DOMAIN/login)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "final status after up to 60s: $code"
```

Only treat the deploy as failed, and only roll back (see below), once that ~60-second poll never
reaches 200 — a single 404 or 502 immediately after `--wait` returns is the expected Traefik-reload
race on this host, not a bad deploy.

Once the poll above reaches 200, drop old images, keeping only the tag just deployed and the
previous one (about a dozen otherwise accumulate on this host):

```bash
for repo in paxpivot-api paxpivot-web; do
  docker images "$repo" --format '{{.Tag}}' | grep -v -E "^(${TAG}|${PREVIOUS_TAG})$" \
    | xargs -r -I{} docker rmi "$repo:{}"
done
```

Avoid switching tags within a few minutes of a scheduled check (00:00, 06:00, 12:00, 18:00 UTC),
so a restart never costs a check run.

## Source checks (TASK-025)

`/etc/cron.d/paxpivot-checks` (tracked as `deploy/cron/paxpivot-checks`; installed per "First
start / upgrade" above) runs `deploy/run-checks.sh` at 00:00, 06:00, 12:00 and 18:00 UTC. The
script runs the same command as before —
`docker compose … exec -T api python -m paxpivot.tooling check-sources`, appended to
`/opt/paxpivot/backups/checks.log` — one metadata-only retrieval per approved source through
Firecrawl (4 credits per run, about 16 a day), appended as immutable observations; `/advanced` and
`/terminals` show the resulting states. Nothing is parsed. A healthy run ends with
`Source checks: recorded=4 skipped=5 rejected=0 provider_failures=0`.

Freshness is derived when read (TASK-041): a source whose last successful read is older than
6.5 hours shows as **Stale**. A stopped cron, host or provider therefore becomes visible in the
app; `deploy/run-checks.sh` also pings an optional heartbeat URL after every successful run
(TASK-045) so a dead-man monitor can alert a person on the *absence* of that ping — see
"Heartbeat" below.

## Heartbeat (dead-man monitor)

`deploy/run-checks.sh` (TASK-045) pings `PAXPIVOT_HEARTBEAT_URL` after every successful
`check-sources` run. This is a dead-man monitor: it alerts on a **missing** ping, not a received
one, so a stopped cron, a crashed container, a hung `docker compose exec`, or a real
`check-sources` failure all surface the same way — silence — instead of a false "still alive" ping
papering over a real problem.

Setup (owner-provided secret, one time):

1. Create a free monitor at a provider such as healthchecks.io or Cronitor, with an expected
   period of 6 hours (matching `deploy/cron/paxpivot-checks`) and a reasonable grace window.
2. Put the ping URL it gives you in `/opt/paxpivot/.env.production` as `PAXPIVOT_HEARTBEAT_URL=`.
   `deploy/run-checks.sh` reads only this one key, by `grep`, and never sources the rest of the
   file.
3. Leave it empty (the `.env.example` default) to disable the ping; nothing else about the check
   run changes.

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

The daily dump is automatic (`/etc/cron.d/paxpivot-backup`, tracked as
`deploy/cron/paxpivot-backup`; installed per "First start / upgrade" above). It runs
`deploy/backup.sh` at 03:15 UTC, which writes `/opt/paxpivot/backups/paxpivot-YYYY-MM-DD.dump` via
`pg_dump -Fc`, logs a success or failure line to `/opt/paxpivot/backups/backup.log`, and prunes
dumps older than 30 days. A manual dump and a restore test into a scratch database:

```bash
./deploy/backup.sh   # writes today's dump and a result line in backup.log, same as the cron job
docker compose --env-file .env.production -f compose.prod.yml exec -T postgres \
  sh -c 'createdb -U paxpivot restore_test && pg_restore -U paxpivot -d restore_test' \
  < /opt/paxpivot/backups/paxpivot-YYYY-MM-DD.dump
docker compose --env-file .env.production -f compose.prod.yml exec -T postgres \
  dropdb -U paxpivot restore_test
```

Observations and terminal facts are append-only; a lost volume is lost history, and until an
off-host copy exists, a lost host is lost backups too (D-5, still open).

**Monthly restore drill:** once a month, run the restore half of the commands above against the
most recent automatic dump in `/opt/paxpivot/backups/` (not a fresh manual one) and spot-check a
row count in `restore_test` before dropping it, e.g.
`psql -U paxpivot -d restore_test -Atc "SELECT count(*) FROM sources;"` should be close to the
live count. A dump that restores cleanly with data present is the only real proof backups work;
this is the same check TASK-045's local verification ran (seed data → dump → restore → matching
counts) applied to a real host backup.

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
