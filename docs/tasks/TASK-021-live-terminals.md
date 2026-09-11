# TASK-021 — Live Terminals wiring

## Status

`ready` — dispatch after TASK-020 is merged to `main`. Read `docs/tasks/SCREEN_TASK_RULES.md` and
`docs/architecture/UI_FOUNDATION.md` ("Presentation adapters") first.

## Assigned role

`build`

## Goal

`/terminals` renders the live terminal network and `/terminals/{terminalId}` the live terminal
detail from `GET /api/v1/terminals` and `GET /api/v1/terminals/{id}` through the foundation
adapters, with honest states for every API outcome.

## Why this task exists

First production path replacing fixture-only live behaviour (PRD milestone B, "source operations
UI"; ADR-004). The registry, entrance verification and evidence are already decided server-side;
the page only fetches, adapts and renders.

## Dependencies

- Required merged task: `TASK-020` (adapters, `readApi`, contracts, API).
- Environment: `PAXPIVOT_API_URL` and `PAXPIVOT_API_TOKEN` in the Next server environment
  (never `NEXT_PUBLIC_*`); the API started with the same `PAXPIVOT_API_TOKEN`.

## Owned paths

```text
apps/web/app/terminals/page.tsx
apps/web/app/terminals/[terminalId]/page.tsx
apps/web/tests/screens/terminals-live.test.tsx
docs/tasks/TASK-021-live-terminals.md
```

## Read-only context

```text
apps/web/lib/api/{client,contracts}.ts
apps/web/lib/presentation/adapters/terminals.ts
apps/web/components/screens/terminals/*
apps/web/lib/api/examples/terminal-{network,detail}.json
```

## Interfaces consumed

```text
lib/api/client.ts::readApi<T>(path) -> ApiResult<T>          (server component only)
lib/presentation/adapters/terminals.ts::toTerminalNetworkScreenModel(read, { now })
lib/presentation/adapters/terminals.ts::toTerminalDetailScreenModel(read, { now })
lib/presentation/screens/terminals.ts::emptyTerminalNetwork, emptyTerminalDetail
```

## Interfaces produced

None (pages only). Do not add fields to any screen model; record gaps under "Blocked".

## Acceptance criteria

- [ ] Both pages are async server components: `readApi` → adapter (`now = new Date()`) → screen.
      No fetch in the browser; no token in any client bundle (`grep -r PAXPIVOT_API_TOKEN .next/static` empty after `make build`).
- [ ] `ok` → ready model. `not_configured` → the existing empty model (the honest "not available"
      state; never fixture data). `unavailable`/`unauthorized` → screen `status: "error"`
      ("a failure on our side", never absence). `not_found` on detail → Next `notFound()`.
- [ ] A network payload with zero terminals renders the empty state; a payload whose terminals are
      never observed renders "Not checked yet" pills, never a state.
- [ ] Tests mock `@/lib/api/client` (`vi.mock`) and drive all four outcomes plus the JSON examples;
      assert no synthetic fixture string appears on the live route; axe on each state.
- [ ] Live probe recorded in the Handoff: `make dev` with `PAXPIVOT_API_TOKEN` set on both
      processes and `make seed` applied shows the four seeded terminals on `/terminals` with
      "Not checked yet"; with the token unset the page shows the error state, not an empty list.

## Required tests

```text
apps/web/tests/screens/terminals-live.test.tsx
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

See `docs/tasks/SCREEN_TASK_RULES.md`. Loading: Next streaming default is acceptable; do not
add a client-side loader.

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies.

## Out of scope

- No travel-time, reachability, ranking, opportunities, watch or compare behaviour; no map
  basemap; no client-side fetching; no change to adapters, contracts or screens.

## Blocked / contract change needed

`None`

## Handoff

(fill in per template)
