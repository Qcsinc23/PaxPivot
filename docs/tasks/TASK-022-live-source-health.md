# TASK-022 — Live Advanced source-health wiring

## Status

`done` — merged to `main` in 64122a4 (PR #25); post-merge Quality green; Handoff recorded
below. Independent of TASK-021 (no shared paths).

## Assigned role

`build`

## Goal

`/advanced` renders live source health from `GET /api/v1/sources/health` through
`toSourceHealthScreenModel`, with honest states for every API outcome.

## Why this task exists

PRD milestone B "source operations UI"; the operations view is how a person sees approval state,
kill switches and the last check of every registered source before any source is enabled.

## Dependencies

- Required merged task: `TASK-020`.
- Environment: as TASK-021.

## Owned paths

```text
apps/web/app/advanced/page.tsx
apps/web/tests/screens/advanced-live.test.tsx
docs/tasks/TASK-022-live-source-health.md
```

## Read-only context

```text
apps/web/lib/api/{client,contracts}.ts
apps/web/lib/presentation/adapters/source-health.ts
apps/web/components/screens/advanced/SourceHealthScreen.tsx
apps/web/lib/api/examples/source-health.json
```

## Interfaces consumed

```text
lib/api/client.ts::readApi<SourceHealthRead>("/api/v1/sources/health")
lib/presentation/adapters/source-health.ts::toSourceHealthScreenModel(read, { now })
lib/presentation/screens/advanced.ts::emptySourceHealth
```

## Interfaces produced

None.

## Acceptance criteria

- [ ] Server component; `readApi` → adapter → `SourceHealthScreen`; token never in a client bundle.
- [ ] `ok` → ready; `not_configured` → `emptySourceHealth`; `unavailable`/`unauthorized` → error state.
- [ ] Never-observed sources render "Not checked yet"; a kill-switched source shows "Stopped";
      `restricted` shows "Restricted"; no movement rows are reproduced anywhere.
- [ ] Tests mock `@/lib/api/client`, drive all outcomes with the JSON example, assert the
      forbidden-wording scan (no "no flights", "none scheduled", "nothing flying"), axe per state.
- [ ] Live probe in the Handoff: seeded DB shows the directory source as "Needs review" /
      "Not checked yet"; token unset → error state.

## Required tests

```text
apps/web/tests/screens/advanced-live.test.tsx
```

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
```

## UI behaviour

See `docs/tasks/SCREEN_TASK_RULES.md`.

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies.

## Out of scope

- No operator actions (enable, approve, engage switch); read-only. No adapter/contract changes.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `build/TASK-022-live-source-health` from `main` @ `c12ba3c` (TASK-021 merge).

**Files changed:** the owned page and test paths, the owned task file, and one block of live-route
assertions in `apps/web/tests/screens/advanced.test.tsx` (see "Deviation").

**Interfaces added/changed:** none. `toSourceHealthScreenModel` and `emptySourceHealth` were used
as they are; no contract, adapter, component or screen model changed.

**Migrations:** none.

**Outcome mapping implemented**

| `readApi` result | model | what the user sees |
| --- | --- | --- |
| `ok` | adapter output | the registry; zero sources is a factual empty state |
| `not_configured` | `emptySourceHealth` | the honest "not available yet" state |
| `unauthorized` | `status: "error"` | "a failure on our side" |
| `unavailable` | `status: "error"` | "a failure on our side" |

**States preserved, proven against the committed JSON example** (`source-health.json`, which
carries one source of every review state): `Needs review`, `Restricted`, `Approved`, `Paused`; a
kill-switched source reads **`Stopped`**; three never-observed sources read **`Not checked yet`** in
both the state column and the time columns. Assertions are scoped to the table body, because the
summary band above it counts states across sources and legitimately repeats a label.

**Verification run:** after the final edit, on this branch rebased onto `main` @ `c12ba3c`:

```text
make format-check     -> PASS   make build         -> PASS
make lint             -> PASS   make migrate       -> PASS
make typecheck        -> PASS   make migrate-check -> PASS
make test-unit        -> PASS   make compose-check -> PASS
make test-integration -> PASS   make test           -> PASS
```

Counts: pytest 190 unit + 13 integration; Vitest 21 files / 319 tests (was 20/309 — the new
`tests/screens/advanced-live.test.tsx` adds 11, the removed stale block took 1).

**Live probe against the seeded database** (`make dev` with `PAXPIVOT_API_TOKEN` set on both
processes, `make seed` applied):

```text
GET /api/v1/sources/health  -> 200; 1 row, never_observed=1, counts=[]
                               AMC Travel Site (terminal directory)
                               review_state=needs_review, kill_switched=false, latest=null
/advanced                   -> 200; seeded name shown; pills exactly
                               ["Needs review", "Not checked yet"]; no movement wording;
                               no fixture text
```

Kill-switch path, probed for real rather than only from a fixture: engaging a source-scope switch on
the seeded source made `/advanced` render `["Needs review", "Not checked yet", "Stopped"]` — the
review state and the never-checked history were both preserved while processing was stopped. The
probe switch was then released (`released_at` set, the append-only-preserving way) and the label set
returned to `["Needs review", "Not checked yet"]`, with zero switches left engaged.

Token OPSEC: `grep -rl PAXPIVOT_API_TOKEN apps/web/.next/static` is **empty** after `make build`.

**Deviation (recorded).** `apps/web/tests/screens/advanced.test.tsx` is outside this task's owned
paths. It rendered the live page unmocked in two places: the rail-reachability check (now satisfied
by rendering `SourceHealthScreen` from `emptySourceHealth`, which is what that check actually
asserts — where the route sits in the rail) and a live-route block asserting the old empty state,
which the owned `advanced-live.test.tsx` now covers properly for every outcome. Net coverage
increased (11 new tests).

**Resolved ambiguity (product-owner decision).** Criterion 1 maps `not_configured` to
`emptySourceHealth`; the criterion-4 probe says "token unset → error state". The same contradiction
exists in TASK-021. Put to the product owner, who confirmed criterion 1 stands: `not_configured`
renders the empty state. The underlying intent of the probe still holds — with the token unset,
`/advanced` shows no seeded source and no table, so an unreachable API never appears as a factual
"no sources" listing. Recorded here so the criterion text can be corrected in a later docs pass.

**Pre-existing repo quirk observed (not introduced here).** `make dev` rewrites the tracked
`apps/web/next-env.d.ts` to `./.next/dev/types/...`; `make typecheck` / `make build` restore it to
`./.next/types/...`. Running the live probe therefore leaves that file modified until a typecheck or
build runs. Left as-is; it is outside this task's owned paths.

**Known limitations / risks:** as TASK-021 — the `not_configured` empty state is not visually
distinct from a genuinely empty registry, which is the accepted consequence of the decision above.

**Next dependency:** TASK-024 (build, ready).
