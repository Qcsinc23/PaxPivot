# TASK-010 — Route comparison

## Status

`review` — implemented on `build/TASK-010-route-comparison`; see Handoff.

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

- [x] Renders a real `<table>` with `<caption>`, column headers for each option and row headers for each field; `emphasis` drives bold ("better") vs dimmed ("tie") but the cell text alone conveys the value; ties are still readable (no colour-only meaning, no opacity below 0.6 for text).
- [x] Evidence cells use `SourceStateBadge`; unknown cells read "Unknown" and are never treated as better or worse by the screen.
- [x] The "trade" card and "decided by" line render from the model only.
- [x] Table scrolls horizontally inside its own container on narrow viewports; the page never scrolls sideways.
- [x] Sticky actions: Watch both (secondary) and Open (primary).
- [x] Live route renders the empty state; showcase renders the fixture.
- [x] Tests, axe, responsive and accessibility rules.

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

**Branch:** `build/TASK-010-route-comparison` from `main` @ `975dea3` (TASK-009 merge).

**Commit:** Reported in the PR.

**Files changed** (all owned paths):

```text
apps/web/lib/presentation/screens/compare.ts          CompareScreenModel, CompareOptionView,
                                                      CompareRowView, CompareCellView,
                                                      CompareEmphasis, emptyCompare, fixtureCompare
apps/web/components/screens/compare/CompareScreen.tsx
apps/web/app/trips/[tripId]/compare/page.tsx          live route: empty state only
apps/web/app/showcase/compare/page.tsx                development-only fixture route
apps/web/tests/screens/compare.test.tsx               16 tests
docs/tasks/TASK-010-route-comparison.md
```

No file outside the owned paths was modified. The live route is a sibling of TASK-009's
`app/trips/[tripId]/page.tsx`, which that task owns; neither file was touched by the other.

**Interfaces added/changed:** `CompareScreenModel`, `CompareOptionView`, `CompareRowView`,
`CompareCellView`, `CompareEmphasis`, `emptyCompare`, `fixtureCompare`,
`CompareScreen({ model })`. No foundation type, component, token, stylesheet, dependency or
API/schema contract changed.

**Styling note:** this task owns no stylesheet, and adding a table class to the foundation's
`components.css` would be a shared-contract change, so the table's presentation is expressed as
token-valued inline styles (`var(--space-2)`, `var(--color-divider)`, `var(--color-neutral-700)`).
No hard-coded colours or sizes were introduced.

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

Counts: pytest 156 unit + 3 integration; Vitest 10 files / 136 tests (16 new, all passing).

**Live responsive probe** (Next dev, real Chromium) on `/showcase/compare` and
`/trips/abc/compare` at 360 / 375 / 430 / 1280 px:

```text
document.scrollWidth === clientWidth and no overflowing element at every width
360px: table 512px inside a 300px container, container scrolls 212px, page does not move
430px: table 512px inside a 370px container, container scrolls 142px
1280px: table fits (988px), no inner scroll
sticky comparison actions present; rail/bottom-nav swap at 60rem; live route renders no table
```

**Important fix found by the live probe.** A first attempt at "the table scrolls inside its own
container" used only `overflow-x: auto` with `min-width: 32rem` on the table. The container did
clip and scroll correctly, but Chromium still folded 35px of the overflowing table into
`documentElement.scrollWidth`, so the page could slide sideways — exactly what the criterion
forbids. Adding `contain: paint` to the scroll container confines the overflow to that box:
the document scroll width returns to the viewport width while the container keeps scrolling.
This is not visible to jsdom, which is why the live probe is the evidence rather than a unit
test.

**Tests.** The unit suite asserts the table semantics (caption, one column header per option
plus the corner header, one row header per field), that the cell text carries the value whatever
the emphasis, that a `better` cell is bold and a `tie` cell is muted by colour with full
opacity, that an unknown cell the model marked `none` receives no emphasis at all (so the screen
decided nothing), that evidence badges appear only on cells that carry evidence, and that the
scroll container sets `overflow-x: auto`. It also covers the empty/loading/error states, the
omitted `Watch both` case, and the live route rendering no synthetic comparison.

**Known limitations / risks:** the table's presentation depends on inline styles because this
task cannot add CSS; a foundation `pp-table` class would be the cleaner long-term home. The
`min-width: 32rem` is a rem-based readability floor, not a device size. Colour contrast of the
muted `tie` colour is inherited from the foundation's neutral-700, which ADR-003 states stays
above 4.5:1 on cream; contrast remains review-verified because jsdom cannot compute it.

**Next dependency:** TASK-011, 012, 013 and 014 may now be dispatched; TASK-016 follows TASK-009
and TASK-012.

