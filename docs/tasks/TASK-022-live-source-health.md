# TASK-022 — Live Advanced source-health wiring

## Status

`ready` — dispatch after TASK-020 is merged to `main`. Independent of TASK-021 (no shared paths).

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

(fill in per template)
