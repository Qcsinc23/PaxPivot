# TASK-009 — Results screen and "Why this order" sheet

## Status

`review` — implemented on `build/TASK-009-results` after TASK-008 merged; see Handoff.

## Assigned role

`build`

## Goal

Implement the ranked-results screen for a trip: map first, sort row, the commercial baseline and Space-A route cards, the not-ranked strip, and the "Why this order" sheet, driven by a typed screen model.

## Why this task exists

PRD §4.2 (primary result: a small set of route cards, ranking reason, fallback always visible) and §7.3 (the UI must expose the first decisive comparison field). The mockup's Results screen is the core traveler surface.

## Dependencies

- Required merged task/contract: `TASK-006`, `TASK-008`

## Owned paths

```text
apps/web/app/trips/[tripId]/page.tsx
apps/web/app/showcase/results/**
apps/web/components/screens/results/**
apps/web/lib/presentation/screens/results.ts
apps/web/tests/screens/results.test.tsx
docs/tasks/TASK-009-results-screen.md
```

## Read-only context

```text
docs/architecture/UI_FOUNDATION.md
apps/web/components/**
apps/web/lib/presentation/**
PAXPIVOT_PRODUCTION_PRD.md §4.2, §7.3, §7.4
paxpivot.md §10.4
```

## Interfaces consumed

```text
components/ui: AppHeader, IconButton, SegmentedControl, Sheet, Card, Rows/Row, StatusPill, Button
components/paxpivot: MapSurface, CommercialBaselineCard, RouteCard, SourceStateBadge
components/paxpivot/notices: RefreshNotice, KeptResultNotice, LateCheckNotice, ConflictNotice, NotRankedNotice, HonestAbsencePanel
lib/presentation/types: MapView, CommercialBaselineView, RouteCardView, RankingSortMode, SORT_MODE_LABELS, Fact
lib/presentation/notices: *
```

## Interfaces produced

```text
lib/presentation/screens/results.ts::ResultsScreenModel (status: "ready" | "refreshing" | "no_route" | "loading" | "error";
  title; subtitle; sort: RankingSortMode; map: MapView; baseline?: CommercialBaselineView; routes: readonly RouteCardView[];
  notRanked?: NotRankedNoticeView; refresh?: RefreshNoticeView; kept?: KeptResultNoticeView; lateChecks: readonly LateCheckNoticeView[];
  conflicts: readonly ConflictNoticeView[]; absence?: HonestAbsenceView; whyOrder: WhyOrderView; compareHref)
lib/presentation/screens/results.ts::WhyOrderView ({ steps: readonly { position; label; outcome: "decided" | "not_needed" | "not_used"; detail }[]; note })
lib/presentation/screens/results.ts::fixtureResults, fixtureResultsNoRoute, fixtureResultsRefreshing
components/screens/results/ResultsScreen.tsx::ResultsScreen({ model })
components/screens/results/WhyOrderSheet.tsx::WhyOrderSheet({ model, open, onClose })
```

## Acceptance criteria

- [x] Header shows origin → destination with window/party subtitle, a back control and a labelled filters `IconButton`.
- [x] `MapSurface` on top, then the sort control (default `Recommended`, changing it only calls the model's sort — no client-side reordering), then `CommercialBaselineCard` ("Safest overall") before the `RouteCard`s in the order supplied; cards are never reordered, filtered or re-labelled by the screen.
- [x] Not-ranked strip, refresh/kept/late/conflict notices and the no-route panel render exactly when the model provides them; `status: "no_route"` shows `HonestAbsencePanel` and never an empty list.
- [x] "Why this order" opens a `Sheet` listing comparator steps with "Decided here" / "Not needed" / "Not used" text and the note that unknown time or cost never counts as zero; the first decisive field is visually and textually distinct.
- [x] `Compare all` links to `/trips/[tripId]/compare`.
- [x] Unknown cost/time/facts render "Unknown"; no `$0`.
- [x] Live `/trips/[tripId]` renders the "not available" empty state.
- [x] Tests, axe, responsive and accessibility rules from SCREEN_TASK_RULES.md.

## Required tests

```text
apps/web/tests/screens/results.test.tsx — order preserved; baseline distinct from Space-A; sheet content; no-route panel; refreshing keeps previous result; unknown not zero; axe
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

- No route search, ranking, sorting or comparator logic in the browser; no API calls; no MapLibre.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `build/TASK-009-results` from `main` @ `83d915e` (TASK-008 merge).

**Commit:** Reported in the PR.

**Files changed** (all owned paths):

```text
apps/web/lib/presentation/screens/results.ts            ResultsScreenModel, WhyOrderView,
                                                        WhyOrderStepView, WhyOrderOutcome,
                                                        fixtureResults, fixtureResultsRefreshing,
                                                        fixtureResultsNoRoute
apps/web/components/screens/results/ResultsScreen.tsx
apps/web/components/screens/results/WhyOrderSheet.tsx
apps/web/app/trips/[tripId]/page.tsx                    live route: NotBuiltYet stub only
apps/web/app/showcase/results/page.tsx                  development-only, ready fixture
apps/web/app/showcase/results/no-route/page.tsx         development-only, no-route fixture
apps/web/app/showcase/results/refreshing/page.tsx       development-only, refreshing fixture
apps/web/tests/screens/results.test.tsx                 23 tests
docs/tasks/TASK-009-results-screen.md
```

No file outside the owned paths was modified.

**Interfaces added/changed:** `ResultsScreenModel`, `WhyOrderView`, `WhyOrderStepView`,
`WhyOrderOutcome`, `fixtureResults`, `fixtureResultsRefreshing`, `fixtureResultsNoRoute`,
`ResultsScreen({ model })`, `WhyOrderSheet({ model, open, onClose })`. Consumes the TASK-008
notices unchanged. No foundation type, component, token, dependency or API/schema contract
changed.

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

Counts: pytest 156 unit + 3 integration; Vitest 9 files / 120 tests (23 new, all passing).

**Live responsive probe** (Next dev, real Chromium) on `/showcase/results`,
`/showcase/results/no-route`, `/showcase/results/refreshing` and `/trips/example` at 360 / 375 /
430 / 1280 px: no page-level horizontal scroll and no overflowing element at any width, exactly
one `h1` per route, rail/bottom-nav swap at 60rem, the map's marker list always present, the
why-order sheet fits the viewport with the decisive pill rendered, and the rendered card order
is unchanged at every width: commercial baseline, then Best Space-A, then Option 2.

**Ordering proof.** The screen never sorts: a test captures the DOM positions of the commercial
title and both route titles before and after the traveler changes the sort control and asserts
they are identical, while the headline pills still read `Best Space-A` / `Option 2` from the
model. A separate assertion proves the commercial baseline precedes the Space-A cards and that
no `RouteCard` carries the `handoff` surface.

**Review findings corrected before verification.** Two of my own test assertions were wrong and
were fixed rather than loosened: the foundation's commercial fixture legitimately renders
`known("None")` for "Space-A legs" (a real zero, not an unknown coerced to "None"), so the
`$0`/`None` guard now scopes to a route whose values are genuinely unknown and asserts all three
read "Unknown"; and the no-route assertion counted `article` elements, which includes the
absence panel's commercial handoff card, so it now asserts that every article present is the
handoff card rather than expecting zero. `MapSurface` was also moved above the notices so the
map is literally the first content element, matching the criterion's "on top" wording.

**Known limitations / risks:** the header's `Filters` `IconButton` is labelled and reachable but
wired to nothing, because no filter contract exists yet — the task requires the control, and the
alternative (a hidden or disabled control) would remove it from the keyboard order. The screen
keeps the traveler's sort choice in local state only; it neither reorders nor persists, which is
the required behaviour until an adapter exists. The `ScreenSection` helper is local to this
screen (the same small helper TASK-007 defines) because promoting it into the foundation is a
shared-contract change these tasks are not authorised to make.

**Next dependency:** TASK-010, 011, 012, 013 and 014 may now be dispatched; TASK-016 follows
TASK-009 and TASK-012.

