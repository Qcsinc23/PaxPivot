# TASK-016 — Desktop compositions and Advanced source health

## Status

`ready` — dispatch after TASK-009 and TASK-012 are merged to main. Read `docs/tasks/SCREEN_TASK_RULES.md` first.

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

- [ ] `SplitLayout` renders list and map side by side at ≥ 60rem and stacked below, with no horizontal scroll and `minmax(0, 1fr)` tracks; Results uses it in the showcase composition.
- [ ] Source health is a real `<table>` with caption and headers (Source, State, Page time, We read it, Cadence, Reader); every state cell is a `SourceStateBadge`; unknown times read "Unknown"; the meta line says this screen is not needed unless something looks wrong.
- [ ] Notice cards for conflict held, artifact missing and restricted render from the model; no movement rows are ever reproduced for unapproved sources.
- [ ] Advanced is reachable only from the rail's secondary group (never added to mobile nav); on mobile the table scrolls inside its container.
- [ ] Live route renders the empty state; showcase renders the fixture.
- [ ] Tests, axe, responsive and accessibility rules.

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

(fill in per template)
