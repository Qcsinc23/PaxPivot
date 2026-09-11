# TASK-012 — Terminals network and terminal detail

## Status

`ready` — dispatch after TASK-006 is merged to main. Read `docs/tasks/SCREEN_TASK_RULES.md` first.

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

- [ ] Network: `MapSurface` hero with the reachable/excluded summary pill, a `SegmentedControl` for reachable vs excluded, the `MapMarkerList`/`TerminalCard` list as the accessible equivalent, and a `Sheet` for the selected terminal (facts, rule text such as "inside the 90-min rule" from the model, `HistoricalStats` counts — never "historically useful").
- [ ] Detail: map hero, name + `SourceStateBadge`, meta line, Directions/Watch/Official actions (Directions is a provider handoff and carries `HandoffLabel`), four stats (entrance verified/unverified text, hours, current opportunities count, parking) with unknowns as "Unknown", tabs Overview · Travel · Evidence · History, and "Compare nearby terminals" row.
- [ ] Withdrawn/superseded opportunities show their state pill ("Superseded"/"Withdrawn"), never as current.
- [ ] "Why included/excluded" is a `Disclosure` with model-supplied text.
- [ ] Live routes render empty states; showcase renders fixtures.
- [ ] Tests, axe, responsive and accessibility rules.

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

(fill in per template)
