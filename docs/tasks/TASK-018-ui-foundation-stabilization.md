# TASK-018 — UI foundation stabilization

## Status

`done` — merged to `main` in 6c84a63; post-merge Quality verified in TASK-019's PR; Handoff recorded below.

## Assigned role

`foundation`

## Goal

Resolve the shared UI issues the screen tasks surfaced, at the foundation layer: the Route
Detail sticky-action lifecycle bug, the duplicated screen helpers, the ad-hoc table styling,
the copy-coupled smoke test, the Results desktop composition seam and the one-size handoff
wording.

## Why this task exists

TASK-007, 009, 010, 011, 012, 014 and 016 each recorded a foundation follow-up in their
Handoffs. One of them is a real UX-state bug (a hidden Overview panel kept suppressing the
floating Ask action); the rest are duplicated presentation concepts that would drift as more
screens are built. Production data wiring (TASK-020 onward) must land on a stable foundation.

## Dependencies

- Required merged task: `TASK-016` (all screen tasks merged).
- Required ADR: none new — ADR-003 covers the presentation boundary; this task adds primitives
  within it. `docs/architecture/UI_FOUNDATION.md` is updated.

## Owned paths

Foundation-owned paths plus the screen files named below, which this task is explicitly
authorized to edit (screen tasks may not edit foundation files; the reverse is how these
follow-ups are resolved).

```text
apps/web/components/ui/ScreenSection.tsx                     NEW
apps/web/components/screens/desktop/SplitLayout.tsx          asideFirst
apps/web/components/paxpivot/Handoff.tsx                     kinds
apps/web/components/paxpivot/CommercialBaselineCard.tsx      passes baseline.unknown
apps/web/lib/presentation/types.ts                           SORT_OPTIONS, HandoffUnknownKind
apps/web/lib/presentation/eligibility.ts                     NEW (moved from screens/profile.ts)
apps/web/lib/presentation/screens/profile.ts                 wording removed
apps/web/lib/presentation/screens/terminals.ts               handoffs[].unknown
apps/web/styles/components.css                               .pp-section/.pp-stack, .pp-table*
apps/web/styles/screens.css                                  .pp-split--aside-first
apps/web/components/screens/{plan,results,compare,route-detail,advanced,terminals,profile}/*
apps/web/components/showcase/Showcase.tsx                    SORT_OPTIONS
apps/web/app/showcase/advanced/desktop/page.tsx              renders ResultsScreen
apps/web/tests/smoke.test.tsx, ui.test.tsx, presentation.test.ts
apps/web/tests/screens/{route-detail,compare,advanced,terminals}.test.tsx
docs/architecture/UI_FOUNDATION.md
docs/tasks/TASK-017-task-lifecycle.md                        status → done
docs/tasks/TASK-018-ui-foundation-stabilization.md
```

## Interfaces consumed

```text
apps/web/components/ui/Tabs.tsx::Tabs.onChange
apps/web/components/ui/StickyActionBar.tsx (body[data-sticky-bar] mark, unchanged)
```

## Interfaces produced

```text
components/ui/ScreenSection.tsx::ScreenSection({ title, children })
lib/presentation/types.ts::SORT_OPTIONS
lib/presentation/types.ts::HandoffUnknownKind; CommercialBaselineView.unknown?
lib/presentation/eligibility.ts::ELIGIBILITY_WORDING, eligibilitySummaryText   (moved)
lib/presentation/screens/terminals.ts::TerminalDetailScreenModel.travel.handoffs[].unknown?
components/paxpivot/Handoff.tsx::HandoffLabel({ kind? }), handoffLabelText(kind), HANDOFF_UNKNOWN_TEXT
components/screens/desktop/SplitLayout.tsx::SplitLayout({ list, aside, asideFirst? })
styles: .pp-section, .pp-stack, .pp-table-wrap, .pp-table, .pp-table--wide, .pp-table__title,
        .pp-table [data-emphasis], .pp-split--aside-first
```

## Acceptance criteria

- [x] A. Route Detail mounts `StickyActionBar` only while Overview is the active tab (via
      `Tabs.onChange`); `Tabs` itself is unchanged (hidden panels stay mounted, preserving
      focus, tab state, component-local state and existing screens). Regression test proves:
      Overview active → action present and body marked; Evidence/Fallback/History → not
      marked; back → restored; unmount → cleaned up; the CSS rule hiding the Ask action exists.
- [x] B. `ScreenSection` replaces the local copies in Plan and Results (and the unlabeled
      sections in Route Detail fallback and Advanced). `SORT_OPTIONS` replaces four local
      reconstructions. Eligibility wording lives once in `lib/presentation/eligibility.ts`;
      "Eligible · N travelers" wording preserved; no eligibility decided in the browser.
- [x] C. `.pp-table*` replaces the inline table styles in Compare and Advanced: semantic table,
      caption, column/row headers, rem minimum width, `overflow-x: auto; contain: paint`
      containment, no data-grid dependency. Live probe at 360px: table 512/736px inside a 300px
      box, `document.scrollWidth === clientWidth`.
- [x] D. The smoke test asserts the invariant (shell renders; live Plan has no form/input, no
      journey/route/terminal cards, none of the fixture's strings) and pins no screen copy.
- [x] F. `ResultsScreen` renders one tree through `SplitLayout asideFirst`: phone order is
      map → notices → sort → cards (document order, no `order` below 60rem); from 60rem the map
      moves to the right column by CSS. No viewport detection, no duplicate list. The desktop
      showcase renders the real screen. Live probe: 360px single column, map at the top; 1280px
      two 502px columns, list left, map right; no sideways scroll at either.
- [x] G. `HandoffLabel` takes a `HandoffUnknownKind`; the default and `HANDOFF_LABEL` are
      unchanged; the terminal fixture marks rideshare as `availability` and transit as
      `schedule`; every variant keeps the "Live handoff · … unknown" form; nothing is inferred.
- [x] `make check` green; live responsive probes recorded in the Handoff.

## Required tests

```text
apps/web/tests/screens/route-detail.test.tsx   sticky lifecycle (3 tests)
apps/web/tests/screens/compare.test.tsx        data-emphasis + .pp-table containment
apps/web/tests/screens/advanced.test.tsx       .pp-table containment; Results split showcase
apps/web/tests/screens/terminals.test.tsx      contextual handoff wording per provider row
apps/web/tests/ui.test.tsx                     ScreenSection region; HandoffLabel kinds
apps/web/tests/presentation.test.ts            SORT_OPTIONS; eligibility wording
apps/web/tests/smoke.test.tsx                  foundation invariant
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

## UI behaviour

See `docs/tasks/SCREEN_TASK_RULES.md`; the mobile Results UX is preserved exactly.

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies.

## Out of scope

- Not included: changing `Tabs` to unmount hidden panels; a data-grid; a desktop top bar for
  Plan; wiring any screen to live data; the `directions` action's handoff wording (stays the
  generic default until the terminal model states what that provider leaves unconfirmed).
- Do not refactor: screen models beyond the two optional `unknown` fields.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `foundation/TASK-018-ui-stabilization` from `main` @ `3fda6c0`.

**Commit:** 18b242a (PR #19, merged as 6c84a63).

**Files changed:** the owned paths above.

**Interfaces added/changed:** listed under "Interfaces produced". Removed: nothing public
(`ELIGIBILITY_WORDING`/`eligibilitySummaryText` moved from `screens/profile.ts` to
`lib/presentation/eligibility.ts`).

**Migrations:** none.

**Verification run:** on 18b242a — make format-check/lint/typecheck/test-unit (pytest 156; Vitest 255)/test-integration (3)/test/build/migrate/migrate-check/compose-check/migrate-test all PASS; git diff --exit-code clean; CI Quality PASS on the head and on the merge commit.

**Live responsive probe** (Next dev, in-app Chromium via `localhost`; `127.0.0.1` is blocked
for dev chunks by Next's cross-origin guard, which prevents hydration):

```text
/showcase/results   360px: one column, map first (y 77) then list (y 417); scrollWidth == clientWidth
                    1280px: columns 502px 502px, list x=240, map x=754; rail visible; no sideways scroll
/showcase/route-detail 1280px: Overview → body[data-sticky-bar]=true, .pp-fab display:none, group present
                    Evidence/Fallback/History → mark absent, .pp-fab display:flex, group absent
                    Overview again → restored
/showcase/compare   360px: table 512px inside 300px .pp-table-wrap (overflow-x auto, contain paint); page 360
                    better cell font-weight 700; tie cell colour neutral-700
/showcase/advanced  360px: table 736px inside 300px wrap; page 360; "Needs attention" is a labelled region
/showcase/terminals/detail Travel: "availability and fare unknown" (directions), "availability unknown"
                    (rideshare), "schedule unknown" (transit)
```

**Known limitations / risks:** `.pp-topbar` stays in `screens.css` unused until a desktop Plan
composition needs it. On a desktop the map is DOM-first (right column), so reading order is map
then list — the same order a phone reads. Colour contrast remains review-verified.

**Next dependency:** TASK-019 (AskAnswerView) and TASK-020 (Sources + Terminals architecture).
