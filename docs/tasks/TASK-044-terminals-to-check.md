# TASK-044 — Terminals to check on the trip page

## Status

`review`

## Assigned role

`build`

## Goal

Replace `/trips/{tripId}`'s "No routes searched yet" / "Route search is not built yet" empty
state with an honest answer to "where should I go to fly?": every registered pilot terminal,
the trip's origin first, each with its own effective source state, read age, official-page link
and (where available) the registered restricted 72-hour schedule link — built only from
`/api/v1/terminals` and `/api/v1/terminals/{id}`, with no API, schema or migration change.

## Why this task exists

PAXPIVOT_PRODUCTION_PRD.md §4.3 ("Honest absence") requires PaxPivot to show which sources exist
and are worth checking rather than a dead end, even before route search (TASK-036, blocked on
TASK-032/035) exists. TASK-034 left the trip page as a plain "no route has been searched" panel;
TASK-037/038/041 already give every registered terminal an effective source state, a read age and
(for the four 72-hour schedule artifacts) a registered, restricted, user-open-only URL. This task
composes those already-live reads into the trip page's first useful answer, without inventing
eligibility, ranking, drive times or destination matching.

## Dependencies

- Required merged task/contract: `TASK-034` (trip requests), `TASK-021` (live terminals reads),
  `TASK-037` (schedule artifact sources, restricted), `TASK-038` (terminal page time stamp),
  `TASK-041` (derived source staleness)
- Required ADR, if any: `None`
- Required interface/schema: `apps/web/lib/api/contracts.ts::TerminalNetworkRead`,
  `TerminalDetailRead`, `TerminalSourceRead`; `apps/web/lib/presentation/source-state.ts`;
  `apps/web/lib/presentation/adapters/terminals.ts::ageView`, `toEvidenceView`

## Owned paths

```text
apps/web/app/trips/[tripId]/page.tsx
apps/web/app/trips/[tripId]/TerminalsToCheck.tsx
apps/web/lib/presentation/adapters/terminals-to-check.ts
apps/web/lib/presentation/adapters/terminals.ts        (export ageView; fix the restricted evidence row)
apps/web/tests/terminals-to-check.test.tsx
apps/web/tests/screens/results.test.tsx                (the "live /trips/[tripId] route" block)
apps/web/tests/adapters.test.tsx                        (the restricted "Open yourself" row test)
README.md                                               (the trip-page description only)
docs/plans/2026-09-14-reconciled-plan.md                (the Status section's Decisions paragraph only)
docs/tasks/TASK-044-terminals-to-check.md
```

Also normalized, per WORKFLOW.md §7, as the next agent to touch `docs/tasks/` after PR #52 merged:
`docs/tasks/TASK-043-web-healthcheck.md` (status/Handoff commit line only) and one new Status-table
row in `docs/plans/2026-09-14-reconciled-plan.md` (kept away from that PR's lines ~40-41).

## Read-only context

```text
PAXPIVOT_PRODUCTION_PRD.md §4.3, §16
paxpivot.md §7.4, §11.3
docs/architecture/UI_FOUNDATION.md
docs/tasks/SCREEN_TASK_RULES.md
apps/web/lib/api/client.ts::readApi
apps/web/lib/api/contracts.ts
apps/web/components/paxpivot/{SourceStateBadge,EvidenceAge,EvidenceRows}.tsx
apps/web/components/ui/{Card,Facts,ScreenSection,Button}.tsx
```

## Interfaces consumed

```text
apps/web/lib/api/client.ts::readApi<T>(path) -> ApiResult<T>
apps/web/lib/api/contracts.ts::TerminalNetworkRead, TerminalDetailRead, TerminalSourceRead, TripRead
apps/web/lib/presentation/adapters/terminals.ts::toEvidenceView, ageView
apps/web/lib/presentation/adapters/trips.ts::toTripDetailModel
apps/web/lib/presentation/source-state.ts::SOURCE_STATE_LEXICON
apps/web/components/paxpivot/{SourceStateBadge,EvidenceAge}.tsx
apps/web/components/ui/{Card,Facts,ScreenSection,Button}.tsx
```

## Interfaces produced

```text
apps/web/lib/presentation/adapters/terminals.ts::ageView   (now exported; behaviour unchanged)
apps/web/lib/presentation/adapters/terminals-to-check.ts::toTerminalsToCheckViewModel(trip, network, details, { now }) -> TerminalsToCheckViewModel
apps/web/lib/presentation/adapters/terminals-to-check.ts::TerminalsToCheckViewModel, TerminalToCheckRowView
apps/web/app/trips/[tripId]/TerminalsToCheck.tsx::TerminalsToCheck({ model })
```

`TerminalsToCheckViewModel`/`TerminalToCheckRowView` are a page-local composition of existing
presentation types (`Fact<T>`, `SourceEvidenceView`, `EvidenceAgeView`, `FactView`) — not a new
foundation screen model, and no field was added to any type in `lib/presentation/types.ts`.

## Acceptance criteria

- [x] The origin terminal is first, every registered terminal always appears, and the "not a
      ranking" copy is visible.
- [x] Failed (this app's own `/api/v1/terminals/{id}` read did not succeed), stale, never-checked
      and unavailable (`source_unreachable`) terminals all still appear with that state; a source
      failure never hides a terminal — it only means that terminal's schedule link is honestly
      unavailable.
- [x] The rendered page never contains forbidden wording: flight(s), departure(s), seat(s), "no
      flights", probability, or "chance of" — checked with word boundaries against the actual
      copy, so the required "PaxPivot does not read departure schedules yet" line and the shared
      SourceStateBadge accessibility text (already-reviewed foundation wording, e.g. "not a
      reservation or a seat") are not mistaken for a new violation.
- [x] The 72-hour schedule link is labelled "72-hour schedule — open yourself" and its `href` is
      exactly the registered `schedule_artifact` source's URL; PaxPivot never fetches, parses or
      displays the artifact's contents.
- [x] The terminal-detail Evidence tab's restricted 72-hour schedule row shows the restricted
      "Open yourself" wording (source-state.ts), never the generic "Unknown" pill, whether or not
      an observation exists for that source.
- [x] The layout works at 320px and on desktop, using only existing responsive tokens and
      components (`Card`, `Facts`, `ScreenSection`, `Button`); no new CSS framework, no new
      dependency.
- [x] Tests prove every behaviour above; axe finds no violations.
- [x] No unrelated files changed; only `apps/web` plus the docs named above.

## Required tests

```text
apps/web/tests/terminals-to-check.test.tsx              (ordering; each source state; missing
                                                           page time; restricted schedule link;
                                                           a failed/never-attempted detail read;
                                                           the three always-unknown facts; forbidden
                                                           wording across every state; axe)
apps/web/tests/screens/results.test.tsx                  (the live route: readApi called with the
                                                           right paths; ordering; each card's state;
                                                           schedule link; a failed per-terminal read
                                                           still shows the terminal; forbidden
                                                           wording; a failed network read is an
                                                           honest failure, not an empty list; axe)
apps/web/tests/adapters.test.tsx                         (the restricted "Open yourself" row, with
                                                           and without an observation, rendered in
                                                           the terminal detail Evidence tab)
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

No migrations changed, so `make migrate-test` is not required, but `make check` (which aggregates
the checks above) was run and is recorded in the Handoff below.

## UI behaviour (screen tasks only)

See `docs/tasks/SCREEN_TASK_RULES.md`. Specific to this page:

- Responsive: the terminal list is a single-column `ul`/`li` grid using `var(--space-3)` gaps
  (the same token `TerminalNetworkScreen` already uses); no fixed widths, so it reflows correctly
  at 320px and simply gets more breathing room on desktop inside `pp-main`.
- Accessibility: one `h1` (unchanged, from `AppHeader`); the new section is an `h2` via
  `ScreenSection`; each terminal card is an `h3` inside an `article` with `aria-labelledby`; the
  list carries `aria-label="Terminals to check"`; state is always text (`SourceStateBadge`), never
  colour alone; unknown facts read "Unknown" via the existing `Fact`/`FactValue` pattern.
- Loading/empty/error: this route already streams (Next default) with no client-side loader; a
  failed trip read keeps the existing `ErrorState`/`NotConfigured`/`notFound()` behaviour
  unchanged; a failed `/api/v1/terminals` read renders its own `ErrorState` ("a failure on our
  side") instead of an empty or fabricated terminal list; a failed per-terminal detail read never
  removes that terminal, only its schedule link.

## Review / merge rules

`docs/agent/MERGE_POLICY.md` and `docs/tasks/SCREEN_TASK_RULES.md` apply.

## Out of scope

- Not included: eligibility, commercial/Google Flights handoff, ranking, drive times, destination
  matching, any API/schema/migration change.
- Do not refactor: `components/paxpivot/{SourceStateBadge,EvidenceAge,EvidenceRows}.tsx`,
  `lib/presentation/types.ts`, or any other foundation-owned file beyond the two named,
  narrowly-scoped fixes in `adapters/terminals.ts` (exporting `ageView`; the restricted-row fix).
- Do not implement TASK-036 (direct opportunities/route cards) or any part of route search.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `build/TASK-044-terminals-to-check`

**Commit:** recorded in the PR.

**Files changed:** the owned paths above.

**Interfaces added/changed:** see "Interfaces produced".

**Migrations:** none.

**Verification run (2026-09-14, worktree `../PaxPivot-task044` on `origin/main` 25f1264 + this
change):**

```text
make setup             -> PASS
make format-check      -> PASS (after `make format`)
make lint               -> PASS
make typecheck          -> PASS
make test-unit          -> PASS: 283 Python, 357 web (+18 web: 12 new adapter/component tests,
                            4 new live-route tests, 1 new restricted-row test, +1 net from the
                            replaced live-route test)
make test-integration   -> PASS
make test               -> PASS
make build              -> PASS
make migrate            -> PASS
make migrate-check      -> PASS
make compose-check      -> PASS
make check              -> PASS (exit 0)
```

**Known limitations / risks:** the ponytail note in
`lib/presentation/adapters/terminals-to-check.ts` names the pilot ceiling (one detail read per
registered terminal, run in parallel) and when to move this into a dedicated API read model.
"Destinations served", "Entrance" and "Drive time" are deliberately always `unknown(...)` on this
page (not derived from the terminal's own verified-entrance data used elsewhere), since computing
them for a trip is out of scope here; a future task that wants a decided value for any of them is
a presentation-adapter change, not a reinterpretation of this page's honest defaults. A failure of
the `/api/v1/terminals` list read itself (as opposed to a single terminal's detail read) is shown
as one page-level `ErrorState`; there is no partial/never-observed terminal list to fall back to
in that case, since the terminal identities themselves are unknown.

**Next dependency:** TASK-036 (direct opportunities/route cards) remains the task that would
eventually replace this list with ranked routes once TASK-032/035 unblock it.
