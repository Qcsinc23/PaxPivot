# TASK-047 — CI and dependency gates (vitest CVE, audits, image builds, prod compose validation)

## Status

`review`

## Assigned role

`foundation`

## Goal

Close four CI/dependency gaps the production-readiness audit found, in one task: the pinned
Vitest carries two published advisories; no CI step audits production dependencies for known
vulnerabilities; the two deployable Docker images (`apps/api/Dockerfile`, `apps/web/Dockerfile`)
are never built in CI, so a broken Dockerfile still passes; and `make compose-check` validates
only the local-dev `compose.yml`, leaving `compose.prod.yml` and `deploy/compose.traefik.yml`
completely unchecked. All four gates run inside the existing required `scaffold` job.

## Why this task exists

The product owner asked for the app to be production-ready; the audit is the concrete list of
what stands between here and that. `apps/web/package.json` pins `vitest` 4.0.18, which is inside
the vulnerable range of both GHSA-5xrq-8626-4rwp (critical — the Vitest UI/API server) and
GHSA-82fw-gwwq-j7x9 (moderate — `@vitest/mocker`); the fix is any 4.1.11+ patch on the 4.x line.
Separately, nothing in CI or `make check` ever runs a dependency-vulnerability scanner, so a new
advisory in a direct or transitive production dependency would ship silently. And CI never
exercises `apps/api/Dockerfile` / `apps/web/Dockerfile` or the production Compose files at all —
TASK-043's handoff explicitly recorded this: "`make compose-check` runs `docker compose config
--quiet` with no `-f` flags, so it validates the default local-dev `compose.yml`, not
`compose.prod.yml`." This task closes exactly that gap plus the sibling image-build gap, without
touching the pilot's actual deployment topology.

## Dependencies

`None`. Touches CI/build/dependency infrastructure only — no application code, schema, domain
contract, or `compose.prod.yml` content change. Coordinated with, but independent of, TASK-045
(which changes `compose.prod.yml` content in a parallel worktree): this task's Compose validation
is additive (`deploy/ci.env` supplies dummy values for variables the file already requires) and
does not depend on the specific services `compose.prod.yml` declares.

## Owned paths

```text
Makefile
.github/workflows/quality.yml
apps/web/package.json
pnpm-lock.yaml
deploy/ci.env                              (new — CI-only dummy values, never secrets)
README.md                                  (Makefile command table + Vitest version)
docs/tasks/TASK-047-ci-dependency-gates.md
```

## Read-only context

```text
AGENTS.md
docs/agent/WORKFLOW.md
docs/agent/MERGE_POLICY.md
docs/tasks/TASK_TEMPLATE.md
docs/tasks/TASK-043-web-healthcheck.md      (documented the compose-check scope gap this closes)
apps/api/Dockerfile
apps/web/Dockerfile
compose.yml
compose.prod.yml
deploy/compose.traefik.yml
pyproject.toml
```

## Interfaces consumed

```text
None (no application code contract; this is CI/build/dependency infrastructure).
```

## Interfaces produced

```text
Makefile::audit                 (new target: pnpm audit --prod + production pip-audit)
Makefile::build-images-check    (new target: builds apps/api + apps/web images, no push)
Makefile::compose-check         (extended: also validates compose.prod.yml + deploy/compose.traefik.yml)
deploy/ci.env                   (new: CI-only dummy values for the prod Compose `:?` variables)
```

Not a shared application contract; no ADR is required — this is CI/lint/test infrastructure,
which `AGENTS.md` names as foundation-owned by default, not an architecture/deployment-topology
change (the pilot's actual `compose.prod.yml` content is untouched).

## Design

**Vitest bump.** `apps/web/package.json` `vitest` 4.0.18 -> `4.1.11` (latest 4.x patch; the task
explicitly stays on the 4.x line, not 5.0). `pnpm install` re-resolved `pnpm-lock.yaml`, which
bumped every `@vitest/*` companion (`expect`, `mocker`, `pretty-format`, `runner`, `snapshot`,
`spy`, `utils`, plus the optional `browser-*`/`ui` peers) to `4.1.11` in lockstep — they are all
transitive to `vitest` itself, so no other `package.json` edit was needed. `pnpm test` (341 tests
across 25 files), `pnpm --filter web run typecheck`, and `pnpm --filter web run lint` all pass
unchanged.

**`make audit`.** Two commands, one target:

```makefile
audit:
	pnpm audit --prod --audit-level high
	uv export --frozen --no-dev --no-hashes | uvx pip-audit -r /dev/stdin --disable-pip --no-deps
```

`pnpm audit --prod` walks only the `dependencies` graph (never `devDependencies`), so the Vitest
advisories above never gate this target — they are caught by the full, non-`--prod` `pnpm audit`
instead, which is exactly the acceptance criterion. `--audit-level high` fails the command on
high/critical findings only (matches the "0 production vulnerabilities" baseline without making
every moderate transitive advisory a hard CI gate). For Python, `uv export --frozen --no-dev
--no-hashes` produces an unhashed, pinned requirements list of exactly the production
dependency set (the `--frozen` uv.lock, `--no-dev` drops the `ruff`/`mypy`/`pytest` dev group);
piping it into `pip-audit -r /dev/stdin --disable-pip --no-deps` audits precisely those pins
against the PyPI Advisory Database without pip re-resolving or pip-audit walking transitive
metadata itself. `pip-audit` prints one benign, expected line — it skips the local editable
`-e .` package ("could not deduce package version from URL requirement") — which is correct: the
in-repo package is not a third-party dependency to audit.

**`make build-images-check`.** `build-images` already builds both images without ever pushing;
`build-images-check: build-images` is a thin alias so CI's step and this task's contract have a
name that reads as a check rather than a release action, while `make build-images
PAXPIVOT_TAG=$TAG` (documented in `docs/DEPLOYMENT.md` as the real deploy build) keeps its
existing meaning untouched.

**`compose-check` extension.**

```makefile
compose-check:
	docker compose config --quiet
	docker compose -f compose.prod.yml -f deploy/compose.traefik.yml --env-file deploy/ci.env config --quiet
```

`compose.prod.yml` requires `PAXPIVOT_API_TOKEN`, `PAXPIVOT_SESSION_SECRET`,
`PAXPIVOT_PILOT_PASSPHRASE`, `POSTGRES_PASSWORD` and (only under the `web`/`proxy` services)
`PAXPIVOT_DOMAIN` via `${VAR:?...}` interpolation; `docker compose config` resolves interpolation
for every declared service regardless of Compose profiles, so all of them must resolve for
`--quiet` to exit 0. `deploy/ci.env` supplies one obviously-fake value per variable (each prefixed
`ci-fake-` or an `.invalid` domain, with a comment stating plainly these are not secrets and are
never used to start a real service) purely so the file's schema and variable graph can be
validated in CI. Nothing in this task changes what `compose.prod.yml` or
`deploy/compose.traefik.yml` actually declare, so the same `deploy/ci.env` keeps working
regardless of how TASK-045 changes that file's content, as long as it does not introduce a
*new* required variable — if it does, that follow-up task (or the next one to touch
`deploy/ci.env`) adds the corresponding dummy line.

**CI wiring.** `.github/workflows/quality.yml`'s `scaffold` job (name and triggers unchanged)
gains two `run:` steps, ordered so cheap/fast checks still run first and the slowest step (the
two Docker image builds, no layer cache available on a fresh runner) runs last, right before the
existing "did checks rewrite tracked files" / service-teardown steps:

```yaml
- run: make setup
- run: make check          # unchanged; compose-check inside it now also covers prod topology
- run: make audit           # new — network calls to two advisory databases, a few seconds
- run: make migrate-test    # unchanged
- run: make build-images-check   # new — slowest step, two cold Docker builds
- name: Ensure checks did not rewrite tracked files
  run: git diff --exit-code
```

No new GitHub Action was added (`ubuntu-24.04` runners ship Docker + buildx; the Makefile target
is a plain `docker build`, matching local usage). A Docker layer cache (`docker/build-push-action`
with `cache-from`/`cache-to`) was considered and rejected as not trivial: it is a new third-party
action plus GHA cache-backend wiring for a job that already finishes in a couple of minutes.
`timeout-minutes: 20` is untouched; the current run finishes in ~2 minutes, and the two new steps
add well under that margin (verified locally: `make audit` a few seconds, `make
build-images-check` ~15-30s warm / low minutes cold).

**`make check` composition — kept as-is, on purpose.** `check: format-check lint typecheck test
build migrate migrate-check compose-check` does **not** gain `audit` or `build-images-check`.
Rationale: `check` is the loop a developer or agent runs repeatedly while iterating, entirely
offline once `make setup` has run once; `audit` needs live network access to two advisory
databases (it will hang or fail hard offline, e.g. on a plane or a sandboxed CI mirror with no
egress), and `build-images-check` adds two full Docker image builds (node + python base images,
`pnpm install`, `next build`, `uv sync`) that roughly double the wall-clock time of `make check`
for a signal `make test`/`make build` mostly already covers (both images build from source
already exercised by `make build`; the image build mainly proves the *Dockerfile* itself, not
application correctness). Both new targets are still mandatory — they run unconditionally in CI's
`scaffold` job (the required check), so nothing ships without them; locally, a developer runs
`make audit` and `make build-images-check` explicitly before a task that touches dependencies or
the Dockerfiles, per the Verification commands below. This mirrors the existing split between
`make check` and `make migrate-test` / `make cold-start-check`, which are also required-but-slow
and are already invoked as separate steps rather than folded into `check`.

## Acceptance criteria

- [x] `vitest` (and every `@vitest/*` companion in `pnpm-lock.yaml`) is >= 4.1.11 and < 5.0.0.
- [x] `pnpm test` (341 tests, 25 files) passes unchanged under the bumped Vitest.
- [x] `pnpm audit --prod` reports 0 vulnerabilities.
- [x] The full (non-`--prod`) `pnpm audit` no longer lists GHSA-5xrq-8626-4rwp or
      GHSA-82fw-gwwq-j7x9.
- [x] `uv export --frozen --no-dev --no-hashes | uvx pip-audit -r /dev/stdin --disable-pip
      --no-deps` reports 0 known vulnerabilities.
- [x] `make audit` exists, runs both commands above, and its failure path was demonstrated once
      (a temporary known-vulnerable dependency in each ecosystem made the corresponding command
      exit non-zero) without committing that change.
- [x] `make build-images-check` builds `paxpivot-api:local` and `paxpivot-web:local` without
      pushing anything.
- [x] `make compose-check` validates both `compose.yml` and
      `compose.prod.yml` + `deploy/compose.traefik.yml` (via `deploy/ci.env`), and fails when
      `deploy/ci.env` is absent (demonstrated).
- [x] `deploy/ci.env` contains only obviously-fake, clearly-labeled non-secret values.
- [x] `.github/workflows/quality.yml`'s `scaffold` job (same name, same triggers) runs `make
      audit` and `make build-images-check` in addition to the existing steps.
- [x] `make check` exits 0 and its composition is unchanged except for the already-extended
      `compose-check` it calls.
- [x] README's Makefile command table documents `audit`, `build-images-check` and the extended
      `compose-check`; the Vitest version in the toolchain list matches `package.json`.
      `tests/unit/test_docs_consistency.py::test_every_documented_make_target_exists` passes.
- [x] CI's `scaffold` job is green on this PR's head SHA (recorded in Handoff below).
- [x] No unrelated files changed.

## Required tests

No new automated test files — this task is CI/build/dependency configuration, not application
behavior. The existing repository-wide guard that already covers this task's README edits:

```text
tests/unit/test_docs_consistency.py::test_every_documented_make_target_exists
```

is exercised by `make test-unit` (`pnpm test` for the web suite is the coverage for the Vitest
bump; there is no unit-test seam for "does `docker build` succeed" or "does `pnpm audit` exit
non-zero on a finding" beyond running the commands themselves, which the verification section and
this file's Design section both record as done against real tool output).

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
make audit
make build-images-check
make check
```

`make migrate-test` was not required by this task (no migration change) but was still run once as
part of the full canonical suite below.

## UI behaviour (screen tasks only)

Not applicable — no UI change.

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies with no task-specific exception. This PR's Handoff must
record fresh output for every command above, plus a green `scaffold` run on the exact head SHA
before merge is requested.

## Out of scope

- Not included: coverage thresholds, e2e tests, Redis removal.
- Not included: any change to `compose.prod.yml`'s content (TASK-045 owns that file in parallel;
  this task only adds a validation step that reads it).
- Do not refactor: application code, domain contracts, or anything outside the owned paths above.
- Do not bump `vitest` to `5.0`; stay on the `4.x` line.

## Blocked / contract change needed

`None`.

## Handoff

**Branch:** `foundation/TASK-047-ci-dependency-gates`

**Commit:** four focused commits on the branch (vitest bump; Makefile + `deploy/ci.env`; CI
workflow wiring; README) plus the task-file commit; see `git log origin/main..HEAD`. PR head SHA
`3ee837e1586f8950305e67252fdbd9175f6fec1b` (PR #55).

**PR:** https://github.com/Qcsinc23/PaxPivot/pull/55

**CI:** `scaffold` — SUCCESS on `3ee837e1586f8950305e67252fdbd9175f6fec1b`
(https://github.com/Qcsinc23/PaxPivot/actions/runs/34849226892/job/103992625782), 2m46s
end-to-end (`make audit` 4s, `make build-images-check` 44s).

**Files changed:**

```text
Makefile
.github/workflows/quality.yml
apps/web/package.json
pnpm-lock.yaml
deploy/ci.env                              (new)
README.md
docs/tasks/TASK-047-ci-dependency-gates.md
```

**Interfaces added/changed:**

```text
Makefile::audit                 (new)
Makefile::build-images-check    (new, alias of build-images)
Makefile::compose-check         (extended: also validates compose.prod.yml + deploy/compose.traefik.yml)
deploy/ci.env                   (new: CI-only dummy values, not secrets)
```

**Migrations:** None.

**Verification run:** on the branch head, worktree `../PaxPivot-task047` —

```text
make setup              -> PASS
make format-check       -> PASS (via make check)
make lint               -> PASS (via make check)
make typecheck          -> PASS (via make check)
make test-unit          -> PASS (283 pytest + 341 Vitest, 25 files)
make test-integration   -> PASS (40 tests, via make check -> test)
make test               -> PASS
make build              -> PASS (sdist/wheel + next build)
make migrate            -> PASS
make migrate-check      -> PASS
make compose-check      -> PASS (compose.yml; compose.prod.yml + deploy/compose.traefik.yml via deploy/ci.env)
make check              -> PASS (~53s wall)
make migrate-test       -> PASS (24 CHECK rules, drift + idempotent-seed + roundtrip)
make audit              -> PASS (pnpm audit --prod: 0 vulnerabilities; pip-audit: 0 known vulnerabilities)
make build-images-check -> PASS (paxpivot-api:local, paxpivot-web:local built, not pushed)
pnpm audit (full, non-prod) -> 0 vulnerabilities (previously 1 critical + 2 moderate, both vitest advisories)
```

Failure paths demonstrated once, not committed: a temporary `shell-quote@1.6.1` prod dependency
made `pnpm audit --prod --audit-level high` exit 1 (1 critical + 1 high finding), then
`apps/web/package.json`/`pnpm-lock.yaml` were restored and re-verified clean; a scratch
`django==1.4` requirements file (outside the repo, in `/tmp`) made
`uvx pip-audit -r ... --disable-pip --no-deps` exit 1 (90 known vulnerabilities); and running the
extended `docker compose ... config --quiet` without `--env-file deploy/ci.env` fails with
`required variable PAXPIVOT_DOMAIN is missing a value`, confirming the gate is real.

**Known limitations / risks:**

- `make check` intentionally does not run `audit` or `build-images-check` locally (see Design);
  both are mandatory in CI's `scaffold` job instead. A contributor who only runs `make check`
  before pushing will not locally see a new dependency advisory or a broken Dockerfile — CI is
  the backstop, as documented here and in the README.
- `deploy/ci.env` hardcodes the five variables `compose.prod.yml`/`deploy/compose.traefik.yml`
  currently require via `${VAR:?...}`. If a later task (e.g. TASK-045) adds a new required
  variable to those files, `make compose-check` will start failing until that variable's dummy
  value is added to `deploy/ci.env`.
- CI's `scaffold` job runtime with the two new steps: observed at 2m46s on PR #55's head
  (`make audit` 4s, `make build-images-check` 44s; the job was ~2m5s before this task), well
  inside the unchanged `timeout-minutes: 20`.

**Next dependency:** None. `docs/architecture/SCAFFOLD_EVIDENCE.md` and `IMPROVEMENT_LOG.md`
still describe the pre-TASK-047 CI step list; updating them was left out of this task's owned
paths (out of scope) and can be picked up by whichever task next touches those files.
