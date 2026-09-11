# TASK-013 — Trips shelf and Alerts feed

## Status

`review` — implemented on `build/TASK-013-trips-and-alerts`; see Handoff.

## Assigned role

`build`

## Goal

Implement the Trips list (watched trips with change badges and user-set journey status) and the Alerts feed (chronological one-liners with a filter row and a single action each).

## Why this task exists

PRD §13 (notifications continue the trip-planning goal; movement detail stays gated) and pilot §7.3 (user-confirmed arrival state, never inferred). Both are shell destinations.

## Dependencies

- Required merged task/contract: `TASK-006`

## Owned paths

```text
apps/web/app/trips/page.tsx
apps/web/app/alerts/**
apps/web/app/showcase/trips/**
apps/web/app/showcase/alerts/**
apps/web/components/screens/trips/**
apps/web/components/screens/alerts/**
apps/web/lib/presentation/screens/trips.ts
apps/web/lib/presentation/screens/alerts.ts
apps/web/tests/screens/trips.test.tsx
apps/web/tests/screens/alerts.test.tsx
docs/tasks/TASK-013-trips-and-alerts.md
```

`apps/web/app/trips/[tripId]/**` belongs to TASK-009/010/011; do not touch it.

## Read-only context

```text
docs/architecture/UI_FOUNDATION.md
apps/web/components/**
apps/web/lib/presentation/**
PAXPIVOT_PRODUCTION_PRD.md §13
```

## Interfaces consumed

```text
components/ui: AppHeader, IconButton, Card, SegmentedControl, Disclosure, Button, EmptyState, LoadingState, ErrorState
components/paxpivot: TripCard, AlertList, AlertRow, SourceLedger, StatusPill
lib/presentation/types: TripCardView, AlertRowView, AlertKind, SourceLedgerRowView
```

## Interfaces produced

```text
lib/presentation/screens/trips.ts::TripsScreenModel (status; trips: readonly TripCardView[];
  journeyStatus: { value: "not_started" | "travelling" | "arrived" | "did_not_board"; note }; newTripHref)
lib/presentation/screens/alerts.ts::AlertsScreenModel (status; filter: "all" | AlertKind; alerts: readonly AlertRowView[];
  emailNote: { title; body }; settingsHref)
lib/presentation/screens/trips.ts::fixtureTrips  lib/presentation/screens/alerts.ts::fixtureAlerts
components/screens/trips/TripsScreen.tsx, components/screens/alerts/AlertsScreen.tsx
```

## Acceptance criteria

- [x] Trips: `TripCard`s in supplied order; a "Where are you now?" card with a `SegmentedControl` (Not started / Travelling / Arrived / Didn't get on) and the model's note that nothing is inferred from location, schedules or aircraft data; a labelled "New trip" `IconButton`.
- [x] Trips without a route show their source summary pills and a "See what was checked" disclosure/link, never an empty card.
- [x] Alerts: filter `SegmentedControl` (All / Routes / Sources / Readiness) that only reflects the model's filter; `AlertList` with time and one action per row; the "Email keeps it vague on purpose" card with a `Disclosure` for the body.
- [x] Empty states: "No trips yet" with a Plan action; "Nothing to report" for alerts.
- [x] Live routes render empty states; showcase renders fixtures.
- [x] Tests, axe, responsive and accessibility rules.

## Required tests

```text
apps/web/tests/screens/trips.test.tsx, alerts.test.tsx — order; journey status chips; email note disclosure; empty states; axe
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

## Out of scope

- No notification settings screen (Profile task), no subscription persistence, no data fetching.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `build/TASK-013-trips-and-alerts` from `main` @ `54ca75e` (TASK-012 merge).

**Commit:** Reported in the PR.

**Files changed** (all owned paths):

```text
apps/web/lib/presentation/screens/trips.ts        TripsScreenModel, JourneyStatusValue,
                                                  emptyTrips, fixtureTrips
apps/web/lib/presentation/screens/alerts.ts       AlertsScreenModel, AlertFilter,
                                                  emptyAlerts, fixtureAlerts
apps/web/components/screens/trips/TripsScreen.tsx
apps/web/components/screens/alerts/AlertsScreen.tsx
apps/web/app/trips/page.tsx                       live shelf route (was the TASK-006 stub)
apps/web/app/alerts/page.tsx                      live feed route (was the TASK-006 stub)
apps/web/app/showcase/trips/page.tsx              development-only
apps/web/app/showcase/alerts/page.tsx             development-only
apps/web/tests/screens/trips.test.tsx             12 tests
apps/web/tests/screens/alerts.test.tsx            11 tests
docs/tasks/TASK-013-trips-and-alerts.md
```

No file outside the owned paths was modified. `app/trips/page.tsx` is assigned to this task;
`app/trips/[tripId]/**` belongs to TASK-009/010/011 and was not touched.

**Interfaces added/changed:** `TripsScreenModel`, `JourneyStatusValue`, `emptyTrips`,
`fixtureTrips`, `AlertsScreenModel`, `AlertFilter`, `emptyAlerts`, `fixtureAlerts`,
`TripsScreen({ model })`, `AlertsScreen({ model })`. No foundation type, component, token,
dependency or API/schema contract changed. `lib/presentation/screens/alerts.ts` imports the
foundation's `fixtureAlerts` under an alias so the task's export keeps the name the contract
requires.

**Migrations:** None.

**Verification run:** after the final change, on the exact head:

```text
make format-check -> PASS      make test-integration -> PASS (pytest 3)
make lint         -> PASS      make test             -> PASS
make typecheck    -> PASS      make build            -> PASS
make test-unit    -> PASS      make migrate          -> PASS
                               make migrate-check    -> PASS
                               make compose-check    -> PASS
```

Counts: pytest 156 unit + 3 integration; Vitest 14 files / 204 tests (23 new, all passing).

**Live responsive probe** (Next dev, real Chromium) on `/showcase/trips`, `/showcase/alerts`,
`/trips` and `/alerts` at 360 / 430 / 1280 px: no page-level sideways scroll and no overflowing
element at any width; exactly one `h1` per route; no skipped heading level on any route;
rail/bottom-nav swap at 60rem.

**Tests worth noting.** The journey-status and alert-filter tests assert three separate things:
the control renders all four options, it starts on *the model's* value rather than a default
(a non-default model value is rendered and checked), and moving it changes neither list length
nor contents. The alert-row test walks every row and asserts exactly one action whose label and
href come from the model, plus a `<time dateTime>` carrying the machine-readable timestamp. The
route-less trip test asserts its source summary pills are present (matching the lower-cased
labels `TripCard` renders) and that the "See what was checked" affordance appears for it and not
for a trip that already has a route.

**Known limitations / risks:** the "See what was checked" affordance is a labelled link to the
trip's own `href`, which is the same target as `TripCard`'s "Open". `TripCard` is foundation-owned
and renders its own action row, so the screen cannot replace it; the criterion asks for the
affordance, and a link is one of the two forms it allows. As with the other screen tasks the
journey chips and alert filter are held locally: the screen reports the selection and never
filters. Colour contrast remains review-verified.

**Next dependency:** TASK-014 may now be dispatched. TASK-016's declared dependencies (TASK-009,
TASK-012) are merged, so it is now unblocked.

