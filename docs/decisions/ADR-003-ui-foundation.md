# ADR-003 — Web UI foundation: tokens, shell, primitives and the presentation boundary

## Status

Accepted — foundation-agent decision under TASK-006; 2026-09-10.

## Context

The approved Espresso App mockups define PaxPivot's visual identity and the "map/journey →
recommendation → status → action → explanation on demand" principle. The mockups are CSS
class specimens plus a design-canvas document with runtime CDN dependencies and hard-coded
example content. Screen tasks for the faster build agent need a production UI architecture
that cannot drift into interpreting domain data in the browser, cannot copy example values,
and does not depend on CDN scripts.

## Decision

**Stack.** Plain CSS custom properties and a small `pp-` class vocabulary under
`apps/web/styles/` (`tokens.css`, `base.css`, `components.css`), React server/client
components under `apps/web/components/`, and no CSS-in-JS, Tailwind or component framework.
Icons come from `lucide-react` (application-managed, tree-shaken, `aria-hidden` by default).
Fonts are self-hosted through `@fontsource-variable/manrope` and `@fontsource/dm-serif-display`
imported once in the root layout, so builds and tests need no network for fonts and the
mockup's Google Fonts `@import` is not used. Path alias `@/*` maps to `apps/web/`.

**Shell.** One `AppShell` renders a skip link, a desktop rail (`nav[aria-label=Application]`),
`main#main`, the one-line guarantee footer, a mobile bottom navigation
(`nav[aria-label=Primary]`) and the floating Ask PaxPivot action. Mobile shows Plan, Trips,
Alerts, Terminals, Profile; the rail shows Plan, Trips, Terminals, Alerts with Profile and
Advanced secondary. Ask is never a navigation destination. The breakpoint is `60rem`, chosen
by the rail-plus-content layout, not a device. Safe areas use `env(safe-area-inset-*)` and
the viewport is `viewport-fit=cover`. Hit targets are `--hit: 2.75rem` on touch and 2.5rem
for fine pointers. Reduced motion disables animation globally.

**Presentation boundary.** Components under `components/paxpivot/` accept only the view models
in `apps/web/lib/presentation/types.ts`. Every judgement — freshness, eligibility, ranking,
tier, compatibility, history interpretation — arrives as data from the application/API.
`Fact<T>` is the only representation of a possibly-unknown value and renders as "Unknown",
never zero. Source states are the thirteen `SourceState` codes mirrored verbatim in
`source-state.ts`; the UI maps a code to a compact label/tone/screen-reader phrase and never
derives, upgrades or invents one. Long TASK-002 explanations travel as an opaque string and are
shown only behind `Disclosure`/`Sheet`. Display strings (ages, times, costs) are pre-formatted
by the adapter that builds the view model; ISO timestamps travel alongside for `<time>`.
Maps are a container contract (`MapSurface`, `MapMarkerView`) that never fetches; the marker
list is always rendered as the accessible equivalent, and MapLibre mounts inside the surface
in a later task.

**Product refinements encoded.** The default sort is labelled "Recommended" and still maps to
the PRD default comparator; commercial results use `CommercialBaselineCard` ("Safest overall"
or "Fallback", mandatory handoff label) and are visually distinct from `RouteCard` ("Best
Space-A", "Option n"); history renders "Observed n times in d successful checks" and forbids
interpretive words; traveler-facing wording ("Eligible · 2 travelers") is the surface, with
category detail reserved for Profile/evidence.

**Verification.** Vitest runs in jsdom with Testing Library, `user-event` and `axe-core`;
`tests/setup.ts` mocks `next/navigation` and polyfills modal `<dialog>`. A static test scans
`components/**` and `app/**` for mockup example values.

## Alternatives considered

Copying the mockup CSS/HTML verbatim would import CDN Lucide, Google Fonts, fixed 393px
frames and example content. Tailwind or a UI framework would add a build dependency and a
second styling vocabulary for a design that is already expressed as tokens. CSS Modules per
component would multiply files without adding isolation the `pp-` prefix does not already
give. `next/font/google` fetches at build time and fails offline; Fontsource is deterministic.
A shared `packages/ui` is premature: one consumer exists.

## Consequences

Screen tasks compose existing primitives and semantic components against typed fixtures and
must not add domain logic in `apps/web`. New shared components, tokens, view-model fields or
dependencies are foundation changes. Colour contrast is a review item because jsdom cannot
compute it; the palette uses neutral-700 for secondary text to stay above 4.5:1 on cream.
Dark mode is out of scope. The `/showcase` route is a development gallery that returns 404 in
production builds.

## Contract impact

`apps/web/lib/presentation/{fact,source-state,types,navigation,fixtures}.ts`;
`apps/web/components/{ui,shell,paxpivot}/*`; `apps/web/styles/*`; web devDependencies
(`@testing-library/*`, `jsdom`, `axe-core`) and dependencies (`lucide-react`, Fontsource
packages). No backend or schema change. See `docs/architecture/UI_FOUNDATION.md`.

## Migration / rollout

Root layout now wraps every route in `AppShell`; destination routes exist as honest stubs.
Later API contracts will feed adapters that produce these view models; the shapes are additive.

## Verification

`make check` (Vitest suites for shell, primitives, presentation, semantic components and the
showcase; strict TypeScript; ESLint; production build) and the accessibility assertions listed
in TASK-006.

## Amendments

- **2026-09-10, TASK-018.** Added foundation primitives within the same boundary: `ScreenSection`,
  `SORT_OPTIONS`, `lib/presentation/eligibility.ts`, `.pp-table*`, `SplitLayout.asideFirst`,
  `HandoffUnknownKind`. Route Detail mounts its sticky action only while Overview is active.
- **2026-09-10, TASK-019.** Promoted the comparison row/option types into `types.ts` and added
  the `AskAnswerView` presentation contract plus `lib/presentation/ask.ts`. The Ask screen
  consumes a structured answer only; `unknown` is an explicit verdict kind rendered verbatim,
  grounding is count-by-kind provenance, and no AI provider or free-text call is introduced.
  Documented in `docs/architecture/UI_FOUNDATION.md`; the decision above is unchanged.
