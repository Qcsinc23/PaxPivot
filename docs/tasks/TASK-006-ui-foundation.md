# TASK-006 — PaxPivot UI foundation and application shell

## Status

`done`

## Assigned role

`foundation`

## Goal

Establish the production web UI architecture — Espresso App tokens, responsive application shell, generic primitives, PaxPivot semantic components, typed presentation contracts, fixtures and tests — so screen tasks can be built by the build agent without interpreting domain data in the browser.

## Why this task exists

Production PRD §4 (primary experience), §14.1 (frontend), Milestone D (production UX) and the approved Espresso App mockups. The mockups are a visual reference, not source; this task translates them into maintainable architecture with progressive disclosure for the TASK-002 explanations, an explicit application → presentation boundary, and accessibility as part of the contract. See ADR-003 and `docs/architecture/UI_FOUNDATION.md`.

## Dependencies

- Required merged task/contract: `TASK-001`, `TASK-005`
- Required ADR: `ADR-003-ui-foundation.md` (created by this task)
- Read-only reference: approved Espresso App mockup kit (design reference outside the repository)

## Owned paths

```text
apps/web/** (excluding nothing; foundation owns the web app in this task)
package.json, pnpm-lock.yaml (web dependency additions only)
docs/decisions/ADR-003-ui-foundation.md
docs/architecture/UI_FOUNDATION.md
docs/architecture/CONTRACTS.md (one pointer line)
docs/tasks/TASK-006-ui-foundation.md
docs/tasks/SCREEN_TASK_RULES.md
docs/tasks/TASK-007 … TASK-016 (downstream contracts created by this task)
docs/tasks/TASK_TEMPLATE.md (UI behaviour / merge-rule sections)
README.md (web section)
```

## Read-only context

```text
AGENTS.md
PAXPIVOT_PRODUCTION_PRD.md
paxpivot.md §10.3, §10.4, §11
docs/architecture/BOUNDARIES.md
apps/api/paxpivot/domain/source.py::SourceState
apps/api/paxpivot/application/source_explanation.py
```

## Interfaces consumed

```text
apps/api/paxpivot/domain/source.py::SourceState (values mirrored verbatim, not imported)
```

## Interfaces produced

```text
apps/web/lib/presentation/fact.ts::Fact<T>, known, unknown, factText
apps/web/lib/presentation/source-state.ts::SOURCE_STATE_CODES, SourceStateCode, StatusTone, SOURCE_STATE_LEXICON, isSourceStateCode
apps/web/lib/presentation/types.ts::SourceEvidenceView, EvidenceAgeView, SourceLedgerRowView, RankingSortMode, SORT_MODE_LABELS,
  FactView, RouteHeadline, RouteCardView, CommercialBaselineView, JourneyLegView, MapMarkerView, MapView, TerminalCardView,
  ReadinessItemView, AlertRowView, TripCardView, EvidenceRowView, HistoricalSummaryView, EligibilitySummaryView
apps/web/lib/presentation/navigation.ts::MOBILE_NAV, RAIL_PRIMARY, RAIL_SECONDARY, ASK_HREF, isActive
apps/web/components/ui/*  apps/web/components/shell/*  apps/web/components/paxpivot/*  (see UI_FOUNDATION.md)
apps/web/styles/{tokens,base,components}.css
```

## Acceptance criteria

- [x] Tokens implement the Espresso App palette (cream/espresso/terracotta/slate/warm neutral), radii, shadows, spacing and self-hosted DM Serif Display + Manrope; no runtime CDN.
- [x] Responsive shell: bottom nav Plan/Trips/Alerts/Terminals/Profile below 60rem; rail Plan/Trips/Terminals/Alerts + Profile/Advanced above; Ask PaxPivot is a floating action; safe-area insets; skip link; landmarks.
- [x] Generic primitives exist only for approved screens: Button/IconButton, Card/Rows, StatusPill, Tabs, SegmentedControl, Sheet (native dialog), Disclosure (native details), Progress, Skeleton, Empty/Loading/Error states, StickyActionBar, AppHeader, Fact/Stat displays.
- [x] Semantic components consume typed view models and make no domain decision.
- [x] Source states: thirteen codes mirrored exactly; compact labels; long explanation only behind disclosure; unrecognised code renders "Unknown state", never a positive state.
- [x] `Fact<T>` renders unknown as "Unknown", never 0; EvidenceAge distinguishes unknown source time from read time.
- [x] Default ranking label "Recommended"; commercial baseline is a distinct product ("Safest overall"/"Fallback" + mandatory handoff label) from "Best Space-A"/"Option n".
- [x] Historical stats render numerator/denominator descriptively with no interpretive wording.
- [x] Map container contract with an always-rendered accessible marker list; no data fetching.
- [x] No production component or route hard-codes mockup example values (static test).
- [x] Accessibility tests: navigation state, icon-button labels, keyboard tabs and segmented control, dialog labelling/close, pill text meaning, state roles, axe on shell/tabs/showcase.
- [x] `/showcase` renders every component from fixtures in development and 404s in production.
- [x] Canonical checks pass; no unrelated files changed.

## Required tests

```text
apps/web/tests/smoke.test.tsx
apps/web/tests/shell.test.tsx
apps/web/tests/ui.test.tsx
apps/web/tests/presentation.test.ts
apps/web/tests/paxpivot.test.tsx
apps/web/tests/showcase.test.tsx
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

- No production screens beyond honest route stubs and the development showcase.
- No API endpoints, view-model adapters, data fetching, auth, MapLibre integration, dark mode, or offline/PWA manifest.
- No Ask PaxPivot result component or historical chart (contracts deferred to their tasks).
- No duplicate of Python domain models in TypeScript beyond the mirrored state codes.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `foundation/TASK-006-ui-foundation` from `main` @ `74abd66` (TASK-005 merge).

**Commit:** Reported in the PR.

**Files changed:** Owned paths above.

**Interfaces added/changed:** Listed under Interfaces produced. Web dependencies added: `lucide-react` 1.44.0, `@fontsource-variable/manrope` 5.3.0, `@fontsource/dm-serif-display` 5.3.0; dev: `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.1, `@testing-library/user-event` 14.6.7, `jsdom` 30.0.1, `axe-core` 4.13.0. `apps/web/app/globals.css` removed in favour of `styles/*`.

**Migrations:** None.

**Verification run:** 2026-09-10, after the final change, in an isolated worktree (own Compose project):

```text
make check -> PASS (format-check, lint, typecheck; pytest 156 unit + 3 integration; Vitest 6 files / 59 tests; build; migrate; migrate-check; compose-check)
pnpm --filter web build -> PASS; / /trips /alerts /terminals /profile /advanced /ask /showcase prerendered static
Live layout probe (Next dev, real Chromium): 375px -> rail display:none, bottom nav grid, nav items 60px,
  icon buttons/tabs/chips 44px, rows and facts stacked, fonts "Manrope Variable"/"DM Serif Display" loaded, no horizontal scroll;
  1280px -> rail 216px flex, bottom nav none, rail order Plan/Trips/Terminals/Alerts/Profile/Advanced, guarantee margin 0
Token contrast (computed): every text/background pair used >= 4.5:1 (lowest 5.03 focus ring on cream)
```

**Known limitations / risks:** Colour contrast is review-verified, not machine-verified (jsdom). The map surface is a placeholder until the MapLibre task. Route stubs say "Not available yet". Fixtures are synthetic and must stay out of production paths.

**Downstream build tasks created:** shared rules in `SCREEN_TASK_RULES.md`; TASK-007 Plan + Trip settings; TASK-008 source-state notices; TASK-009 Results + Why-this-order; TASK-010 Route comparison; TASK-011 Route detail; TASK-012 Terminals; TASK-013 Trips + Alerts; TASK-014 Profile + readiness; TASK-015 Ask PaxPivot presentation (blocked on the `AskAnswerView` contract); TASK-016 desktop compositions + Advanced source health (after 009 and 012). Each owns a distinct route, screen directory, screen-model file and test file.

**Next dependency:** TASK-007, 008, 010, 011, 012, 013 and 014 are independently dispatchable from merged `main`; TASK-009 follows 008; TASK-016 follows 009 and 012. API view-model adapters are a separate foundation task per endpoint.
