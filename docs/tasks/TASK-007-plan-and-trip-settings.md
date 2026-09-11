# TASK-007 — Plan screen and Trip settings

## Status

`ready` — dispatch after TASK-006 is merged to main. Read `docs/tasks/SCREEN_TASK_RULES.md` first.

## Assigned role

`build`

## Goal

Implement the Plan home screen ("Where to?") and the Trip settings sheet as pure compositions of the UI foundation, driven by a typed screen model and fixture, with honest empty state on the live route.

## Why this task exists

PRD §4.1 (trip request) and Milestone D. Plan is the first destination in the shell; it must ask one question, show the last watched trip, nearby terminals and one line of source currency, and keep preferences (access limits, positioning choices, party) one tap down.

## Dependencies

- Required merged task/contract: `TASK-006` (ADR-003)
- Interfaces consumed: see below

## Owned paths

```text
apps/web/app/page.tsx
apps/web/app/plan/**
apps/web/app/showcase/plan/**
apps/web/components/screens/plan/**
apps/web/lib/presentation/screens/plan.ts
apps/web/tests/screens/plan.test.tsx
docs/tasks/TASK-007-plan-and-trip-settings.md
```

## Read-only context

```text
docs/architecture/UI_FOUNDATION.md
apps/web/lib/presentation/**
apps/web/components/**
docs/tasks/SCREEN_TASK_RULES.md
```

## Interfaces consumed

```text
components/ui: AppHeader, Card, Rows/Row, Button, StatusPill, SegmentedControl, Progress, Sheet, StickyActionBar, EmptyState, LoadingState, ErrorState
components/paxpivot: TripCard, SourceStateBadge, SourceLedger
lib/presentation/types: TripCardView, SourceEvidenceView, EligibilitySummaryView, RankingSortMode, SORT_MODE_LABELS, Fact
```

## Interfaces produced

```text
lib/presentation/screens/plan.ts::PlanScreenModel  (status: "empty" | "ready" | "loading" | "error";
  origin: Fact<string>; eligibility?: EligibilitySummaryView; destinationQuery?: string; window?: Fact<string>;
  partyText?: string; sort: RankingSortMode; watching: readonly TripCardView[];
  nearbyTerminals: readonly { id; name; accessText: Fact<string>; evidence: SourceEvidenceView; href }[];
  sourcesUpdated?: SourceEvidenceView; settings: TripSettingsModel)
lib/presentation/screens/plan.ts::TripSettingsModel  (driveLimit/transitLimit as Fact<string> with progress 0–100;
  toggles: readonly { id; title; detail; enabled: boolean }[]; party: readonly { id; name; roleText; href }[]; whyHref)
lib/presentation/screens/plan.ts::fixturePlan
components/screens/plan/PlanScreen.tsx::PlanScreen({ model })
components/screens/plan/TripSettingsSheet.tsx::TripSettingsSheet({ model, open, onClose })
```

No form submission or search is wired; "Find routes" is a link to `/trips` until the search contract exists.

## Acceptance criteria

- [ ] Plan renders origin, eligibility pill in traveler wording (e.g. `Eligible · 2 travelers`, state from `EligibilitySummaryView`, never computed), the "Where to?" serif moment, destination/window/party summary, the sort `SegmentedControl` defaulting to `Recommended`, the primary action, watched trips via `TripCard`, nearby terminals as chips/rows with `SourceStateBadge`, and a one-line sources-updated status.
- [ ] Trip settings open in a `Sheet` (or `/plan/settings` route on desktop): access limits with `Progress`, positioning toggles as rows with On/Off pills carrying text, party rows, and a "Why the sponsor rule applies" link; Reset/Apply in a `StickyActionBar`.
- [ ] Empty state ("Nothing planned yet") shows one line, one button and no fake trips; loading and error states per the shared rules.
- [ ] Unknown origin/window/access values render "Unknown".
- [ ] The live `/` route renders the empty model only.
- [ ] Tests, axe, no unrelated files.

## Required tests

```text
apps/web/tests/screens/plan.test.tsx — fixture render; eligibility wording; sort default; settings sheet opens/labelled; empty/loading/error; unknown not zero; axe
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

- No destination search, geocoding, saved-profile persistence, or API calls.
- No new shared components, tokens or dependencies.

## Blocked / contract change needed

`None`

## Handoff

(fill in per template)
