# TASK-010 — Route comparison

## Status

`ready` — dispatch after TASK-006 is merged to main. Read `docs/tasks/SCREEN_TASK_RULES.md` first.

## Assigned role

`build`

## Goal

Implement the side-by-side comparison screen: two (or more) option headers, a table of the fields that differ with ties dimmed, the one-line "trade" summary and sticky actions.

## Why this task exists

Pilot §10.4 and PRD §7.3: comparison shows which field decided the order and says time/cost were not used when they were not. The mockup replaces prose with a table.

## Dependencies

- Required merged task/contract: `TASK-006`

## Owned paths

```text
apps/web/app/trips/[tripId]/compare/**
apps/web/app/showcase/compare/**
apps/web/components/screens/compare/**
apps/web/lib/presentation/screens/compare.ts
apps/web/tests/screens/compare.test.tsx
docs/tasks/TASK-010-route-comparison.md
```

## Read-only context

```text
docs/architecture/UI_FOUNDATION.md
apps/web/components/**
apps/web/lib/presentation/**
paxpivot.md §10.4
```

## Interfaces consumed

```text
components/ui: AppHeader, IconButton, Card, StatusPill, Button, StickyActionBar, FactValue
components/paxpivot: SourceStateBadge, RouteHeadlinePill
lib/presentation/types: RouteHeadline, SourceEvidenceView, Fact
```

## Interfaces produced

```text
lib/presentation/screens/compare.ts::CompareScreenModel (status; title;
  options: readonly { id; headline: RouteHeadline | "safest_overall"; title; href }[];
  rows: readonly { id; label; cells: readonly { value: Fact<string>; evidence?: SourceEvidenceView; emphasis: "better" | "tie" | "none" }[] }[];
  trade?: string; decidedBy?: string; actions: { watchAllHref?; openHref })
lib/presentation/screens/compare.ts::fixtureCompare
components/screens/compare/CompareScreen.tsx::CompareScreen({ model })
```

## Acceptance criteria

- [ ] Renders a real `<table>` with `<caption>`, column headers for each option and row headers for each field; `emphasis` drives bold ("better") vs dimmed ("tie") but the cell text alone conveys the value; ties are still readable (no colour-only meaning, no opacity below 0.6 for text).
- [ ] Evidence cells use `SourceStateBadge`; unknown cells read "Unknown" and are never treated as better or worse by the screen.
- [ ] The "trade" card and "decided by" line render from the model only.
- [ ] Table scrolls horizontally inside its own container on narrow viewports; the page never scrolls sideways.
- [ ] Sticky actions: Watch both (secondary) and Open (primary).
- [ ] Live route renders the empty state; showcase renders the fixture.
- [ ] Tests, axe, responsive and accessibility rules.

## Required tests

```text
apps/web/tests/screens/compare.test.tsx — table semantics; emphasis text-independent; unknown handling; sticky actions; axe
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

- No comparator logic, no "better" computation in the browser; no selection UI beyond what the model provides.

## Blocked / contract change needed

`None`

## Handoff

(fill in per template)
