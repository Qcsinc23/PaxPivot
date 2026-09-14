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
  interval: 2s
  timeout: 3s
  retries: 30
  start_period: 10s
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

**Timing.** `interval`/`timeout` (2s/3s) match `postgres`'s existing healthcheck in
`compose.prod.yml`; `retries: 30` (vs. postgres's 45) reflects that a pre-built Next.js standalone
server binds its port in low single-digit seconds once the container process starts, not the tens
of seconds Postgres can take on a cold volume. `start_period: 10s` is new (neither existing
healthcheck in this file sets one) because, unlike `postgres`/`redis`, `web` needs a brief grace
window for Node's process startup and first module evaluation before the first probe can succeed;
a failure inside `start_period` does not count against `retries`, so it costs nothing when the
container is already fast (a successful probe still flips it to `healthy` immediately) and only
matters on a slow start.

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

```bash
docker compose -f compose.prod.yml config
docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml config --quiet
make compose-check
docker build -f apps/web/Dockerfile -t paxpivot-web:task043 .
docker run -d --name paxpivot-web-task043 \
  --health-cmd "node -e \"const p=process.env.PORT||3000;fetch('http://127.0.0.1:'+p+'/login').then((r)=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))\"" \
  --health-interval=2s --health-timeout=3s --health-retries=30 --health-start-period=10s \
  -e PAXPIVOT_API_URL=http://127.0.0.1:1 \
  -e PAXPIVOT_API_TOKEN=x -e PAXPIVOT_SESSION_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -e PAXPIVOT_PILOT_PASSPHRASE=xxxxxxxxxxxxxxxxxxxx \
  paxpivot-web:task043
docker inspect --format '{{json .State.Health}}' paxpivot-web-task043   # expect starting -> healthy, api never running
docker rm -f paxpivot-web-task043
# Negative: same probe against a port nothing serves
docker run --rm paxpivot-web:task043 node -e "fetch('http://127.0.0.1:9/login').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1)); " ; echo "exit=$?"
make setup
make check
make migrate-test
$(uv run --frozen 2>/dev/null; true)  # docs guard runs inside make test-unit / make check
docker rmi paxpivot-web:task043
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

**Verification run (2026-09-14, on the rebased branch):**

```text
docker compose --env-file .env.production -f compose.prod.yml config --quiet
  -> PASS (valid; required-var interpolation for PAXPIVOT_DOMAIN/PAXPIVOT_API_TOKEN/etc. needs an
     env file exactly as docs/DEPLOYMENT.md's own deploy commands use — a bare
     `docker compose -f compose.prod.yml config` with no env file fails on the pre-existing
     `${VAR:?...}` guards, unrelated to this change)
docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml \
  config --quiet -> PASS; resolved `web.healthcheck` block confirmed correct (test/interval/
  timeout/retries/start_period all present as authored)
make compose-check -> PASS (docker compose config --quiet on the default compose.yml, exit 0)

Positive (criterion 2): docker build -f apps/web/Dockerfile -t paxpivot-web:task043 .  -> built
  clean. docker run -d --health-cmd '<the compose probe>' --health-interval=2s --health-timeout=3s
  --health-retries=30 --health-start-period=10s -e PAXPIVOT_API_URL=http://127.0.0.1:1 (nothing
  listening) ... paxpivot-web:task043
  -> docker inspect .State.Health: starting immediately after start, healthy on the very first
     probe (~1s later), 4 consecutive healthy checks observed, 0 errors/warnings in logs, API
     never reachable throughout. Proves no API dependency.

Negative (criterion 3): same image, command overridden to `sleep 3600` (nothing serves the port),
  healthcheck with retries=3/start_period=1s for a fast cycle -> starting for ~4s, then unhealthy
  with FailingStreak 3, each probe run exiting code 1. Also ran the probe as a one-off against the
  wrong port (9 instead of $PORT) on a running container: `node -e "...fetch('http://127.0.0.1:9
  /login')..."` -> exit 1.

Base-image check: `docker run --rm node:24.15.0-slim sh -c 'which curl; which wget'` -> both empty
  (neither present), confirming the node -e/fetch choice is required, not merely preferred.

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

All local Docker verification artifacts (containers `paxpivot-web-task043`,
`paxpivot-web-task043-neg`, image `paxpivot-web:task043`, the scratch `.env.production`) were
removed after verification; nothing was left running or tagged locally.

**Known limitations / risks:** a single `web` replica means a brief window while `--wait` is still
blocking (container `starting`) is expected downtime for that restart — Traefik has no other
backend to route to during that window and returns a proxy error rather than serving stale content;
this is unchanged from before and zero-downtime deploys are out of scope. `retries: 30` /
`interval: 2s` gives roughly a minute of grace before Docker gives up and reports `unhealthy`; if
production `web` startup is ever much slower than observed locally (~1s to first successful probe),
`--wait`'s own default timeout (compose's `--wait-timeout`, not overridden here) would still bound
the deploy command.

**Deploy-and-verify steps (not executed; VPS has no `make`):**

```bash
cd /opt/paxpivot && git pull --ff-only   # picks up the new compose.prod.yml
TAG=$(git rev-parse --short HEAD)
docker build -f apps/api/Dockerfile -t paxpivot-api:$TAG .
docker build -f apps/web/Dockerfile -t paxpivot-web:$TAG .
# set PAXPIVOT_TAG=$TAG in .env.production (note the previous value for rollback)
docker compose --env-file .env.production -f compose.prod.yml -f deploy/compose.traefik.yml up -d --wait --no-build
# do not run this within ~5 minutes of the 00/06/12/18 UTC source checks
curl -fsS https://$PAXPIVOT_DOMAIN/ready   # inside the stack only; see docs/DEPLOYMENT.md for the exec form
curl -o /dev/null -s -w '%{http_code}\n' https://$PAXPIVOT_DOMAIN/login     # expect 200, immediately after --wait returns
curl -o /dev/null -s -w '%{http_code}\n' https://$PAXPIVOT_DOMAIN/terminals # expect 307 (signed out)
docker inspect --format '{{.State.Health.Status}}' <web container id>      # expect healthy
```

**Next dependency:** none; this closes the "Found during M1" healthcheck bullet in the reconciled
plan.
