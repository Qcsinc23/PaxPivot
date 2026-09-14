# TASK-043 — Web container healthcheck so `up --wait` returns only when Next.js serves

## Status

`review`

## Assigned role

`foundation`

## Goal

After `docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml
up -d --wait --no-build` exits 0, the `web` container is already serving: a public request to
`/login` through the proxy returns 200 immediately, with no retry window. Zero-downtime /
blue-green deploys are out of scope; the fix is a correct Docker healthcheck plus `--wait`, not a
second web replica.

## Why this task exists

`docs/plans/2026-09-14-reconciled-plan.md` records, under "Found during M1, not yet acted on":
the `web` service has no Docker healthcheck, so `up --wait` returns as soon as the container is
*running*, not once Next.js is actually accepting connections. `docs/DEPLOYMENT.md`'s deploy
runbook already carries the observed symptom — Traefik answered 404 for a few seconds after the
2026-09-14 M1 deploy — and tells the operator to re-check `/login` by hand instead of trusting
`--wait`. That workaround is exactly the gap this task closes: `--wait` should mean what it says.

## Dependencies

None. Touches only `compose.prod.yml` and docs; no application code, schema, or contract changes.

## Owned paths

```text
compose.prod.yml
deploy/compose.traefik.yml                 (only if the healthy-routing note requires it; expected: no code change)
docs/DEPLOYMENT.md                         (web-restart/404 note only)
docs/plans/2026-09-14-reconciled-plan.md   (the "Found during M1" healthchecks bullet, lines ~40-41, only)
docs/tasks/TASK-043-web-healthcheck.md
```

Do not touch `docs/tasks/TASK-040-documentation-truth.md`, the plan's Status table (lines ~11-20),
or `IMPROVEMENT_LOG.md` — a parallel agent owns those.

## Read-only context

```text
AGENTS.md
docs/agent/WORKFLOW.md
docs/agent/MERGE_POLICY.md
apps/web/Dockerfile
apps/web/app/login/page.tsx
apps/web/lib/auth/config.ts
apps/web/app/layout.tsx
apps/web/components/shell/AppShell.tsx
Makefile
```

## Interfaces consumed

```text
None (no application code contract; this is infrastructure configuration).
```

## Interfaces produced

```text
compose.prod.yml::services.web.healthcheck   (new Docker HEALTHCHECK equivalent)
compose.prod.yml::services.proxy.depends_on.web.condition   (service_started -> service_healthy)
```

Not a shared application contract; no ADR is required (see "ADR decision" below).

## Design

**Probe command.** The web image (`apps/web/Dockerfile`, base `node:24.15.0-slim`) has no
`curl`/`wget` and this task adds no packages. The runtime already has `node`, so the probe is a
`node -e` one-liner using the global `fetch` (available since Node 18, present in Node 24):

```yaml
healthcheck:
  test:
    [
      "CMD-SHELL",
      "node -e \"const p=process.env.PORT||3000;fetch('http://127.0.0.1:'+p+'/login').then((r)=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))\"",
    ]
  interval: 30s
  timeout: 3s
  retries: 3
  start_period: 60s
  start_interval: 2s
```

It probes `127.0.0.1:$PORT` inside the container — the same host:port the Next.js server actually
binds (`apps/web/Dockerfile` sets `HOSTNAME=0.0.0.0 PORT=3000`; the probe reads `PORT` from the
environment rather than hardcoding it, so it stays correct if the port is ever overridden) — never
through Traefik or the published ports, so it cannot be affected by the reverse proxy.

**Route choice: `/login`, not `/health`-style API proxying.** `apps/web/app/login/page.tsx` is a
server component that calls `accessConfig()` (`apps/web/lib/auth/config.ts`), which reads only
`process.env.PAXPIVOT_PILOT_PASSPHRASE` / `PAXPIVOT_SESSION_SECRET` — no network call. Its parent
`apps/web/app/layout.tsx` renders `AppShell`, whose only children
(`DesktopRail`, `BottomNavigation`, `AskPaxPivotAction`) are all `"use client"` components, so
nothing in the render tree calls the API server-side. Whether access is `configured`,
`development_open`, or `misconfigured`, the page still renders normally and returns HTTP 200 (the
"not available" branch is a 200 page body, not a thrown error) — verified by reading the source,
not by guessing. This matches the existing preflight convention in `docs/DEPLOYMENT.md` ("web
`/login` → 200 with headers") and in the 2026-09-14 M1 deploy record, so the healthcheck asserts
exactly the signal operators already treat as "web is up." Consequence: the healthcheck reports
`healthy` even while `api`/`postgres`/`redis` are down or unreachable, which is required — a web
outage must not cascade into reporting `web` unhealthy for a dependency it doesn't own here.

**Timing (revised after review 1).** The first version used `interval: 2s` steady-state, matching
`postgres`. A fresh review measured that on a real container this costs roughly 10% CPU every 2s
indefinitely, because each probe forks a fresh Node process — acceptable for a deploy-time check,
not for a probe that runs forever on a small single-core-ish pilot VPS. The healthcheck now
separates the two concerns with `start_interval` (Docker Engine >= 25 / Compose >= 2.20):

- `start_interval: 2s` — the fast cadence used only while the container is `starting`, so a deploy
  still gets quick feedback (Next.js binds its port in low single-digit seconds locally).
- `interval: 30s` — the steady-state cadence once the container is `healthy` (or once
  `start_period` elapses without a success), so the forked-Node probe costs negligible CPU at run
  time instead of running every 2s forever.
- `start_period: 60s` — generous grace before a failing probe counts toward `retries`, safely above
  the ~1-3s Next.js actually takes to bind locally, without extending steady-state cost.
- `retries: 3` at the 30s steady interval (not 30 retries at 2s): three consecutive steady-state
  failures (~90s) is enough evidence the process is actually down, not just slow.
- `timeout: 3s` unchanged.

**Fallback on an older Docker daemon.** `start_interval` was added in Docker Engine 25 / Compose
2.20; `docs/DEPLOYMENT.md`'s host requirement only says "Docker Engine + Compose v2" (no version
pinned), and the pilot VPS's exact engine version is not recorded in this repository. An engine
that predates the field ignores it rather than erroring (Compose does not reject an unknown
healthcheck sub-field on an older engine), so the fallback behavior is: probes run at the normal
`interval` (30s) throughout, including while `starting`. Worst case, `up --wait` takes up to about
one `interval` (~30s) longer to observe the first successful probe than on an engine that honors
`start_interval` — still comfortably inside the 60s `start_period`, so `--wait` still succeeds, just
slower to report it. The Handoff's deploy steps record `docker version --format
'{{.Server.Version}}'` so this gets confirmed (or the fallback path gets seen) at actual deploy
time.

**`depends_on` on `web`.** Only `proxy` (the bundled Caddy profile, off on the Traefik pilot host)
declares `depends_on: web`, currently `condition: service_started`. Changed to
`condition: service_healthy`, matching the existing pattern one line below it in the same file
(`web` already depends on `api: condition: service_healthy`). This means a host using the `caddy`
profile gets the same fix Traefik gets via `--wait`: Caddy will not start routing to `web` until
Next.js is actually serving. `deploy/compose.traefik.yml` has no `depends_on` for `web` — Traefik
discovers containers by label at runtime, not at compose-up order — so no change is needed there;
see the Traefik routing note below instead.

**Traefik's Docker provider and health state.** Traefik's Docker provider only adds a container to
a router's load-balancer pool once Docker reports it `healthy`; while a container's Docker health
is `starting` or `unhealthy`, Traefik excludes it from the pool. With a single `web` replica (this
task does not change replica count — blue-green is out of scope), that means: during the window
where `web` is `starting` (right after container start, before the first successful probe) or
`unhealthy`, a request to the Traefik router for `paxpivot.qcs-cargo.com` has no available backend
and Traefik returns a proxy error (502/503) instead of 404. This is the intended outcome of adding
the healthcheck: `docker compose up --wait` blocks until Docker reports `web` `healthy`, so by the
time `--wait` returns 0 the container has already left `starting` and Traefik has already added it
to the pool — the operator-visible failure mode this task closes (404 immediately after `--wait`
returns) is eliminated. A brief 502/503 window can still occur for a request that lands *during*
the deploy, while `--wait` is still blocking; that is expected, in-scope downtime for a
single-replica restart, not a bug this task fixes (zero-downtime deploys are explicitly out of
scope per the task brief).

## ADR decision

No ADR. This does not change deployment topology (still one `web` container behind the same
proxy), the provider boundary, or cross-package dependency direction — it adds a Docker healthcheck
and tightens one `depends_on` condition to an already-established pattern in the same file.

## Acceptance criteria

- [x] `compose.prod.yml` and the Traefik override remain valid Compose config.
- [x] Positive: the web image built from `apps/web/Dockerfile`, run with the same healthcheck and
      no `api` reachable, transitions `starting` -> `healthy` (proves no API dependency).
- [x] Negative: the same probe command fails (non-zero exit / reports `unhealthy`) when nothing is
      serving on the probed port.
- [x] `proxy`'s `depends_on.web.condition` is `service_healthy`.
- [x] `docs/DEPLOYMENT.md`'s web-restart/404 note reflects the new behavior instead of telling the
      operator to work around it.
- [x] `docs/plans/2026-09-14-reconciled-plan.md`'s healthcheck bullet says this is addressed by
      TASK-043, pending deploy.
- [x] `make check` and the docs drift guard (`tests/unit/test_docs_consistency.py`) pass.
- [x] `git diff --stat origin/main` touches only the owned paths above.

## Required tests

No new automated test file: this is Docker/Compose configuration, exercised by the manual
positive/negative Docker verification below (recorded in the Handoff) rather than by
`pytest`/`vitest`, consistent with how `postgres`'s and `redis`'s existing healthchecks in this
file are verified (compose config + running behavior, no unit test wraps a Docker healthcheck).

```text
Manual (recorded in Handoff): docker build + docker run positive/negative healthcheck transitions.
```

## Verification commands

`make compose-check` runs `docker compose config --quiet` with no `-f` flags, so it validates the
default local-dev `compose.yml`, not `compose.prod.yml`; it is still required (repository-wide
check) but is not evidence for the production file. The production config is validated directly
with `-f compose.prod.yml` (and the Traefik override), against a scratch `.env.production` with
placeholder values matching `docs/DEPLOYMENT.md`'s required keys (never committed).

```bash
docker compose -f compose.prod.yml config                                            # fails without env; expected — see note below
docker compose --env-file <scratch .env.production> -f compose.prod.yml config --quiet
docker compose --env-file <scratch .env.production> -f compose.prod.yml -f deploy/compose.traefik.yml config --quiet
make compose-check   # validates compose.yml (local dev), not compose.prod.yml
docker version --format '{{.Server.Version}}'
docker compose --version 2>/dev/null || docker compose version

docker build -f apps/web/Dockerfile -t paxpivot-web:task043 .

# Positive (criterion b): the healthcheck exactly as Compose renders it, API not started.
docker compose --env-file <scratch .env.production> -f compose.prod.yml -p task043 \
  up -d --wait --no-build --no-deps web            # record wall time; expect exit 0
docker inspect --format '{{json .State.Health}}' task043-web-1   # expect starting -> healthy quickly
# sample again after ~70s to see the steady 30s cadence in .Log
docker compose --env-file <scratch .env.production> -f compose.prod.yml -p task043 down --remove-orphans -v

# Negative (criterion c): override the command so nothing listens, same healthcheck.
# Scratch override (not committed): services.web.command: ["sleep", "3600"]
docker compose --env-file <scratch .env.production> -f compose.prod.yml -f <scratch override.yml> \
  -p task043 up -d --wait --no-build --no-deps web   # expect exit 1; record elapsed time
docker inspect --format '{{json .State.Health}}' task043-web-1   # expect unhealthy
docker compose --env-file <scratch .env.production> -f compose.prod.yml -p task043 down --remove-orphans -v

make setup
make check
make migrate-test
docker rmi paxpivot-web:task043
rm -f <scratch .env.production> <scratch override.yml>
```

## UI behaviour (screen tasks only)

Not a screen task; no UI change.

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies. A fresh engineering review with zero Critical and zero
Important findings is required before this agent may merge its own PR.

## Out of scope

- Zero-downtime / blue-green / rolling deploys, a second `web` replica, or a load balancer in
  front of `web`.
- Alerting on health-state transitions.
- Changing `api`'s, `postgres`'s, or `redis`'s existing healthchecks.
- `docs/tasks/TASK-040-documentation-truth.md`, the plan's Status table, and `IMPROVEMENT_LOG.md`.
- Deploying to the pilot VPS (the task brief explicitly withholds that; exact deploy steps are
  recorded in the Handoff instead).

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `foundation/TASK-043-web-healthcheck` (rebased onto `main` @ `df0723d`, after the
TASK-040 status-normalization merge, PR #51)

**Commit:** `d6d1400` — "TASK-043: add web container healthcheck so up --wait returns only when
Next.js serves"

**Files changed:**

```text
compose.prod.yml
docs/DEPLOYMENT.md
docs/plans/2026-09-14-reconciled-plan.md
docs/tasks/TASK-043-web-healthcheck.md
```

**Interfaces added/changed:** see "Interfaces produced" above (`services.web.healthcheck`,
`services.proxy.depends_on.web.condition`).

**Migrations:** none.

**Verification run — round 1 (2026-09-14, on the rebased branch, `interval: 2s` steady-state):**
superseded by round 2 below after fresh review 1 found the steady-state CPU cost; kept for
history. `docker build` + `docker run --health-*` positive/negative transitions passed; `make
check`/`make migrate-test` passed (283 Python + 341 web unit, 40 integration).

**Verification run — round 2 (2026-09-14, after fresh review 1: `start_interval`/steady-`interval`
retiming, `/ready` deploy-step fix, `make compose-check` scope clarified):**

```text
docker version --format '{{.Server.Version}}'          -> 29.3.1 (local Docker Desktop)
docker compose version                                 -> v5.1.1
  (both comfortably >= the start_interval minimum: Engine 25 / Compose 2.20)

docker compose --env-file <scratch .env.production> -f compose.prod.yml config --quiet
  -> PASS (a bare `docker compose -f compose.prod.yml config` with no env file still fails on the
     pre-existing `${VAR:?...}` guards — unrelated to this change, and expected; DEPLOYMENT.md's
     own deploy commands always pass --env-file)
docker compose --env-file <scratch .env.production> -f compose.prod.yml -f deploy/compose.traefik.yml \
  config --quiet -> PASS; resolved `web.healthcheck` confirmed with start_interval: 2s / interval:
  30s / timeout: 3s / retries: 3 / start_period: 1m0s, exactly as authored
make compose-check -> PASS, but note: this target runs `docker compose config --quiet` with no
  `-f` flags, so it validates the repository's default local-dev `compose.yml`, not
  `compose.prod.yml`. It is still a required repository-wide check and passes, but the two
  `docker compose -f compose.prod.yml ...` commands above are the actual production-config
  evidence (Makefile intentionally not changed; out of scope).

docker build -f apps/web/Dockerfile -t paxpivot-web:task043 .  -> built clean
docker run --rm node:24.15.0-slim sh -c 'which curl; which wget'  -> both empty (neither present),
  confirming the node -e/fetch probe is required, not merely preferred

Positive (criterion b) — the healthcheck exactly as Compose renders it, via compose itself, not
hand-copied `docker run --health-*` flags:
  docker compose --env-file <scratch .env.production> -f compose.prod.yml -p task043 \
    up -d --wait --no-build --no-deps web
  -> exit 0, wall time 3s (timed with `date +%s` before/after). `--no-deps` starts only `web`,
     skipping `api`/`postgres`/`redis` entirely — `api` never ran during this test, proving no API
     dependency. `docker inspect .State.Health` immediately after: {"Status":"healthy",
     "FailingStreak":0,"Log":[{"Start":"2026-09-14T11:59:27.553Z",...,"ExitCode":0}]} — healthy on
     the very first probe.
  Sampled again ~75s later (container left running) to see the steady cadence once healthy:
     Log now held three entries — Start 11:59:27.553, 11:59:57.729 (+30.18s), 12:00:27.883
     (+30.15s) — a clean, precise 30s steady interval, confirming the CPU-cost fix actually takes
     effect once past startup.
  Torn down: `docker compose --env-file <scratch> -f compose.prod.yml -p task043 down --remove-orphans -v`.

Negative (criterion c) — same setup, a scratch override file (not committed) setting
  `services.web.command: ["sleep", "3600"]` so nothing listens on the port, same healthcheck as
  authored in compose.prod.yml:
  docker compose --env-file <scratch .env.production> -f compose.prod.yml -f <scratch override.yml> \
    -p task043 up -d --wait --no-build --no-deps web
  -> exit 1 ("container task043-web-1 is unhealthy"), wall time 121s.
     docker inspect .State.Health: {"Status":"unhealthy","FailingStreak":3,"Log":[5 entries, all
     ExitCode 1]}. Container StartedAt 12:01:09.663Z; the 5 retained log entries (Docker keeps only
     the most recent 5) landed at +56.40s, +58.51s, +60.60s, +90.69s, +120.78s — i.e. three checks
     ~2.1s apart (the tail of the `start_interval: 2s` fast cadence that ran, mostly scrolled out of
     the 5-entry log, throughout the 60s `start_period`), then two checks exactly 30.09s apart (the
     steady `interval`). FailingStreak 3 (not 5) confirms only checks at/after the `start_period`
     boundary count toward `retries`: the check at +60.60s (just past the 60s boundary) is the
     first counted failure, then +90.69s and +120.78s are the 2nd and 3rd, crossing `retries: 3`
     and flipping to `unhealthy` at ~121s — see "Known limitations" below for why this is faster
     than the naive `start_period + retries × interval` (150s) estimate.
  Torn down the same way afterward.

make check -> PASS (exit 0)
  format-check / lint / typecheck                 -> PASS
  test-unit                                       -> PASS: 283 Python, 341 web
  test-integration                                -> PASS: 40
  build / migrate / migrate-check / compose-check -> PASS
make migrate-test -> PASS (empty-database baseline, drift detection, idempotent seed, 24 CHECK
  rules, roundtrip)
tests/unit/test_docs_consistency.py -> PASS (5 cases, included in test-unit above; unaffected by
  this change since README.md/CONTRACTS.md do not describe compose healthchecks)
git diff --stat origin/main -> only compose.prod.yml, docs/DEPLOYMENT.md,
  docs/plans/2026-09-14-reconciled-plan.md, docs/tasks/TASK-043-web-healthcheck.md
git status --porcelain after `make check` (which runs `pnpm build`) -> clean; apps/web/next-env.d.ts
  was not rewritten this run (Next.js 16.3.4), so nothing needed restoring from origin/main.
```

All local Docker verification artifacts (containers, the `task043` compose project's network/
volume, image `paxpivot-web:task043`, the scratch `.env.production` and the scratch command-
override compose file) were removed after verification; nothing was left running or tagged
locally.

**Known limitations / risks:** a single `web` replica means a brief window while `--wait` is still
blocking (container `starting`) is expected downtime for that restart — Traefik has no other
backend to route to during that window and returns a proxy error rather than serving stale content;
this is unchanged from before and zero-downtime deploys are out of scope. No `--wait-timeout` is set
on the deploy command, so `up --wait` does not time out on its own; the actual bound is the
healthcheck's own state machine, and it is *not* simply `start_period + retries × interval` (60s +
90s = 150s) — measured empirically at **~121s** (criterion c below) with nothing listening on the
port. The reason: `docker inspect`'s `.State.Health.Log` retains only the 5 most recent checks, so
the ~28 fast (`start_interval: 2s`) failures during the 60s `start_period` scroll out of view, but
the timestamps of the 5 retained checks show the mechanism precisely — a fast check already
in flight lands right at the `start_period` boundary (`+60.6s` in the observed run) and becomes the
*first* failure that counts toward `retries` (failures strictly inside `start_period` never count),
then two more failures at the 30s steady `interval` (`+90.7s`, `+120.8s`) reach `retries: 3` and the
container flips to `unhealthy`. So the practical bound is closer to
`start_period + (retries - 1) × interval` (≈ 120s) than the naive sum, because the boundary check
that starts the counted streak lands at the *start* of `start_period`'s last `interval`-worth of
counted failures, not a full `interval` after it. Either way, once `web` is genuinely down, Compose
sees the terminal `unhealthy` state and `up --wait` exits 1 well under two minutes rather than
hanging indefinitely.

**Deploy-and-verify steps (not executed; VPS has no `make`):**

```bash
docker version --format '{{.Server.Version}}'   # record the VPS engine version (start_interval needs >= 25)
cd /opt/paxpivot && git pull --ff-only   # picks up the new compose.prod.yml
TAG=$(git rev-parse --short HEAD)
docker build -f apps/api/Dockerfile -t paxpivot-api:$TAG .
docker build -f apps/web/Dockerfile -t paxpivot-web:$TAG .
# set PAXPIVOT_TAG=$TAG in .env.production (note the previous value for rollback)
docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml up -d --wait --no-build
# do not run this within ~5 minutes of the 00/06/12/18 UTC source checks
# /ready is api-only and unreachable from outside the stack (docs/DEPLOYMENT.md:21); a public
# curl of it 307s to /login (web's isPublicPath guard) and `curl -f` alone would wrongly exit 0
# on that redirect, so use the internal exec form instead (docs/DEPLOYMENT.md:61-62):
docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml exec api python -c \
  "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/ready').read())"
curl -o /dev/null -s -w '%{http_code}\n' https://$PAXPIVOT_DOMAIN/login     # expect 200, immediately after --wait returns
curl -o /dev/null -s -w '%{http_code}\n' https://$PAXPIVOT_DOMAIN/terminals # expect 307 (signed out)
docker inspect --format '{{.State.Health.Status}}' <web container id>      # expect healthy
```

**Next dependency:** none; this closes the "Found during M1" healthcheck bullet in the reconciled
plan.
