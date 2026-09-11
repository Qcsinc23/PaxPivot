# Web UI foundation

Companion to `BOUNDARIES.md` and `CONTRACTS.md` for `apps/web`. Decision record: ADR-003.

## Layout

```text
apps/web/
  app/                    App Router routes; every route renders inside AppShell
    layout.tsx            fonts, stylesheets, AppShell, viewport (viewport-fit=cover)
    page.tsx              Plan (stub)      /trips /alerts /terminals /profile /advanced /ask (stubs)
    showcase/page.tsx     development gallery (404 in production)
  styles/
    tokens.css            Espresso App custom properties — the only place visual values live
    base.css              resets, type utilities, focus, reduced motion, .sr-only, skip link
    components.css        pp-* classes for every primitive and semantic component
  lib/presentation/
    fact.ts               Fact<T>: known | unknown; factText never renders unknown as 0
    source-state.ts       13 SourceState codes mirrored verbatim + compact lexicon
    types.ts              view-model contracts consumed by components/paxpivot
    navigation.ts         destinations for bottom nav and rail; Ask href
    fixtures.ts           synthetic fixtures for tests and the showcase
  components/
    ui/                   Button/IconButton, Card/Rows/Row, StatusPill, Tabs, SegmentedControl,
                          Sheet, Disclosure, Progress, Skeleton, Empty/Loading/ErrorState,
                          StickyActionBar, AppHeader, FactValue/FactStrip/StatGrid
    shell/                AppShell, BottomNavigation, DesktopRail, AskPaxPivotAction, NotBuiltYet
    paxpivot/             SourceStateBadge(+Disclosure), EvidenceAge, HandoffLabel, RouteCard,
                          CommercialBaselineCard, JourneyTimeline, MapSurface(+MapMarkerList),
                          TerminalCard, ReadinessItem/List, AlertRow/List, TripCard,
                          EvidenceRows, HistoricalStats, SourceLedger
    showcase/             Showcase (client) — every component from fixtures
  tests/                  Vitest + Testing Library + axe; setup.ts mocks next/navigation
```

## The presentation boundary

`components/paxpivot/*` render `lib/presentation/types.ts` shapes and nothing else. The
adapter that turns API responses into view models (a later foundation task, per endpoint) is
the only place formatting and mapping happen. Components therefore never:

- decide whether a source is stale, fresh or usable (they render `SourceStateCode`);
- determine eligibility, rank routes, assign tiers or judge compatibility;
- infer that missing data means zero, none or "no flights" (`Fact<T>` renders "Unknown");
- compute ages, durations or costs from raw timestamps/numbers (strings arrive pre-formatted;
  ISO values travel alongside for `<time dateTime>`);
- compute or imply boarding probability, or interpret history beyond counts and denominators;
- fetch data (maps included) or call providers.

If a screen needs a value the view model lacks, that is a foundation contract change: record
it in the task's "Blocked / contract change needed" section rather than deriving it locally.

## Progressive disclosure

Surfaces show two-or-three-word state pills. The deterministic explanation from TASK-002
arrives as `SourceEvidenceView.explanation` and is shown only inside `SourceStateDisclosure`
("Why?"), a `Sheet`, or an evidence screen. Methodology, provenance detail, policy text and
history methodology follow the same rule: pill or one-liner on the surface, detail on demand.

## Navigation and shell

- Mobile (`< 60rem`): bottom navigation Plan · Trips · Alerts · Terminals · Profile; Ask is a
  floating action; the guarantee footer sits above the nav.
- Desktop (`≥ 60rem`): left rail Plan · Trips · Terminals · Alerts, then Profile · Advanced.
  Source health belongs under Advanced.
- Both navigations render; CSS displays exactly one, so assistive technology sees one.
- `AppHeader` owns the page `h1`; cards use `h2`/`h3` via `headingLevel`.

## Accessibility contract

Tested in `apps/web/tests/`: landmarks and skip link; `aria-current` on the active destination;
icon-only controls require a `label`; tabs use roving tabindex with Arrow/Home/End; segmented
controls are native radio groups; `Sheet` is a native modal `<dialog>` with a labelled title
and close control; status pills carry text plus screen-reader detail; `Fact` unknowns read
"Unknown"; the map always has a list equivalent; empty/loading/error states use
heading/status/alert roles; axe runs on the shell, tabs and the full showcase. Hit targets are
`--hit` (44px) on touch; `prefers-reduced-motion` disables animation; sizes are in rem;
safe-area insets apply to the shell, nav, sticky bar and sheet. Colour contrast is verified
by review because jsdom cannot compute it.

## Adding to the foundation

New tokens, primitives, semantic components, view-model fields or web dependencies are
foundation-owned. Screen tasks own only their route directory and any screen-local components
inside it, and consume the exports above.
