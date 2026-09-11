# TASK-012 — Terminals network and terminal detail

## Status

`review` — implemented on `build/TASK-012-terminals`; see Handoff.

## Assigned role

`build`

## Goal

Implement the Terminals destination: the network map/list with a selected-terminal sheet, and the terminal detail screen (map hero, status line, four stats, action row, Overview · Travel · Evidence · History tabs).

## Why this task exists

PRD §12.1 (home-terminal network by actual travel time), pilot §11.2 terminal candidates (candidate/excluded, verified entrance, drive/transit result, hours/gate/parking, source-health badge, why included/excluded).

## Dependencies

- Required merged task/contract: `TASK-006`

## Owned paths

```text
apps/web/app/terminals/**
apps/web/app/showcase/terminals/**
apps/web/components/screens/terminals/**
apps/web/lib/presentation/screens/terminals.ts
apps/web/tests/screens/terminals.test.tsx
docs/tasks/TASK-012-terminals.md
```

## Read-only context

```text
docs/architecture/UI_FOUNDATION.md
apps/web/components/**
apps/web/lib/presentation/**
apps/api/paxpivot/domain/terminal.py (shape reference only; never duplicated)
```

## Interfaces consumed

```text
components/ui: AppHeader, IconButton, Tabs, Card, Rows/Row, StatGrid, StatusPill, Button, Sheet, SegmentedControl, Disclosure
components/paxpivot: MapSurface, MapMarkerList, TerminalCard, SourceStateBadge, SourceStateDisclosure, EvidenceAge, EvidenceRows, HistoricalStats, HandoffLabel
lib/presentation/types: MapView, MapMarkerView, TerminalCardView, SourceEvidenceView, EvidenceAgeView, EvidenceRowView, HistoricalSummaryView, FactView, Fact
```

## Interfaces produced

```text
lib/presentation/screens/terminals.ts::TerminalNetworkScreenModel (status; summary: { reachable: Fact<number>; excluded: Fact<number> };
  map: MapView; filter: "reachable" | "excluded"; terminals: readonly TerminalCardView[];
  selected?: { terminal: TerminalCardView; facts: readonly FactView[]; ruleText; history: HistoricalSummaryView })
lib/presentation/screens/terminals.ts::TerminalDetailScreenModel (status; terminal: TerminalCardView; map: MapView; stats: readonly FactView[];
  actions: { directionsHref; watchHref; officialHref }; opportunities: readonly { id; title; detail; evidence: SourceEvidenceView }[];
  travel: { rows: readonly EvidenceRowView[]; handoffs: readonly { id; title; detail; href }[] };
  evidence: { age: EvidenceAgeView; rows: readonly EvidenceRowView[]; whyIncluded: string };
  history: HistoricalSummaryView; compareHref)
lib/presentation/screens/terminals.ts::fixtureTerminalNetwork, fixtureTerminalDetail
components/screens/terminals/TerminalNetworkScreen.tsx, TerminalDetailScreen.tsx
```

## Acceptance criteria

- [x] Network: `MapSurface` hero with the reachable/excluded summary pill, a `SegmentedControl` for reachable vs excluded, the `MapMarkerList`/`TerminalCard` list as the accessible equivalent, and a `Sheet` for the selected terminal (facts, rule text such as "inside the 90-min rule" from the model, `HistoricalStats` counts — never "historically useful").
- [x] Detail: map hero, name + `SourceStateBadge`, meta line, Directions/Watch/Official actions (Directions is a provider handoff and carries `HandoffLabel`), four stats (entrance verified/unverified text, hours, current opportunities count, parking) with unknowns as "Unknown", tabs Overview · Travel · Evidence · History, and "Compare nearby terminals" row.
- [x] Withdrawn/superseded opportunities show their state pill ("Superseded"/"Withdrawn"), never as current.
- [x] "Why included/excluded" is a `Disclosure` with model-supplied text.
- [x] Live routes render empty states; showcase renders fixtures.
- [x] Tests, axe, responsive and accessibility rules.

## Required tests

```text
apps/web/tests/screens/terminals.test.tsx — list equivalent for the map; filter control; sheet labelled; detail tabs; entrance wording; handoff label on directions; unknown not zero; axe
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

- No geocoding, drive-time computation, entrance selection, MapLibre or data fetching.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `build/TASK-012-terminals` from `main` @ `3a41582` (TASK-011 merge).

**Commit:** Reported in the PR.

**Files changed** (all owned paths):

```text
apps/web/lib/presentation/screens/terminals.ts          TerminalNetworkScreenModel,
                                                        TerminalDetailScreenModel, summary/selected/
                                                        opportunity/travel/evidence views,
                                                        emptyTerminalNetwork, emptyTerminalDetail,
                                                        fixtureTerminalNetwork, fixtureTerminalDetail
apps/web/components/screens/terminals/TerminalNetworkScreen.tsx
apps/web/components/screens/terminals/TerminalDetailScreen.tsx
apps/web/app/terminals/page.tsx                          live network route (was the TASK-006 stub)
apps/web/app/terminals/[terminalId]/page.tsx            live detail route
apps/web/app/showcase/terminals/page.tsx                 development-only network
apps/web/app/showcase/terminals/detail/page.tsx          development-only detail
apps/web/tests/screens/terminals.test.tsx                22 tests
docs/tasks/TASK-012-terminals.md
```

No file outside the owned paths was modified. `app/terminals/**` was assigned to this task, so
replacing the TASK-006 `NotBuiltYet` stub there is in scope; the shell's navigation is untouched.

**Interfaces added/changed:** `TerminalNetworkSummaryView`, `TerminalNetworkSelectedView`,
`TerminalOpportunityView`, `TerminalNetworkScreenModel`, `TerminalDetailScreenModel`,
`emptyTerminalNetwork`, `emptyTerminalDetail`, `fixtureTerminalNetwork`, `fixtureTerminalDetail`,
`TerminalNetworkScreen({ model })`, `TerminalDetailScreen({ model, initialTab? })`. No foundation
type, component, token, dependency or API/schema contract changed.

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

Counts: pytest 156 unit + 3 integration; Vitest 12 files / 181 tests (22 new, all passing).

**Live responsive probe** (Next dev, real Chromium) on `/showcase/terminals`,
`/showcase/terminals/detail`, `/terminals` and `/terminals/example` at 360 / 430 / 1280 px: no
page-level sideways scroll and no overflowing element at any width; exactly one `h1` per route;
**heading order never skips a level on any route**; the detail tabs are exactly
Overview / Travel / Evidence / History; the terminal sheet fits the viewport; rail/bottom-nav
swap at 60rem.

**Accessibility bug found by axe and fixed.** The terminal list rendered `TerminalCard`'s `h3`
directly under the page `h1`, skipping a level (`heading-order`). The list is now a labelled
`<section>` with an `h2`, named from `model.filter` ("Reachable terminals" / "Excluded
terminals") rather than from the local chip, because only the application can change which
terminals the list actually holds. The live probe re-checks heading order on every route.

**Review findings corrected.** Two further assertions of mine were wrong rather than the code:
`AppHeader` puts the subtitle inside the `h1`, so the heading text is not just "Terminals"; and
`getByText("Unknown")` matched the hidden Evidence panel's revision-history row as well as the
parking stat, so the unknown-stat assertion now reads that specific stat's value.

**Known limitations / risks:** the model exposes a single optional `selected` terminal and no
selection callback, so the network screen renders one "Selected terminal" strip with a `Details`
control that opens the sheet for that terminal. Per-terminal tap-to-select needs a callback
contract, which is a foundation change this task may not invent; the design avoids showing one
terminal's data under another's name. The `Travel` panel shows the foundation's fixed
`HandoffLabel` text ("availability and fare unknown") next to provider handoffs, which is the
mandated component even though "fare" reads oddly for a rideshare handoff. Contrast remains
review-verified.

**Next dependency:** TASK-013 and TASK-014 may now be dispatched; TASK-016 follows TASK-009 and
TASK-012, so it is now unblocked once TASK-013/014 are done or skipped.

