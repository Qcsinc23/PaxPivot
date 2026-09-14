# TASK-045 — Container and ops hardening

## Status

`review`

## Assigned role

`foundation`

## Goal

`compose.prod.yml` bounds every service's memory/CPU, drops Linux capabilities to the minimum
each service actually needs, and gets an explicit log-rotation policy that does not depend on host
configuration; the two hand-typed root cron entries on the pilot VPS become tracked scripts and
crontab fragments in the repo, and the checks cron gains a dead-man heartbeat hook. None of this
changes application behavior — it only bounds and hardens how the existing containers run.

## Why this task exists

A 2026-09-14 read-only production audit of the live pilot VPS (shared host, 4 vCPU/16 GB, ~7 GB
free, many unrelated apps behind a Dokploy-managed Traefik) found: no per-service resource limits
in `compose.prod.yml` (a runaway container could starve unrelated apps on the shared host); `api`
and `web` already run non-root but keep the full default capability set; `postgres`/`redis` run
with the full default set despite starting as root only to `gosu`/`su-exec` down; the daily backup
and 6-hourly source-check cron jobs exist only as hand-typed `/etc/cron.d/*` files on the host, not
in git, so a host rebuild would silently lose them; there is no dead-man monitor, so a stopped cron
or crashed container goes unnoticed until someone opens `/advanced` and sees stale sources; and the
audit observed a real deploy where public `/login` still 404'd for ~2s after `up -d --wait`
returned, which TASK-043's `docs/DEPLOYMENT.md` note claims cannot happen — a documentation defect
this task also corrects.

## Dependencies

- Required merged task/contract: `TASK-043-web-healthcheck` (compose.prod.yml healthcheck this
  task builds on top of; no conflict — this task only adds resource/capability/logging keys
  alongside the existing `healthcheck`/`depends_on` blocks)
- Required ADR, if any: `None` (see "ADR decision" below)
- Required interface/schema: `apps/api/paxpivot/tooling.py::check_sources` (CLI exit codes 0/2/3,
  consumed as-is by `deploy/run-checks.sh`; not modified)

## Owned paths

```text
compose.prod.yml
deploy/** (deploy/run-checks.sh, deploy/backup.sh, deploy/prune-images.sh, deploy/cron/paxpivot-checks, deploy/cron/paxpivot-backup — new; deploy/compose.traefik.yml, deploy/api-entrypoint.sh, deploy/Caddyfile unchanged)
.env.example
docs/DEPLOYMENT.md
docs/tasks/TASK-045-ops-hardening.md
```

## Read-only context

```text
AGENTS.md
docs/agent/WORKFLOW.md
docs/agent/MERGE_POLICY.md
docs/tasks/TASK-030-vps-deployment.md
docs/tasks/TASK-043-web-healthcheck.md
apps/api/Dockerfile
apps/web/Dockerfile
deploy/api-entrypoint.sh
apps/api/paxpivot/tooling.py::check_sources / apps/api/paxpivot/application/source_checks.py::exit_code
```

## Interfaces consumed

```text
apps/api/paxpivot/tooling.py::check_sources -> int   (exit 0/2/3; deploy/run-checks.sh treats this as opaque and forwards it)
compose.prod.yml::services.web.healthcheck            (TASK-043; untouched)
```

## Interfaces produced

```text
compose.prod.yml::services.*.mem_limit / cpus / logging   (new, every service)
compose.prod.yml::services.{web,api}.cap_drop / security_opt                 (new)
compose.prod.yml::services.{postgres,redis}.cap_drop / cap_add / security_opt (new)
deploy/run-checks.sh   (new script; not imported by application code, invoked by cron only)
deploy/backup.sh       (new script; not imported by application code, invoked by cron only)
deploy/prune-images.sh (new script; not imported by application code, invoked manually per the upgrade runbook)
deploy/cron/paxpivot-checks, deploy/cron/paxpivot-backup   (new; installed verbatim to /etc/cron.d/)
.env.example::PAXPIVOT_HEARTBEAT_URL   (new, optional, documentation only)
```

Not a shared application contract (no Python/TypeScript symbol changes); infra/ops only.

## Design

**Resource limits.** `mem_limit` + `cpus` (top-level, non-Swarm Compose fields) rather than
`deploy.resources.limits`, so the ceiling applies under plain `docker compose up` with no
ambiguity about Swarm-only semantics. Values are the task brief's starting points, kept as-is
because idle usage on the live host (web 54 MiB, api 69 MiB, postgres 21 MiB, redis 2 MiB) sits
far enough below every limit that normal bursts (Next.js SSR under load, `alembic upgrade`,
`pg_dump`, a Firecrawl retrieval batch) have headroom, while a runaway process is still capped
well short of the host's ~7 GB free:

| Service | mem_limit | cpus | Why |
|---|---|---|---|
| web | 512m | 1.0 | Next.js SSR; ~10x idle RSS headroom |
| api | 512m | 1.0 | uvicorn + alembic; ~7x idle RSS headroom |
| postgres | 1g | 1.0 | PostGIS extensions and query working memory need more headroom than the other services; still small next to the host's free RAM |
| redis | 128m | 0.5 | ephemeral cache only (`--save "" --appendonly no`); never expected to grow |
| proxy | 128m | 0.5 | bundled Caddy fallback, not started on the live host (Traefik owns 80/443 via Dokploy); sized the same as redis for parity with the task brief |

These are ceilings, not reservations: `cpus` totaling 4.0 across services on a 4 vCPU host is
intentional (services are rarely all pegged at once on a single-tenant-per-container pilot
workload) and does not reserve anything from the other apps sharing the host.

**Least privilege.** `api` and `web` already run as the non-root `paxpivot` user (both
Dockerfiles) and need no Linux capability at all — no low-port bind, no filesystem ownership
change, no raw sockets — so both get `cap_drop: ["ALL"]` and
`security_opt: ["no-new-privileges:true"]` with no `cap_add`.

`postgres` (`postgis/postgis:16-3.5`) and `redis` (`redis:7.4.8-alpine`) both start as root and
re-exec as their service user via `gosu`/`su-exec` (read directly from each image's
`docker-entrypoint.sh` — see the Handoff for the exact lines). Both scripts, while still root:
`chown` files not owned by the target user (needs `CAP_CHOWN`), `chmod`/create directories they
may not own yet (needs `CAP_FOWNER`, `CAP_DAC_OVERRIDE` to traverse/read across ownership during
that fixup), then call `gosu`/`su-exec` to switch from uid 0 to the service uid, which requires
`CAP_SETUID`/`CAP_SETGID` (dropping to an arbitrary non-real/non-saved uid needs the capability,
even from root). Both get `cap_drop: ["ALL"]`,
`cap_add: ["CHOWN", "DAC_OVERRIDE", "FOWNER", "SETUID", "SETGID"]`, and
`security_opt: ["no-new-privileges:true"]`. No other capability is exercised by either entrypoint.

`proxy` is intentionally **not** given `cap_drop`/`cap_add` in this task: it is not in the task
brief's least-privilege bullet list (only `api`/`web`/`postgres`/`redis` are named), and it is not
started on the live host (Traefik via Dokploy owns 80/443; the bundled Caddy is a fallback for a
host with no reverse proxy). Restricting it would also need `cap_add: ["NET_BIND_SERVICE"]` (the
official `caddy` image runs as root specifically to bind 80/443) and cannot be verified against the
live topology since the profile is never enabled there. Recorded here rather than silently
skipped, per "if a service cannot be restricted safely, leave it and record why" — this one is
better described as "out of the stated scope and unverifiable on the deployed topology" than
unsafe; a future task can pick it up if the `caddy` profile is ever used for real.

No read-only rootfs in this task (explicitly out of scope per the brief) — follow-up: `postgres`
writes to its data volume and a tmpfs for its Unix socket, `redis` writes to its ephemeral `/data`,
and `api`/`web` may need `tmpfs` mounts for `/tmp`; each needs its own audit and is left for a
separate task.

**Logging.** An `x-logging` YAML anchor (`json-file`, `max-size: 10m`, `max-file: 3`) applied to
every service via `logging: *default-logging`, matching `/etc/docker/daemon.json` on the live host
exactly, so the repo does not depend on host configuration that isn't checked in anywhere. Since
the values already match the host default, this is a no-op on the current host and a guardrail for
any future host that lacks the daemon-level default.

**Cron as code.** `deploy/run-checks.sh` and `deploy/backup.sh` replace the hand-typed
`/etc/cron.d/*` command lines with tracked scripts; `deploy/cron/paxpivot-checks` and
`deploy/cron/paxpivot-backup` are the crontab fragments, installed with
`install -m 0644 deploy/cron/paxpivot-* /etc/cron.d/` (documented in `docs/DEPLOYMENT.md`). Both
scripts are POSIX `#!/bin/sh` with `set -eu`, matching the existing `deploy/api-entrypoint.sh`
convention, and are shellcheck-clean (verified below).

`deploy/run-checks.sh` runs the same `check-sources` command as the live cron line, appends to the
same log, and — only on a zero exit and only when `PAXPIVOT_HEARTBEAT_URL` is non-empty — pings it
with `curl -fsS -m 10 --retry 3 "$URL" >/dev/null`. It reads that one key with
`grep -m1 '^PAXPIVOT_HEARTBEAT_URL=' .env.production | cut -d '=' -f2-`, never sourcing the file
(the file also holds `POSTGRES_PASSWORD`, API tokens and the pilot passphrase). This is a
dead-man monitor: the ping is proof of a good run, so a missing ping — from a stopped cron, a
crashed container, a hung `docker compose exec`, or a genuine `check-sources` failure — is what
alerts a person, which is why the ping is skipped (not sent with a failure flag) on any non-zero
exit. The crontab fragment still redirects the whole script's own stdout/stderr to
`checks.log` too, as a safety net for a failure before the script's own internal redirect takes
effect (e.g. a `cd` failure).

`deploy/backup.sh` takes the same `pg_dump -U paxpivot -Fc paxpivot` into the same dated filename
pattern, logs a success or failure line (with the exit code) to `backup.log`, removes a partial
dump file on failure, and keeps the 30-day retention (`find … -mtime +30 -delete`). Dumps hold
trip data on a shared host, so the script sets `umask 077` before creating the dump and the log
(fixed after fresh review 1; see the Handoff's "Round 2" for verification of the resulting file
mode and the one-time `chmod` needed for the backups directory and any pre-existing dumps).

**Image pruning (`deploy/prune-images.sh`, added after fresh review 1).** The upgrade runbook in
`docs/DEPLOYMENT.md` needs to drop old `paxpivot-{api,web}` images after a successful deploy,
keeping only the tag just deployed and the previous one. The first version of this was an inline
`docs/DEPLOYMENT.md` shell snippet that trusted the same shell's `$TAG`/`$PREVIOUS_TAG` variables
set earlier in the runbook; fresh review 1 found that if the block is ever run alone (a new shell,
a dropped session, re-running just that block), both variables are empty, and GNU grep's
`-v -E "^(|)$"` then matches every non-empty tag — the invert (`-v`) keeps everything, so every
`paxpivot-{api,web}` image is deleted, including the one currently running and the rollback
target. BSD grep on macOS does not reproduce this (which is why local testing during the first
round missed it). Rather than patch the regex, this is now a tracked, shellcheck'd script that
never builds that pattern at all: it re-reads the currently deployed tag from `.env.production`
itself (so it does not depend on any shell variable surviving from an earlier step), takes the
previous tag as a required argument, and **aborts with a message and exits 1** if either is empty,
instead of silently proceeding with an empty match-everything pattern. It also skips any tag still
used by a running container (`docker ps --format '{{.Image}}'`) as an extra guard, matching the
review's "ideally also refuse to remove the tag of any running container" suggestion. Tag
comparison uses a POSIX `case` statement on quoted variables (glob-disabled by quoting, so it is
an exact literal match, not a regex/glob), not `grep`, so the original bug class cannot recur here.

## ADR decision

No ADR. This changes neither deployment topology (still the same five services, same images, same
network shape) nor a provider boundary, persistence strategy, or cross-package dependency
direction — it bounds resource usage, narrows Linux capabilities, adds log rotation, and moves two
already-live cron jobs into version control. Matches the "no ADR" precedent set by TASK-043 for
the same file.

## Acceptance criteria

- [x] Every service in `compose.prod.yml` (`proxy`, `web`, `api`, `postgres`, `redis`) has
      `mem_limit`, `cpus`, and an explicit `logging` block.
- [x] `web` and `api` have `cap_drop: ["ALL"]` and `security_opt: ["no-new-privileges:true"]`.
- [x] `postgres` and `redis` have `cap_drop: ["ALL"]`, the minimal `cap_add` they need, and
      `security_opt: ["no-new-privileges:true"]`.
- [x] `postgres` and `redis` under the new capability set start and become healthy against a data
      volume created by origin/main's compose file (upgrade path), not only a fresh volume.
- [x] `deploy/run-checks.sh` and `deploy/backup.sh` exist, are executable, POSIX-`sh`,
      shellcheck-clean, and behave exactly as specified (heartbeat on success only when
      configured; exit code propagated).
- [x] `deploy/cron/paxpivot-checks` and `deploy/cron/paxpivot-backup` are tracked and equivalent to
      the live hand-typed entries.
- [x] `.env.example` documents `PAXPIVOT_HEARTBEAT_URL` (optional, empty default).
- [x] `docs/DEPLOYMENT.md` documents cron-from-repo installation, the corrected upgrade runbook
      (pre-upgrade `pg_dump`, a 60s `/login` poll instead of an immediate check, the corrected
      TASK-043 claim, and the image-pruning command), the monthly restore drill, and heartbeat
      setup.
- [x] No unrelated files changed (`git diff --stat origin/main` limited to the owned paths).
- [x] (Added after fresh review 1) A heartbeat ping failure never turns a successful
      `check-sources` run into a reported failure, and never logs the heartbeat URL.
- [x] (Added after fresh review 1) The image-pruning step is self-contained and safe to run
      standalone: empty inputs abort instead of pruning, and a running container's tag is never
      removed.
- [x] (Added after fresh review 1) Backup dumps and the backup log are created owner-only
      (`umask 077`), with the pre-existing directory/files' one-time fix documented.
- [x] (Added after fresh review 1) Both cron files set an explicit `PATH`.
- [x] (Added after fresh review 1) The heartbeat URL parser tolerates surrounding quotes and a
      trailing CR.
- [x] (Added after fresh review 1) The restore-drill command in `docs/DEPLOYMENT.md` is
      copy-paste runnable (full `docker compose … exec` prefix).

## Required tests

No new `pytest`/`vitest` file: this is Docker/Compose/cron configuration, exercised by the manual
Docker verification and script runs recorded in the Handoff — the same evidentiary approach
TASK-043 used for the (also-untested-by-pytest) `web` healthcheck.

```text
Manual (recorded in Handoff): docker build + docker compose up --wait against both a fresh and an
existing (origin/main-created) volume; docker inspect for CapDrop/CapAdd/SecurityOpt/Memory/
NanoCpus/LogConfig; deploy/run-checks.sh against a local fake heartbeat listener (success/empty/
failure); deploy/backup.sh dump + restore into a scratch database; shellcheck.
```

## Verification commands

```bash
docker compose --env-file <scratch .env.production> -f compose.prod.yml -f deploy/compose.traefik.yml config --quiet
docker build -f apps/api/Dockerfile -t paxpivot-api:task045 .
docker build -f apps/web/Dockerfile -t paxpivot-web:task045 .

# Upgrade path: bring up origin/main's compose.prod.yml first (creates the volume), seed, mark it,
# tear down (keep volumes), then bring up the new compose.prod.yml against the same volume.
docker compose --env-file <scratch> -f <origin/main compose.prod.yml> -p task045 up -d --wait --no-build
docker exec task045-api-1 python -m paxpivot.tooling seed
docker exec task045-postgres-1 psql -U paxpivot -d paxpivot -c "CREATE TABLE task045_marker(id serial primary key, note text); INSERT INTO task045_marker(note) VALUES ('upgrade-path-proof');"
docker compose --env-file <scratch> -f <origin/main compose.prod.yml> -p task045 down --remove-orphans
docker compose --env-file <scratch> -f compose.prod.yml -p task045 up -d --wait --no-build
docker exec task045-postgres-1 psql -U paxpivot -d paxpivot -Atc "SELECT * FROM task045_marker;"
docker exec task045-api-1 python -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/ready').read())"
docker exec task045-web-1 node -e "fetch('http://127.0.0.1:3000/login').then(r=>console.log(r.status))"
docker inspect task045-{web,api,postgres,redis}-1 --format '{{.HostConfig.CapDrop}} {{.HostConfig.CapAdd}} {{.HostConfig.SecurityOpt}} {{.HostConfig.Memory}} {{.HostConfig.NanoCpus}} {{.HostConfig.LogConfig}}'

docker run --rm -v $PWD/deploy:/mnt:ro koalaman/shellcheck:stable /mnt/run-checks.sh /mnt/backup.sh /mnt/prune-images.sh

# deploy/run-checks.sh logic (paths/compose-file-set adapted for local testing; see Handoff)
# against a local `python -m http.server`-based fake heartbeat listener.
# deploy/backup.sh, then pg_restore into a scratch database and compare row counts.

make setup
make check
git diff --stat origin/main
```

## UI behaviour (screen tasks only)

Not a screen task; no UI change.

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies. A fresh engineering review with zero Critical and zero
Important findings is required before this agent may merge its own PR (see PR "## Review"
section).

## Out of scope

- Redis/rq removal (owner decision D-6; `docs/plans/2026-09-14-reconciled-plan.md` WP-07).
- Off-host backup replication (owner decision D-5; needs owner-provided credentials).
- Any Traefik middleware change (`deploy/compose.traefik.yml` is untouched; shared host).
- The Makefile and `.github/` (a parallel task owns them).
- `apps/web` and `apps/api` application code.
- Read-only root filesystem for any service (noted above as a follow-up).
- `proxy` capability hardening (noted above: not in the stated least-privilege scope, and
  unverifiable against the live topology since the `caddy` profile is never enabled there).
- Actually deploying to the pilot VPS — the orchestrator deploys after merge.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `foundation/TASK-045-ops-hardening` (branched from `origin/main` @ `25f1264`)

**Commit:** see PR; task file and implementation land as focused commits on this branch.

**Files changed:**

```text
compose.prod.yml
deploy/run-checks.sh                (new)
deploy/backup.sh                    (new)
deploy/cron/paxpivot-checks         (new)
deploy/cron/paxpivot-backup         (new)
.env.example
docs/DEPLOYMENT.md
docs/tasks/TASK-045-ops-hardening.md
```

**Interfaces added/changed:** see "Interfaces produced" above. No Python/TypeScript symbol
changed; `check_sources()`'s exit codes (0/2/3) are consumed unchanged.

**Migrations:** none.

**Verification run (2026-09-14):**

```text
docker --version                                       -> Docker version 29.3.1
docker compose version                                 -> v5.1.1

docker compose --env-file <scratch .env.production> -f compose.prod.yml \
  -f deploy/compose.traefik.yml config --quiet          -> PASS
  (rendered config inspected directly: web/api show cap_drop:[ALL], security_opt:
  [no-new-privileges:true], mem_limit "536870912", cpus 1; postgres/redis show cap_add:
  [CHOWN, DAC_OVERRIDE, FOWNER, SETGID, SETUID] in addition; every service shows
  logging: {driver: json-file, options: {max-size: 10m, max-file: "3"}})

docker build -f apps/api/Dockerfile -t paxpivot-api:task045 .   -> built (cached layers; no
  Dockerfile change in this task, confirmed via `git diff origin/main -- apps/api/Dockerfile
  apps/web/Dockerfile` == empty)
docker build -f apps/web/Dockerfile -t paxpivot-web:task045 .   -> built

Upgrade-path test (project -p task045, scratch env, PAXPIVOT_TAG=task045):
1. Brought up origin/main's compose.prod.yml (no cap/limit/logging hardening) -> all 4 services
   healthy. Seeded (9 sources, 4 terminals) and inserted a marker row
   (task045_marker: 'upgrade-path-proof') directly via psql.
2. `docker compose ... -p task045 down --remove-orphans` (volumes kept).
3. Brought up the NEW compose.prod.yml (this branch) against the same `task045_postgres-data`
   volume -> all 4 services (web, api, postgres, redis) transitioned to healthy under the new
   cap_drop/cap_add/mem_limit/cpus/logging config, using the SAME volume postgres wrote to under
   the old, fully-privileged config.
4. Verified: `SELECT * FROM task045_marker` -> `1|upgrade-path-proof` (data survived the
   privilege-narrowing upgrade). `/ready` -> `{"status":"ready"}`. web `/login` -> 200 (via
   `node -e fetch` inside the container, matching TASK-043's own verification style).
5. Repeated from a completely FRESH volume (`down --remove-orphans -v` then `up -d --wait` again
   with the new compose file, no prior origin/main run) -> also all 4 healthy, proving the same
   minimal capability set also covers first-time postgres `initdb`, not only an already-initialized
   data directory.

docker inspect (both the upgrade-path and fresh-volume runs; identical output each time):
  web:      CapDrop=[ALL] CapAdd=<none> SecurityOpt=[no-new-privileges:true]
            Memory=536870912 (512 MiB) NanoCpus=1000000000 (1.0)
            LogConfig={json-file, max-file:3, max-size:10m}
  api:      CapDrop=[ALL] CapAdd=<none> SecurityOpt=[no-new-privileges:true]
            Memory=536870912 (512 MiB) NanoCpus=1000000000 (1.0)
            LogConfig={json-file, max-file:3, max-size:10m}
  postgres: CapDrop=[ALL] CapAdd=[CAP_CHOWN, CAP_DAC_OVERRIDE, CAP_FOWNER, CAP_SETGID, CAP_SETUID]
            SecurityOpt=[no-new-privileges:true] Memory=1073741824 (1 GiB)
            NanoCpus=1000000000 (1.0) LogConfig={json-file, max-file:3, max-size:10m}
  redis:    CapDrop=[ALL] CapAdd=[CAP_CHOWN, CAP_DAC_OVERRIDE, CAP_FOWNER, CAP_SETGID, CAP_SETUID]
            SecurityOpt=[no-new-privileges:true] Memory=134217728 (128 MiB)
            NanoCpus=500000000 (0.5) LogConfig={json-file, max-file:3, max-size:10m}

Cap-set justification verified by reading, not guessing: `docker run --rm --platform linux/amd64
  --entrypoint sh postgis/postgis:16-3.5 -c 'cat /usr/local/bin/docker-entrypoint.sh'` shows
  `chown postgres` calls while root and `exec gosu postgres "$BASH_SOURCE" "$@"`;
  `docker run --rm redis:7.4.8-alpine cat /usr/local/bin/docker-entrypoint.sh` shows
  `find . \! -user redis -exec chown redis '{}' +` then `exec gosu redis "$0" "$@"` (redis image
  uses gosu too, not just su-exec, confirmed from the actual script). Both need SETUID/SETGID
  (gosu itself, uid 0 -> non-zero) and CHOWN (the chown calls); DAC_OVERRIDE/FOWNER cover
  permission-mismatch edge cases in the same fixup and were kept per the task brief's own
  suggested minimal set — not further minimized below that, since the exact set specified was
  verified sufficient on both a fresh and an existing volume.

deploy/run-checks.sh (adapted copy for local testing: /opt/paxpivot -> the worktree path,
  .env.production -> a scratch file, -f deploy/compose.traefik.yml dropped since the
  `dokploy-network` external network only exists on the real host, -p task045 added; identical
  control-flow logic to the tracked script otherwise) run against the local stack with a fake
  heartbeat listener (`python -m http.server`-equivalent on 127.0.0.1:8901, hits logged to a file):
  - Success (FIRECRAWL_API_KEY set to a dummy value so check_sources() takes the "provider
    configured, zero sources approved/enabled -> zero provider_failures" path, exit 0, no real
    network call): exit 0, hits.log recorded a request to /ping-success.
  - Empty PAXPIVOT_HEARTBEAT_URL: exit 0, no hits.log file created (no request made).
  - Failure (check command stubbed per the task brief's explicit allowance — `sh -c "echo
    simulated-check-sources-failure; exit 7"` in place of check-sources): script exited 7
    (propagated), no hits.log file created (no ping on failure).

deploy/backup.sh (same local adaptation: /opt/paxpivot -> worktree, .env.production -> scratch,
  traefik file dropped, -p task045 added): ran against the seeded stack (9 sources, 4 terminals,
  a second marker row 'restore-proof'). Produced paxpivot-2026-09-14.dump and appended
  "... backup ok: .../paxpivot-2026-09-14.dump" to backup.log. Restored with
  `pg_restore -U paxpivot -d restore_test` into a scratch database created via psql:
  restore_test.sources count = 9, restore_test.terminals count = 4,
  restore_test.task045_marker = (1, 'restore-proof') — all matched the live database at dump time.

shellcheck (via `docker run koalaman/shellcheck:stable`, local install unavailable):
  deploy/run-checks.sh, deploy/backup.sh, deploy/api-entrypoint.sh -> 0 findings at -S style
  (clean exit code 0).

make setup   -> PASS (pnpm install, uv sync, setup-env; "Local environment ready")
make check   -> PASS (format-check, lint, typecheck, test-unit, test-integration, build, migrate,
  migrate-check, compose-check all green; compose-check validates the local-dev compose.yml, not
  compose.prod.yml, same caveat TASK-043 recorded — compose.prod.yml is validated directly above)

git diff --stat origin/main -> compose.prod.yml, deploy/run-checks.sh, deploy/backup.sh,
  deploy/cron/paxpivot-checks, deploy/cron/paxpivot-backup, .env.example, docs/DEPLOYMENT.md,
  docs/tasks/TASK-045-ops-hardening.md — no other file changed.

All local Docker artifacts (task045-* containers, the task045 project network/volume, images
paxpivot-{api,web}:task045, the scratch .env.production and heartbeat-listener process) were
removed after verification; nothing was left running or tagged locally.
```

**Round 2 (2026-09-14, fresh review 1 on PR #57, head `efcf557`; 0 Critical / 3 Important /
3 Minor — the rest of the PR was independently reverified and found correct: upgrade path from
both an unhardened and a fresh volume, `docker inspect` matching the compose file, no permission
errors, `restart` staying healthy, the (then-inline) prune command's repo-scoping being safe
against decoy repos, a failed backup removing its partial dump and never pruning, restore working,
shellcheck clean, cron file names/modes/schedules, task scope, and the docs drift guard):**

1. **IMPORTANT — heartbeat curl failure reported as a false check-sources failure
   (`deploy/run-checks.sh`).** Under `set -eu`, `curl -fsS ...` failing (e.g. an unreachable
   heartbeat URL) exited the whole script with curl's own status even though `check-sources` had
   already succeeded — the reviewer observed exit 7 from an unreachable URL. Fixed by making the
   ping best-effort: `curl_status=0; curl ... || curl_status=$?`, then only *logging* a line
   (`heartbeat ping failed (curl exit N)`, no URL) when `curl_status` is non-zero, and always
   `exit`ing with `check-sources`' own `$status`. (A first attempt used
   `if ! curl ...; then curl_status=$?; ...; fi` — wrong, because inside that `then` branch `$?` is
   the exit status of the negated test, not curl's; it always read back `0`. Caught by testing
   against an actually-unreachable port before shipping the fix, not by inspection alone.)
2. **IMPORTANT — image-pruning block breaks with empty tags (`docs/DEPLOYMENT.md`).** Replaced the
   inline snippet with the tracked, shellcheck'd `deploy/prune-images.sh` (see "Design" above for
   why): it re-derives the current tag from `.env.production`, requires the previous tag as an
   argument, aborts with a message on either being empty, and skips any tag still in use by a
   running container.
3. **IMPORTANT — backup dumps world/group-readable (`deploy/backup.sh`).** Added `umask 077`
   before any file is created; documented `chmod 700 /opt/paxpivot/backups` and a one-time
   `chmod 600` for dumps written before this change.
4. **MINOR — cron `PATH` (`deploy/cron/paxpivot-*`).** Added
   `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin` to both files.
5. **MINOR — heartbeat URL quoting/CRLF (`deploy/run-checks.sh`).** After the `grep`/`cut`, the
   value is piped through `tr -d '\r'` and then a `case` strips one matching pair of surrounding
   `"..."` or `'...'` quotes.
6. **MINOR — restore-drill command not copy-paste runnable (`docs/DEPLOYMENT.md`).** Gave the
   row-count `psql` example the full
   `docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml exec -T postgres`
   prefix.

Re-verification (same local stack approach as Round 1: images rebuilt as `paxpivot-{api,web}:task045r`,
project `-p task045r`, scratch env, adapted script copies with `/opt/paxpivot` → the worktree path
and `.env.production` → a scratch file, run against real containers):

```text
docker compose --env-file <scratch> -f compose.prod.yml -f deploy/compose.traefik.yml \
  config --quiet -> PASS (unchanged by these fixes; re-run to confirm no regression)

shellcheck -S style deploy/run-checks.sh deploy/backup.sh deploy/prune-images.sh \
  deploy/api-entrypoint.sh -> 0 findings, exit 0

deploy/run-checks.sh, six scenarios against the local stack + a local `python -m http.server`
heartbeat listener on 127.0.0.1:8901:
  a. Unreachable heartbeat URL (http://127.0.0.1:1/..., nothing listens on port 1), check-sources
     succeeds -> exit 0; checks.log gained
     "heartbeat ping failed (curl exit 7)" (curl's real exit code, e.g. 7 = "couldn't connect");
     no URL appears in the log; no ping recorded by the listener.
  b. Heartbeat URL wrapped in double quotes with a trailing CR
     (`PAXPIVOT_HEARTBEAT_URL="http://127.0.0.1:8901/ping-quoted"` + `\r\n`, confirmed present in
     the file via `xxd`) -> exit 0; listener recorded a hit on /ping-quoted.
  c. Heartbeat URL wrapped in single quotes, no CR -> exit 0; listener recorded a hit on
     /ping-singlequoted.
  d. Empty heartbeat URL (regression) -> exit 0; no hit recorded.
  e. Plain unquoted URL, reachable (regression) -> exit 0; listener recorded a hit on
     /ping-success.
  f. Stubbed check-sources failure (`sh -c "echo simulated-check-sources-failure; exit 7"`,
     regression) -> exit 7 (propagated); no hit recorded.

deploy/backup.sh: ran against the seeded local stack. Created dump file mode: `-rw-------` (600,
confirmed via `ls -la`); backup.log mode also `-rw-------` (600) after a fresh creation. Restored
the post-umask-fix dump with `pg_restore` into a scratch database:
`restore_test.sources` count = 9 (matching the live, seeded database) — dump content and restore
path both unaffected by the umask change, only the file mode differs from Round 1.

deploy/prune-images.sh: tested inside `ubuntu:24.04` (GNU grep 3.11, confirmed via
`grep --version`; `/bin/sh` is dash) with a fake `docker` shell script standing in for the real
CLI (`docker images <repo> --format ...` / `docker ps --format ...` / `docker rmi <image>` each
backed by a fixture file, so the test exercises the script's own control flow rather than a real
Docker daemon) and dummy tags chosen to include decoys sharing a prefix with the real tags
(`abc123`, `abc123x`, `xabc123`) to prove the `case` match is exact, not a glob/prefix match:
  A. `PAXPIVOT_TAG=` (empty) in `.env.production`, no argument -> exit 1,
     "PAXPIVOT_TAG is not set in /opt/paxpivot/.env.production; refusing to prune"; nothing
     removed.
  B. `PAXPIVOT_TAG=abc123` set, no argument -> exit 1, "usage: ... <previous-tag>; refusing to
     prune with no previous tag given"; nothing removed.
  B2. Same, called with an explicit empty-string argument (`""`) -> same abort; nothing removed.
  C. `PAXPIVOT_TAG=abc123`, previous tag `def456` (also the tag of a fixture "running" web
     container) -> exit 0; removed exactly
     `paxpivot-api:{abc123x,xabc123,task045r}` and `paxpivot-web:{ghi789,task045r}`; kept exactly
     `abc123` and `def456` for both repos; the decoys `abc123x`/`xabc123` were correctly NOT kept
     despite sharing a prefix with `abc123`.
  D. Same tags, but the fixture "running" container instead uses a THIRD tag (`xabc123`, neither
     current nor previous) -> that tag was skipped with
     "skipping paxpivot-api:xabc123 (currently running)" and did not appear in the removed list,
     proving the running-container guard is independent of the current/previous check.

make check -> PASS (exit 0; same command set as Round 1)
git status --porcelain / git diff --stat origin/main -> unchanged file set from Round 1, plus the
  new deploy/prune-images.sh (still within deploy/**)

All Round 2 local Docker artifacts (task045r-* containers, project network/volume, images
paxpivot-{api,web}:task045r, the ubuntu:24.04 test container runs, the fake-docker/prune-test
fixtures, the heartbeat listener process, and every scratch file) were removed after verification.
```

**Known limitations / risks:**

- `proxy` (bundled Caddy) is not capability-hardened in this task (see "Design" above); it also
  gets no `cap_add: NET_BIND_SERVICE`, so enabling `--profile caddy` on a future host without also
  revisiting its capabilities would leave it running with the full default set. It does get the
  new `mem_limit`/`cpus`/`logging`, which are safe regardless of profile.
- No read-only rootfs (explicitly out of scope; each service needs its own writable-path audit).
- The `cap_add` set for `postgres`/`redis` was taken from the task brief's own suggestion and
  verified sufficient; it was not exhaustively minimized further (e.g. whether `DAC_OVERRIDE` is
  reachable in every code path was not isolated capability-by-capability) since the brief's
  "likely" list already worked on both a fresh and an existing volume.
- `deploy/run-checks.sh`/`deploy/backup.sh` hardcode `/opt/paxpivot`, matching every other
  production runbook command in `docs/DEPLOYMENT.md` (none of them are host-path-configurable
  today); a multi-host or differently-pathed deployment would need this revisited.
- The heartbeat feature depends on the owner creating an external monitor and setting
  `PAXPIVOT_HEARTBEAT_URL`; until then it is a documented no-op (empty by default), matching
  decision D-4's "owner creates the monitor" framing in the reconciled plan.
- Not deployed: per the task brief, the orchestrator deploys after merge. The VPS still has the
  old hand-typed `/etc/cron.d/paxpivot-{checks,backup}` files; `docs/DEPLOYMENT.md`'s new
  `install -m 0644 deploy/cron/paxpivot-* /etc/cron.d/` step overwrites them with byte-identical
  behavior (same schedule, same commands in effect) the first time it's run post-deploy.

**Next dependency:** none required to merge. A future task should revisit `proxy` capabilities if
the `caddy` profile is ever activated on a real host, and separately audit read-only rootfs
per-service.
