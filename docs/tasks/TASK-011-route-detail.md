# TASK-011 — Route detail (Overview · Evidence · Fallback · History)

## Status

`ready` — dispatch after TASK-006 is merged to main. Read `docs/tasks/SCREEN_TASK_RULES.md` first.

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

- [ ] Tabs are exactly Overview, Evidence, Fallback, History (no Journey tab); `Tabs` keyboard behaviour is inherited.
- [ ] Overview: `MapSurface`, `StatGrid` of four stats (unknown reads "Unknown"), a card with the headline pill, ranking reason and an "Unknown:" line when provided, `JourneyTimeline` in supplied order, and a `StickyActionBar` with the prepare action.
- [ ] Evidence: source card with `SourceStateBadge`, `EvidenceAge` (source time separate from read time), an "Open source" secondary button, `EvidenceRows` (seat state as published, applies-to-party, reader, revision history), the one-line "record of what a page showed" note, and a "Report this as wrong" row.
- [ ] Fallback: `CommercialBaselineCard` with `headline: "fallback"` (handoff label mandatory) plus "Other ways out" rows.
- [ ] History: `HistoricalStats` and an "About these numbers" disclosure/link; no chart in this task (the chart contract is deferred).
- [ ] Live route renders the empty state; showcase renders the fixture.
- [ ] Tests, axe, responsive and accessibility rules.

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

(fill in per template)
