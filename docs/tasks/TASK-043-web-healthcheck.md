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
  interval: 10s
  timeout: 5s
  retries: 3
  start_period: 30s
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

**Timing (revised twice after review).** The first version used `interval: 2s` steady-state,
matching `postgres`. Fresh review 1 measured that on a real container this costs roughly 10% CPU
every 2s indefinitely, because each probe forks a fresh Node process — acceptable for a deploy-time
check, not for a probe that runs forever on a small pilot VPS. That version was replaced with a
`start_interval`-based design (a fast 2s cadence only while `starting`, a slow 30s steady cadence
once `healthy`). Fresh review 2 found that design unsafe: since Compose 2.24.0, `docker compose up`
against a Docker Engine older than 25 fails outright with `"can't set healthcheck.start_interval as
feature require Docker Engine v25"` and never creates the container
([docker-library/docker#473](https://github.com/docker-library/docker/issues/473)) — it does not
degrade to the plain `interval`, it fails the deploy. The pilot VPS's exact engine version isn't
recorded in this repository (`docs/DEPLOYMENT.md`'s host requirement only says "Docker Engine +
Compose v2"), so relying on `start_interval` risked turning "the field is ignored" into "the deploy
fails to create the container." The healthcheck now uses a single, engine-agnostic cadence instead:

- `interval: 10s` — one cadence throughout, `starting` and steady-state alike; short enough that a
  deploy still resolves quickly (Next.js binds its port in low single-digit seconds locally, so the
  first probe after container start typically already succeeds).
- `timeout: 5s` — generous enough that a slow render under load doesn't itself trip a failure.
- `retries: 3` — three consecutive failures before `unhealthy`.
- `start_period: 30s` — grace before a failing probe counts toward `retries`, comfortably above the
  ~1-3s Next.js actually takes to bind locally.

No Docker Engine or Compose version floor is required for this design; every field here has been
supported since long before the pilot's "Docker Engine + Compose v2" baseline. The Handoff's deploy
steps still record `docker version --format '{{.Server.Version}}'` as plain inventory (useful
context for any future tuning), with no conditional behavior riding on it.

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
# sample again after ~25s to see the steady ~10s cadence in .Log
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
superseded after fresh review 1 found the steady-state CPU cost; kept for history. `docker build`
+ `docker run --health-*` positive/negative transitions passed; `make check`/`make migrate-test`
passed (283 Python + 341 web unit, 40 integration).

**Verification run — round 2 (2026-09-14, after fresh review 1: a `start_interval`-based retiming —
fast 2s cadence only while `starting`, slow 30s steady cadence once `healthy` — plus the `/ready`
deploy-step fix and the `make compose-check` scope clarification):** superseded after fresh review
2 found `start_interval` unsafe (see "Timing" above: it fails container creation outright, not a
graceful degrade, on a Docker Engine older than 25 since Compose 2.24.0); kept for history only.
At the time, positive/negative `docker compose ... up --wait` transitions against that design
passed (healthy in 3s, a clean 30s steady cadence, unhealthy at ~121s against nothing listening);
`make check`/`make migrate-test` passed. None of those timing numbers apply to the current design.

**Verification run — round 3 (2026-09-14, after fresh review 2: `start_interval` removed, single
engine-agnostic `interval: 10s` / `timeout: 5s` / `retries: 3` / `start_period: 30s`; Known
limitations updated with the outage-under-load risk):**

```text
docker version --format '{{.Server.Version}}'          -> 29.3.1 (local Docker Desktop)
docker compose version                                 -> v5.1.1
  (recorded as plain inventory; no field in the current healthcheck design depends on either)

docker compose --env-file <scratch .env.production> -f compose.prod.yml config --quiet -> PASS
docker compose --env-file <scratch .env.production> -f compose.prod.yml -f deploy/compose.traefik.yml \
  config --quiet -> PASS (criterion d); resolved `web.healthcheck`: {test, timeout: 5s,
  interval: 10s, retries: 3, start_period: 30s} — no `start_interval` key present, confirmed by
  inspecting the rendered YAML directly.
make compose-check -> PASS; still only validates the default local-dev `compose.yml`, not
  `compose.prod.yml` — the two `-f compose.prod.yml` commands above remain the actual
  production-config evidence (Makefile intentionally unchanged; out of scope).

docker build -f apps/web/Dockerfile -t paxpivot-web:task043 .  -> built clean

Positive (criterion a) — the healthcheck exactly as Compose renders it, via compose itself:
  docker compose --env-file <scratch .env.production> -f compose.prod.yml -p task043 \
    up -d --wait --no-build --no-deps web
  -> exit 0, wall time 5s (timed with `date +%s`). Container StartedAt 12:21:50.189Z; first probe
     Start 12:21:55.235Z (+5.05s) — healthy on that very first probe, no failures. `--no-deps`
     started only `web`; `api` never ran, proving no API dependency. (Fresh review 3: the +5.05s
     is not "roughly half of `interval`" by coincidence — Docker Engine >= 25 applies an internal
     default start interval of 5s during `start_period` even when `start_interval` is not
     configured (moby `defaultStartInterval`, shipped in Engine 25.0.0, moby PR #40894). These
     measurements were taken on Engine 29.3.1 (`docker version --format
     '{{.Server.Version}}'`), so probes land about every 5s until `start_period` ends, then at
     the configured `interval: 10s`. On an Engine < 25 the first probe comes after a full
     `interval` (~10s) instead.)
  Torn down: `docker compose --env-file <scratch> -f compose.prod.yml -p task043 down --remove-orphans -v`.

Steady cadence (criterion b) — same run, container left up, sampled again ~26s later:
  Log held five entries: 12:21:55.235, 12:22:05.405 (+10.17s), 12:22:15.511 (+10.11s),
  12:22:25.627 (+10.12s), 12:22:35.736 (+10.11s) — a clean, unbroken ~10s steady cadence once
  healthy, matching `interval: 10s` exactly.

Negative (criterion c) — same setup, the scratch override file (not committed) setting
  `services.web.command: ["sleep", "3600"]` so nothing listens on the port:
  docker compose --env-file <scratch .env.production> -f compose.prod.yml -f <scratch override.yml> \
    -p task043 up -d --wait --no-build --no-deps web
  -> exit 1 ("container task043-web-1 is unhealthy"), wall time 51s. Container StartedAt
     12:22:58.195Z. docker inspect .State.Health: {"Status":"unhealthy","FailingStreak":3,
     "Log":[5 entries, all ExitCode 1]} at offsets +20.31s, +25.37s, +30.44s, +40.53s, +50.60s.
     The first three (+20.31s, +25.37s, +30.44s — ~5.06s/5.07s apart) are Engine 25's internal
     default 5s start-interval cadence during the 30s `start_period` (see the corrected mechanism
     in the positive-case note above), not a coincidence. FailingStreak 3 (not 5) shows only
     checks at/after the `start_period` boundary count toward `retries`: the +30.44s check (right
     at that boundary, itself one of the 5s-cadence probes) is the first counted failure, then
     +40.53s and +50.60s (each ~10.08s later, the configured `interval` once past `start_period`)
     are the 2nd and 3rd, crossing `retries: 3` and flipping to `unhealthy` at ~51s — the same
     "first counted failure at the start_period boundary, then (retries-1) more at the configured
     interval" pattern observed in round 2 at the larger (60s/30s) scale, now correctly attributed
     to Engine 25's default start cadence rather than a leftover `start_interval` artifact. Docker's
     health `Log` keeps only the 5 most recent entries, so any checks before +20.31s are not
     visible here — the clean, unbroken 10s steady cadence is established separately and
     unambiguously by the positive run above.
  Torn down the same way afterward.

Base-image check (unchanged from round 1/2): `docker run --rm node:24.15.0-slim sh -c 'which curl;
  which wget'` -> both empty (neither present), confirming the node -e/fetch probe is required.

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

**Round 4 (2026-09-14, fresh review 3: corrected the round-3 timing explanation only — docs-only,
no code/config change):** review 3 confirmed everything else (rendered config, `up --wait` timing,
`make check`, `make migrate-test`, scope, drift guard) and found one wording defect: round 3's
Handoff attributed the `+5.05s` first-probe timing to "roughly half of `interval`" by coincidence.
The real mechanism is Docker Engine >= 25's internal default start interval of 5s during
`start_period` (moby `defaultStartInterval`, shipped in Engine 25.0.0, moby PR #40894), which
applies even without `start_interval` configured — the local engine (29.3.1) has it, an
Engine < 25 would not. Corrected both the positive-case and negative-case timing explanations
above to name that mechanism instead of the coincidental one; no measurement changed, and
`compose.prod.yml` was not touched (nothing about the actual healthcheck config was wrong, only
the prose explaining an already-correct measurement). Checked the PR body and `docs/DEPLOYMENT.md`
for the same "half an interval" phrasing: `DEPLOYMENT.md` never had it (its "every 10s" wording
describes only the steady state, which review 3 confirmed is fine); the PR body had the raw
`~5.05s` figure without the wrong-mechanism claim, and was extended with the same correct
explanation for consistency. This being a docs-only change, `make check` and the Docker
positive/negative tests were not rerun — only the drift guard, below, which does not depend on
timing values.

```text
uv run --frozen pytest --confcutdir=tests tests/unit/test_docs_consistency.py -v
  -> PASS (5 passed): test_every_registered_route_is_documented,
     test_readme_reports_the_applied_migration_range, test_task_claims_match_the_task_contracts,
     test_every_documented_make_target_exists, test_readme_referenced_paths_exist
git diff --stat origin/main -> only compose.prod.yml, docs/DEPLOYMENT.md,
  docs/plans/2026-09-14-reconciled-plan.md, docs/tasks/TASK-043-web-healthcheck.md (unchanged set;
  this round only edited docs/tasks/TASK-043-web-healthcheck.md itself)
```

**Known limitations / risks:** a single `web` replica means a brief window while `--wait` is still
blocking (container `starting`) is expected downtime for that restart — Traefik has no other
backend to route to during that window and returns a proxy error rather than serving stale content;
this is unchanged from before and zero-downtime deploys are out of scope. No `--wait-timeout` is set
on the deploy command, so `up --wait` does not time out on its own; the actual bound is the
healthcheck's own state machine. From a cold start with nothing ever listening (the negative test,
criterion c), that measured **~51s**, somewhat faster than the naive `start_period + retries ×
interval` sum (30s + 30s = 60s): the health log's timestamps show the first failure that counts
toward `retries` lands right at the `start_period` boundary rather than a full `interval` after it,
so the practical bound is closer to `start_period + (retries - 1) × interval` (≈ 50s) — the same
pattern observed at the larger scale in review round 2's `~121s` measurement (`start_period` 60s +
`(retries-1)=2` × `interval` 30s ≈ 120s).

The more operationally relevant number is different: once `web` is already `healthy` and serving,
if `/login` renders slow enough under load to exceed the 5s `timeout` on `retries` (3) consecutive
probes, Docker flips the single `web` replica to `unhealthy` and Traefik stops routing to it — a
slowdown becomes a full outage rather than degraded service, because there is no second replica to
absorb load while the first recovers (zero-downtime / multi-replica deploys are out of scope, per
the task brief). That steady-state detection time is `retries × interval + timeout` ≈ 3 × 10s + 5s
= **~35s** worst case from the last good response to `unhealthy`. `timeout` (5s) and `retries` (3)
are the tuning knobs if this proves too sensitive (a slower detector) or too slow (a faster one) in
practice; `interval` (10s) is the other lever but changes steady-state probe frequency/cost too.

**Deploy-and-verify steps (not executed; VPS has no `make`):**

```bash
docker version --format '{{.Server.Version}}'   # record the VPS engine version (plain inventory)
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
