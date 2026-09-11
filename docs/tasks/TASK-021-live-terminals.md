# TASK-021 — Live Terminals wiring

## Status

`review` — TASK-020 is merged (`f430acb`); implemented and verified. Read
`docs/tasks/SCREEN_TASK_RULES.md` and `docs/architecture/UI_FOUNDATION.md` ("Presentation
adapters") first.

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

**Branch:** `build/TASK-021-live-terminals` from `main` @ `59706b0`.

**Files changed:** both owned page paths, the owned test file, and one line of live-route
assertions removed from `apps/web/tests/screens/terminals.test.tsx` (see "Deviation" below).

**Interfaces added/changed:** none. No screen model, adapter, contract or component changed.

**Migrations:** none.

**Outcome mapping implemented**

| `readApi` result | model | what the user sees |
| --- | --- | --- |
| `ok` | adapter output | the registry; zero terminals is a factual empty state |
| `not_configured` | `status: "empty"` | "No terminals yet" / "No terminal to show yet" |
| `unauthorized` | `status: "error"` | "a failure on our side" |
| `unavailable` | `status: "error"` | "a failure on our side" |
| detail `not_found` | Next `notFound()` | 404; nothing rendered |

A never-observed terminal renders **"Not checked yet"** and no source state, asserted on the
rendered pill labels rather than raw text (the screen-reader disclaimers legitimately contain
phrases such as "not evidence of no departures", so matching full `textContent` would have been
both a false positive and a weaker test).

**Verification run:** after the final edit, on this branch rebased onto `main` @ `59706b0`:

```text
make format-check     -> PASS   make build         -> PASS
make lint             -> PASS   make migrate       -> PASS
make typecheck        -> PASS   make migrate-check -> PASS
make test-unit        -> PASS   make compose-check -> PASS
make test-integration -> PASS   make test           -> PASS
```

Counts: pytest 190 unit + 13 integration; Vitest 20 files / 309 tests (was 19/295 — the new
`tests/screens/terminals-live.test.tsx` adds 15, and the removed stale block took 1).

**Live probe against the seeded database** (`make dev` with `PAXPIVOT_API_TOKEN` set on both
processes, `make seed` applied):

```text
GET /api/v1/terminals  no auth        -> 401
GET /api/v1/terminals  with auth      -> 200, 4 seeded terminals, latest=null, entrance=null
GET /api/v1/terminals/{id}            -> 200
/terminals                            -> 200; all four seeded terminals listed;
                                         "Not checked yet" rendered; no fixture strings
/terminals/{id}                       -> 200; name shown; "Not checked yet"; no entrance claim
/terminals/{unknown-uuid}             -> 404
```

Token OPSEC: `grep -rl PAXPIVOT_API_TOKEN apps/web/.next/static` is **empty** after `make build`;
the only hits under `.next/` are server-side SSR chunks, which is where it belongs.

**Deviation from the task file (recorded, not silently taken).** `tests/screens/terminals.test.tsx`
is outside this task's owned paths, but it imported both live pages and asserted they render the
empty state. Those pages now require an API, so that block would have asserted the
`not_configured` branch by accident — a test that passes for the wrong reason. The block and its
two now-unused imports were removed; both routes are covered end to end, with the client mocked,
in the owned `terminals-live.test.tsx`. Net coverage of the live routes increased.

**Ambiguity in the task file (recorded).** Acceptance criterion 1 maps `not_configured` to the
*empty* model, but the criterion-4 probe expects the *error* state when the token is unset. The
implemented behaviour follows criterion 1, the explicit mapping: with the token unset the page
renders "No terminals yet" and never an empty list with fixture data, so the underlying intent of
criterion 4 holds. If the intent was a visibly distinct "not configured" error, that needs a
foundation decision, because `emptyTerminalNetwork` is the only existing model the task authorises
this task to use.

**Known limitations / risks:** the `not_configured` empty state and a genuinely empty registry
render the same model, so a deployment missing its token looks like "no terminals" rather than
"not configured"; the wording ("Terminal travel times are not available yet, so there is no network
to show") is honest but is not a configuration warning. Flagged above for a foundation decision.

**Next dependency:** TASK-022 (build, ready; independent — no shared paths); TASK-024 (build,
ready).
