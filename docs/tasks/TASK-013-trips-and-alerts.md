# TASK-013 — Trips shelf and Alerts feed

## Status

`ready` — dispatch after TASK-006 is merged to main. Read `docs/tasks/SCREEN_TASK_RULES.md` first.

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

- [ ] Trips: `TripCard`s in supplied order; a "Where are you now?" card with a `SegmentedControl` (Not started / Travelling / Arrived / Didn't get on) and the model's note that nothing is inferred from location, schedules or aircraft data; a labelled "New trip" `IconButton`.
- [ ] Trips without a route show their source summary pills and a "See what was checked" disclosure/link, never an empty card.
- [ ] Alerts: filter `SegmentedControl` (All / Routes / Sources / Readiness) that only reflects the model's filter; `AlertList` with time and one action per row; the "Email keeps it vague on purpose" card with a `Disclosure` for the body.
- [ ] Empty states: "No trips yet" with a Plan action; "Nothing to report" for alerts.
- [ ] Live routes render empty states; showcase renders fixtures.
- [ ] Tests, axe, responsive and accessibility rules.

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

(fill in per template)
