# TASK-007 — Plan screen and Trip settings

## Status

`review` — implemented on `build/TASK-007-plan-and-trip-settings`; see Handoff.

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

- [x] Plan renders origin, eligibility pill in traveler wording (e.g. `Eligible · 2 travelers`, state from `EligibilitySummaryView`, never computed), the "Where to?" serif moment, destination/window/party summary, the sort `SegmentedControl` defaulting to `Recommended`, the primary action, watched trips via `TripCard`, nearby terminals as chips/rows with `SourceStateBadge`, and a one-line sources-updated status.
- [x] Trip settings open in a `Sheet` (or `/plan/settings` route on desktop): access limits with `Progress`, positioning toggles as rows with On/Off pills carrying text, party rows, and a "Why the sponsor rule applies" link; Reset/Apply in a `StickyActionBar`.
- [x] Empty state ("Nothing planned yet") shows one line, one button and no fake trips; loading and error states per the shared rules.
- [x] Unknown origin/window/access values render "Unknown".
- [x] The live `/` route renders the empty model only.
- [x] Tests, axe, no unrelated files.

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

**Branch:** `build/TASK-007-plan-and-trip-settings` from `main` @ `437a2ed` (TASK-006 merge).

**Commit:** Reported in the PR.

**Files changed** (all owned paths):

```text
apps/web/app/page.tsx                              live / renders the empty model only
apps/web/app/showcase/plan/page.tsx                development-only fixture route
apps/web/components/screens/plan/PlanScreen.tsx    composition + empty/loading/error states
apps/web/components/screens/plan/TripSettingsSheet.tsx
apps/web/lib/presentation/screens/plan.ts          PlanScreenModel, TripSettingsModel, AccessLimitView,
                                                   NearbyTerminalView, emptyPlan, fixturePlan
apps/web/tests/screens/plan.test.tsx               19 tests
docs/tasks/TASK-007-plan-and-trip-settings.md
```

No file outside the owned paths was modified. In particular `apps/web/tests/smoke.test.tsx`
(TASK-006's required test) is byte-identical to its foundation version.

**Ownership note for the foundation agent:** `tests/smoke.test.tsx` asserts the copy
`Journey planning is not available yet` from `app/page.tsx`, which this task owns. Rather than
edit a foundation-owned test to fit new wording, the live empty state keeps that honest
statement as its single explanatory line (`Nothing planned yet` / `Journey planning is not
available yet.` / `Find routes`). This preserves the scaffold's honesty guarantee and keeps the
change inside the owned paths, but it couples a foundation test to this screen's copy. A
follow-up worth considering: have the smoke test assert the shell's guarantee and the absence of
a `form` without pinning a screen's body text.

**Interfaces added/changed:** `lib/presentation/screens/plan.ts` only (`PlanScreenModel`,
`TripSettingsModel`, `AccessLimitView`, `TripSettingsToggleView`, `TripSettingsPartyView`,
`NearbyTerminalView`, `emptyPlan`, `fixturePlan`). No foundation type, component, token,
dependency or API/schema contract changed. `AccessLimitView.progress` is optional so an unset
limit renders no bar instead of a bar at zero.

**Migrations:** None.

**Verification run:** after the final change, on the exact head:

```text
make format-check -> PASS
make lint         -> PASS
make typecheck    -> PASS
make test-unit    -> PASS (pytest 156 unit; Vitest 7 files / 82 tests, 19 new)
make test-integration -> PASS (pytest 3)
make test         -> PASS
make build        -> PASS
make migrate      -> PASS
make migrate-check-> PASS
make compose-check-> PASS
git diff --exit-code (CI clean-diff gate) -> PASS (checks rewrote no tracked file)
```

**Live responsive probe** (Next dev, real Chromium, `127.0.0.1:3111`) at 360 / 375 / 430 /
1280 px, on both `/` and `/showcase/plan`:

```text
document.scrollWidth === clientWidth at every width (no page-level horizontal scroll)
no element overflows the viewport except inside the foundation's own .pp-seg scroller
  (.pp-seg overflow-x:auto, 476 -> 300 inside a 360px page), which never scrolls the page
< 60rem: rail display:none, bottom nav grid; >= 60rem: rail flex, bottom nav none
exactly one h1 per route; Manrope Variable + DM Serif Display loaded
only one route's controls measured under 44px: foundation .pp-chip radios (42px in a
  fine-pointer emulation; ADR-003 sets --hit 44px on touch) and the hidden .pp-skip link
settings sheet fits the viewport at every width (375: top 122 bottom 812 of 812;
  1280: 400..880 of 1280), sticky action bar present, Ask FAB display:none while open
```

**Review findings corrected before verification:** the settings sheet mounted
`StickyActionBar` while closed, which set `body[data-sticky-bar]` and hid the floating Ask
action on the whole Plan screen; the sheet now mounts only while open, with a regression test.
Sections are now labelled regions (`aria-labelledby`). A vacuous accessibility assertion was
replaced with one that proves the unknown's sr-only reason reaches assistive technology.

**Known limitations / risks:** Reset/Apply dismiss the sheet; persistence is out of scope, and
the buttons therefore claim no save. The local sort state only reflects the selection — no
ordering is computed in the browser and `/trips` remains a stub until TASK-013. `SORT_OPTIONS`
and a small `ScreenSection` helper are defined per screen because adding them to the foundation
is a contract change; later screen tasks will repeat them.

**Next dependency:** TASK-008, 010, 011, 012, 013 and 014 are independently dispatchable.

