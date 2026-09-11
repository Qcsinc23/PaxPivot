# TASK-009 — Results screen and "Why this order" sheet

## Status

`ready` — dispatch after TASK-008 is merged to main. Read `docs/tasks/SCREEN_TASK_RULES.md` first.

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

- [ ] Header shows origin → destination with window/party subtitle, a back control and a labelled filters `IconButton`.
- [ ] `MapSurface` on top, then the sort control (default `Recommended`, changing it only calls the model's sort — no client-side reordering), then `CommercialBaselineCard` ("Safest overall") before the `RouteCard`s in the order supplied; cards are never reordered, filtered or re-labelled by the screen.
- [ ] Not-ranked strip, refresh/kept/late/conflict notices and the no-route panel render exactly when the model provides them; `status: "no_route"` shows `HonestAbsencePanel` and never an empty list.
- [ ] "Why this order" opens a `Sheet` listing comparator steps with "Decided here" / "Not needed" / "Not used" text and the note that unknown time or cost never counts as zero; the first decisive field is visually and textually distinct.
- [ ] `Compare all` links to `/trips/[tripId]/compare`.
- [ ] Unknown cost/time/facts render "Unknown"; no `$0`.
- [ ] Live `/trips/[tripId]` renders the "not available" empty state.
- [ ] Tests, axe, responsive and accessibility rules from SCREEN_TASK_RULES.md.

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

(fill in per template)
