# TASK-011 — Route detail (Overview · Evidence · Fallback · History)

## Status

`done` — merged to `main` in 3a41582; post-merge Quality green; Handoff recorded below (lifecycle: docs/agent/WORKFLOW.md §7).

## Assigned role

`build`

## Goal

Implement the route detail screen with four tabs — Overview (map, four stats, why/unknown card, complete journey timeline, sticky action), Evidence, Fallback and History — from a typed screen model.

## Why this task exists

PRD §4.2 (ranking reason, unresolved conditions, what to do next), pilot §11.2 route detail/evidence, PRD §10.2 descriptive history. Overview already contains the full timeline, so there is no separate Journey tab.

## Dependencies

- Required merged task/contract: `TASK-006`

## Owned paths

```text
apps/web/app/trips/[tripId]/routes/[routeId]/**
apps/web/app/showcase/route-detail/**
apps/web/components/screens/route-detail/**
apps/web/lib/presentation/screens/route-detail.ts
apps/web/tests/screens/route-detail.test.tsx
docs/tasks/TASK-011-route-detail.md
```

## Read-only context

```text
docs/architecture/UI_FOUNDATION.md
apps/web/components/**
apps/web/lib/presentation/**
PAXPIVOT_PRODUCTION_PRD.md §4.2, §10.2, §16
```

## Interfaces consumed

```text
components/ui: AppHeader, IconButton, Tabs, Card, Rows/Row, StatGrid, StatusPill, Button, StickyActionBar, Disclosure
components/paxpivot: MapSurface, JourneyTimeline, EvidenceAge, EvidenceRows, CommercialBaselineCard, HistoricalStats, SourceStateBadge, RouteHeadlinePill, HandoffLabel
lib/presentation/types: MapView, JourneyLegView, EvidenceAgeView, EvidenceRowView, CommercialBaselineView, HistoricalSummaryView, RouteHeadline, SourceEvidenceView, FactView, Fact
```

## Interfaces produced

```text
lib/presentation/screens/route-detail.ts::RouteDetailScreenModel (status; title; subtitle; headline: RouteHeadline; map: MapView;
  stats: readonly FactView[]; rankingReason; unresolved?: string; legs: readonly JourneyLegView[];
  evidence: { sourceName; evidence: SourceEvidenceView; age: EvidenceAgeView; rows: readonly EvidenceRowView[]; openHref; reportHref };
  fallback: { primary?: CommercialBaselineView; others: readonly { id; title; detail; href }[] };
  history: HistoricalSummaryView; actions: { prepareHref; watchHref?; shareHref? })
lib/presentation/screens/route-detail.ts::fixtureRouteDetail
components/screens/route-detail/RouteDetailScreen.tsx::RouteDetailScreen({ model, initialTab? })
```

## Acceptance criteria

- [x] Tabs are exactly Overview, Evidence, Fallback, History (no Journey tab); `Tabs` keyboard behaviour is inherited.
- [x] Overview: `MapSurface`, `StatGrid` of four stats (unknown reads "Unknown"), a card with the headline pill, ranking reason and an "Unknown:" line when provided, `JourneyTimeline` in supplied order, and a `StickyActionBar` with the prepare action.
- [x] Evidence: source card with `SourceStateBadge`, `EvidenceAge` (source time separate from read time), an "Open source" secondary button, `EvidenceRows` (seat state as published, applies-to-party, reader, revision history), the one-line "record of what a page showed" note, and a "Report this as wrong" row.
- [x] Fallback: `CommercialBaselineCard` with `headline: "fallback"` (handoff label mandatory) plus "Other ways out" rows.
- [x] History: `HistoricalStats` and an "About these numbers" disclosure/link; no chart in this task (the chart contract is deferred).
- [x] Live route renders the empty state; showcase renders the fixture.
- [x] Tests, axe, responsive and accessibility rules.

## Required tests

```text
apps/web/tests/screens/route-detail.test.tsx — tab set; timeline order; evidence ages; fallback label; history wording; unknown not zero; axe
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

- No historical observation chart, no revision diff UI, no report submission, no data fetching.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `build/TASK-011-route-detail` from `main` @ `9e954d1` (TASK-010 merge).

**Commit:** Reported in the PR.

**Files changed** (all owned paths):

```text
apps/web/lib/presentation/screens/route-detail.ts        RouteDetailScreenModel,
                                                         RouteDetailEvidenceView,
                                                         RouteDetailFallbackView,
                                                         emptyRouteDetail, fixtureRouteDetail
apps/web/components/screens/route-detail/RouteDetailScreen.tsx
apps/web/app/trips/[tripId]/routes/[routeId]/page.tsx     live route: empty state only
apps/web/app/showcase/route-detail/page.tsx               development-only fixture route
apps/web/tests/screens/route-detail.test.tsx              18 tests
docs/tasks/TASK-011-route-detail.md
```

No file outside the owned paths was modified. `app/trips/[tripId]/page.tsx` (TASK-009) and
`app/trips/[tripId]/compare/**` (TASK-010) are untouched; this task adds the nested
`routes/[routeId]` segment only.

**Interfaces added/changed:** `RouteDetailScreenModel`, `RouteDetailEvidenceView`,
`RouteDetailFallbackView`, `emptyRouteDetail`, `fixtureRouteDetail`,
`RouteDetailScreen({ model, initialTab? })`. No foundation type, component, token, dependency or
API/schema contract changed.

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

Counts: pytest 156 unit + 3 integration; Vitest 11 files / 159 tests (18 new, all passing).

**Live responsive probe** (Next dev, real Chromium) on `/showcase/route-detail` and
`/trips/a/routes/b` at 360 / 430 / 1280 px:

```text
no page-level sideways scroll and no overflowing element at any width, on every tab
tabs render exactly Overview / Evidence / Fallback / History
sticky prepare action present; rail/bottom-nav swap at 60rem
live route renders no tab panels at all
```

**How the "no Journey tab" criterion is proved.** The test asserts the exact tab list equals
`["Overview","Evidence","Fallback","History"]` and that no tab named "Journey" exists, so adding
one would fail. The Overview panel is separately asserted to contain the complete
`JourneyTimeline` in the supplied order.

**Tab scoping in tests.** `Tabs` mounts every panel and hides the inactive ones, and
Testing Library's text queries do not respect `hidden`. Every panel-specific assertion is
therefore scoped to `getByRole("tabpanel")` (role queries exclude hidden panels), which is why
the Fallback tab's "Fallback" pill is asserted inside the panel rather than against the whole
document — otherwise the tab label itself would satisfy the query and the assertion would pass
even with no fallback card rendered.

**Review findings corrected.** My first draft of this suite had five assertions that were wrong
rather than the code: it asserted focus movement that actually lands on the back control, counted
"Unknown" occurrences across the whole document instead of the visible panel, read a `<dd>` whose
value sits in a nested span, matched the "Fallback" *tab label* when looking for the fallback
*pill*, and expected the word "Fallback" to disappear when only the card was removed. Each was
fixed to assert the real contract; the tab-index assertion now checks roving tabindex plus
fallback-to-first for an unrecognised `initialTab`.

**Known limitations / risks:** the fallback tab renders the model's `CommercialBaselineView`
unchanged rather than overwriting `headline` to `"fallback"`. The fixture supplies
`headline: "fallback"`, so the rendered result matches the criterion, but the screen deliberately
does not rewrite application labelling — a commercial card labelled `safest_overall` in the
fallback slot would render as such. The `StickyActionBar` lives inside the Overview panel as the
criterion specifies, so it is mounted (and suppresses the floating Ask action) even while another
tab is shown; `Tabs` keeps hidden panels mounted. Colour contrast remains review-verified.

**Next dependency:** TASK-012, 013 and 014 may now be dispatched; TASK-016 follows TASK-009 and
TASK-012.

