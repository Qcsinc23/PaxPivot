# TASK-016 — Desktop compositions and Advanced source health

## Status

`review` — implemented on `build/TASK-016-desktop-and-advanced`; see Handoff.

## Assigned role

`build`

## Goal

Add the wide-viewport compositions (results list beside map, top search bar with sort chips and an Ask button) and the Advanced destination with the Source health operations table and its conflict/missing/restricted notice cards.

## Why this task exists

The mockup's desktop shell keeps one working surface with list-beside-map; PRD §19 requires an internal operations view for source checks, freshness, parser status and kill-switch state, which belongs under Advanced so travelers never need it.

## Dependencies

- Required merged task/contract: `TASK-006`, `TASK-009`, `TASK-012`

## Owned paths

```text
apps/web/app/advanced/**
apps/web/app/showcase/advanced/**
apps/web/components/screens/advanced/**
apps/web/components/screens/desktop/**
apps/web/lib/presentation/screens/advanced.ts
apps/web/styles/screens.css  (new file: wide-layout classes only, imported from app/layout.tsx via one added import line)
apps/web/tests/screens/advanced.test.tsx
docs/tasks/TASK-016-desktop-compositions-and-advanced.md
```

The single `import "@/styles/screens.css";` line in `apps/web/app/layout.tsx` is the only permitted edit outside owned paths.

## Read-only context

```text
docs/architecture/UI_FOUNDATION.md
apps/web/styles/**
apps/web/components/**
PAXPIVOT_PRODUCTION_PRD.md §19
```

## Interfaces consumed

```text
components/ui: AppHeader, Card, StatusPill, Button, SegmentedControl, Disclosure
components/paxpivot: SourceStateBadge, SourceStateDisclosure, MapSurface
components/screens/results: ResultsScreen (composition reuse)
lib/presentation/types: SourceEvidenceView, Fact
```

## Interfaces produced

```text
lib/presentation/screens/advanced.ts::SourceHealthScreenModel (status; summary: readonly { evidence; count }[];
  rows: readonly { id; name; evidence: SourceEvidenceView; pageTime: Fact<string>; readAt: Fact<string>; cadence: Fact<string>;
  reader: Fact<string>; approval: "approved" | "review" | "paused" | "unknown"; openHref }[];
  notices: readonly { id; kind: "conflict" | "missing" | "restricted"; title; body }[])
lib/presentation/screens/advanced.ts::fixtureSourceHealth
components/screens/advanced/SourceHealthScreen.tsx
components/screens/desktop/SplitLayout.tsx ({ list, aside }) — list beside aside at ≥ 60rem, stacked below
styles/screens.css::.pp-split, .pp-topbar
```

## Acceptance criteria

- [x] `SplitLayout` renders list and map side by side at ≥ 60rem and stacked below, with no horizontal scroll and `minmax(0, 1fr)` tracks; Results uses it in the showcase composition.
- [x] Source health is a real `<table>` with caption and headers (Source, State, Page time, We read it, Cadence, Reader); every state cell is a `SourceStateBadge`; unknown times read "Unknown"; the meta line says this screen is not needed unless something looks wrong.
- [x] Notice cards for conflict held, artifact missing and restricted render from the model; no movement rows are ever reproduced for unapproved sources.
- [x] Advanced is reachable only from the rail's secondary group (never added to mobile nav); on mobile the table scrolls inside its container.
- [x] Live route renders the empty state; showcase renders the fixture.
- [x] Tests, axe, responsive and accessibility rules.

## Required tests

```text
apps/web/tests/screens/advanced.test.tsx — table semantics; badges per row; unknown handling; split layout classes; axe
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

- No source registry, monitoring, kill switches or data fetching; no changes to foundation tokens/components.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `build/TASK-016-desktop-and-advanced` from `main` @ `650fce8` (TASK-014 merge).

**Commit:** Reported in the PR.

**Files changed** (all owned paths):

```text
apps/web/styles/screens.css                             NEW  .pp-split, .pp-topbar (layout only)
apps/web/app/layout.tsx                                 MOD  the single permitted import line
apps/web/components/screens/desktop/SplitLayout.tsx     NEW
apps/web/components/screens/advanced/SourceHealthScreen.tsx NEW
apps/web/lib/presentation/screens/advanced.ts           NEW  SourceHealthScreenModel,
                                                             SourceHealthRowView,
                                                             SourceHealthNoticeView,
                                                             SourceApproval, emptySourceHealth,
                                                             fixtureSourceHealth
apps/web/app/advanced/page.tsx                          MOD  live route (was the TASK-006 stub)
apps/web/app/showcase/advanced/page.tsx                 NEW  source health fixture
apps/web/app/showcase/advanced/desktop/page.tsx         NEW  desktop composition
apps/web/tests/screens/advanced.test.tsx                NEW  17 tests
docs/tasks/TASK-016-desktop-compositions-and-advanced.md
```

The only change outside the owned paths is the single `import "@/styles/screens.css";` line in
`apps/web/app/layout.tsx`, which the task explicitly permits.

**Interfaces added/changed:** `SplitLayout({ list, aside })`, `SourceHealthScreen({ model })`,
`SourceHealthScreenModel`, `SourceHealthRowView`, `SourceHealthNoticeView`, `SourceApproval`,
`emptySourceHealth`, `fixtureSourceHealth`. No foundation type, component, token, dependency or
API/schema contract changed; `styles/screens.css` adds layout classes only and introduces no
visual values.

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

Counts: pytest 156 unit + 3 integration; Vitest 16 files / 245 tests (17 new, all passing).

**Live responsive probe** (Next dev, real Chromium) at 360 / 430 / 960 / 1280 px, on
`/showcase/advanced`, `/showcase/advanced/desktop` and `/advanced`:

```text
page never scrolls sideways at any width; one h1; no skipped heading level
desktop composition at 960px: two equal columns (342px 342px), list and map side by side
desktop composition at 1280px: two equal columns (502px 502px), side by side
desktop composition below 60rem: a single column, list stacked above the map
top bar is a flex row and nowrap from 60rem up
source-health table is always contained: it either fits or scrolls inside its own box
Advanced is absent from the mobile bottom navigation and present in the rail
rail/bottom-nav swap at 60rem
```

**`minmax(0, 1fr)` is asserted two ways.** The unit suite reads `styles/screens.css` and asserts
the authored `minmax(0, 1fr)` tracks, the 60rem breakpoint, both class names, and that the sheet
contains no `px` value at all (no device-specific widths). The live probe separately asserts the
resolved behaviour: exactly two equal tracks from 60rem up and one below.

**Review findings corrected.** A real accessibility bug: the desktop composition rendered
`RouteCard`'s `h3` directly under the page `h1`, skipping a level. The route list now has its own
`h2` section. Two of my assertions were also wrong and were fixed: a table cell's `textContent`
includes `FactValue`'s sr-only reason, so the unknown-time assertion reads the cell's own text,
and the approval-pill assertion expected a single "Approved" when two sources legitimately carry
it.

**Known limitations / risks:** `ResultsScreen` renders its own map, so it cannot be split without
a layout seam, and TASK-009's component is not owned by this task. The desktop showcase
therefore demonstrates `SplitLayout` over the Results *fixture* — its route list beside its map —
rather than nesting the whole Results screen. **Foundation follow-up requested:** give
`ResultsScreen` an optional layout slot (or split its map out) so production Results can use
`SplitLayout` directly; until then the wide composition exists only in the showcase. The
source-health table repeats the token-valued inline table styling TASK-010 introduced, because
`screens.css` is limited to the wide-layout classes; a foundation `pp-table` class would let both
tasks drop their inline styles. Advanced's live route renders the empty state (no operations API
exists), so `/advanced` currently shows no table.

**Next dependency:** none. TASK-015 remains blocked on the foundation `AskAnswerView` contract.

