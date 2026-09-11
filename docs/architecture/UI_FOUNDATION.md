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
    types.ts              view-model contracts consumed by components/paxpivot; SORT_OPTIONS;
                          HandoffUnknownKind (what a provider handoff leaves unconfirmed)
    eligibility.ts        ELIGIBILITY_WORDING + eligibilitySummaryText ("Eligible · 2 travelers")
    navigation.ts         destinations for bottom nav and rail; Ask href
    fixtures.ts           synthetic fixtures for tests and the showcase
  components/
    ui/                   Button/IconButton, Card/Rows/Row, StatusPill, Tabs, SegmentedControl,
                          Sheet, Disclosure, Progress, Skeleton, Empty/Loading/ErrorState,
                          StickyActionBar, AppHeader, FactValue/FactStrip/StatGrid, ScreenSection
    shell/                AppShell, BottomNavigation, DesktopRail, AskPaxPivotAction, NotBuiltYet
    paxpivot/             SourceStateBadge(+Disclosure), EvidenceAge, HandoffLabel, RouteCard,
                          CommercialBaselineCard, JourneyTimeline, MapSurface(+MapMarkerList),
                          TerminalCard, ReadinessItem/List, AlertRow/List, TripCard,
                          EvidenceRows, HistoricalStats, SourceLedger
    screens/desktop/      SplitLayout (list beside aside from 60rem; `asideFirst` keeps the aside
                          first in the document so Results reads map → notices → sort → cards on a
                          phone and list | map on a desktop from one tree)
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

## Shared screen helpers

- `ScreenSection` is the labelled `section` + `h2` every list sits under; `.pp-stack` is the
  same vertical rhythm for a bare `ul`.
- `SORT_OPTIONS` (types.ts) is the only list of sort choices; screens never rebuild it from
  `SORT_MODE_LABELS`, and no ordering is computed in the browser.
- Eligibility wording lives in `lib/presentation/eligibility.ts`; the helper receives an
  already-decided `EligibilitySummaryView` and formats it. Category codes never reach a surface.
- Tables use `.pp-table-wrap > table.pp-table` (`--wide` for operational tables): a semantic
  table with caption, column and row headers, a rem minimum width, and horizontal containment
  (`overflow-x: auto; contain: paint`) so the page never scrolls sideways. Cell emphasis is the
  application's `data-emphasis` value; the stylesheet renders it. No data-grid dependency.
- `HandoffLabel` always reads "Live handoff · … unknown" (GND-003). The application states which
  facts are unconfirmed through `HandoffUnknownKind` (`CommercialBaselineView.unknown`,
  terminal `travel.handoffs[].unknown`); the default stays "availability and fare unknown".
  The label never infers a fact the model did not provide.
- `StickyActionBar` marks `body[data-sticky-bar]` while mounted, which hides the floating Ask
  action. Because `Tabs` keeps hidden panels mounted, a screen that places the bar inside a tab
  panel must mount it only while that tab is active (Route Detail mirrors the selection through
  `Tabs.onChange`); a regression test covers this lifecycle.

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
heading/status/alert roles; axe runs on the shell, tabs and the full showcase. The foundation
smoke test pins invariants, not screen copy: the shell renders, the live Plan route has no form
or input, presents no journey/route/terminal card, and contains none of its fixture's strings. Hit targets are
`--hit` (44px) on touch; `prefers-reduced-motion` disables animation; sizes are in rem;
safe-area insets apply to the shell, nav, sticky bar and sheet. Colour contrast is verified
by review because jsdom cannot compute it.

## Adding to the foundation

New tokens, primitives, semantic components, view-model fields or web dependencies are
foundation-owned. Screen tasks own only their route directory and any screen-local components
inside it, and consume the exports above.
