# TASK-039 — Floating Ask clearance at the end of long pages

## Status

`done` — merged to `main` in f02c4be (PR #47); final fresh review 0 Critical / 0 Important; status normalized in TASK-040.

## Assigned role

`build`

## Goal

The floating Ask action is fixed over the scroll area. At the end of a long page it must never be
the element left on top of the last row or the standing disclaimer. The content area and the
disclaimer reserve room for the navigation plus the whole control, on the mobile and the desktop
layouts, from one token that owns the control's height.

## Why this task exists

PRD Milestone D (production UX, honest absence/failure UX) and the shared screen rules
(`docs/tasks/SCREEN_TASK_RULES.md`: touch targets, nothing interactive obscured). The reserve
existed but was undersized: `.pp-main` reserved `nav-height + space-8` (96 px) while the control's
top edge sits 120 px above the viewport bottom (76 px offset + 44 px control), and on the desktop
layout the content kept only 36 px of bottom padding and the disclaimer no margin, while the
control's top edge sits 68 px up. The last row and the disclaimer ended up under the control.

Pages with a sticky action bar (`body[data-sticky-bar]`: plan, route detail, compare, readiness)
hide the control by design; their bar is in normal flow, so they keep the navigation-only reserve
and carry no dead space for a control that is not shown.

Rows passing under the control *while scrolling* are normal floating-action behaviour and are not
in scope; only the resting position at the document end is.

## Dependencies

None.

## Owned paths

```text
apps/web/styles/tokens.css
apps/web/styles/components.css
apps/web/components/shell/AskPaxPivotAction.tsx   (body mark while hidden; added after re-review)
apps/web/tests/shell.test.tsx
docs/tasks/TASK-039-floating-ask-clearance.md
```

`AskPaxPivotAction.tsx` was added after the re-review: the Ask screen hides the control by not
rendering it rather than through a sticky action bar, so without a body mark `/ask` would have
reserved the full control height (144 px on mobile, up from 96 px before this task) for a
control that is never there.

## Read-only context

```text
docs/architecture/UI_FOUNDATION.md
docs/tasks/SCREEN_TASK_RULES.md
apps/web/components/shell/
```

## Interfaces consumed

```text
apps/web/styles/tokens.css::--hit, --space-*, --nav-height
```

## Interfaces produced

```text
apps/web/styles/tokens.css::--fab-height = calc(var(--hit) + var(--space-2))
```

## Acceptance criteria

- [x] `--fab-height` is the single owner of the control's height.
- [x] `.pp-main` bottom inset clears `--nav-height` + `--fab-height` + safe area on mobile, and
      `--fab-height` on the desktop layout.
- [x] `.pp-guarantee` bottom margin clears the same on mobile and `--fab-height` on desktop.
- [x] `.pp-fab` stays a ≥ 44 px touch target (`min-height: var(--hit)`).
- [x] The regression test fails without the CSS change and passes with it.
- [x] At the document end nothing interactive sits under the control at 320/390/420/768/1280 px,
      with no horizontal overflow.
- [x] No unrelated files changed.

## Required tests

```text
apps/web/tests/shell.test.tsx::"the page reserves room for the floating Ask action"
```

## Verification commands

```bash
make setup
make format-check
make lint
make typecheck
make test-unit
make build
make check
make migrate-test
```

## UI behaviour (screen tasks only)

See `docs/tasks/SCREEN_TASK_RULES.md`. Verified with a real hit test (`elementFromPoint` sampled
across the control's box at the document end), not bounding-box intersection: rows intersecting
the control mid-scroll are expected and were a false positive in an earlier audit.

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies.

## Out of scope

- Moving, resizing or restyling the Ask control.
- Any change to navigation, screens or copy.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `build/TASK-039-floating-ask-clearance`

**Commit:** reported in the PR.

**Files changed:** the four owned paths above.

**Interfaces added/changed:** `--fab-height` token (new).

**Migrations:** none.

**Verification run (2026-09-14, worktree on `origin/main` 63e0935 + this change):**

```text
make setup                                   -> PASS
make check                                   -> PASS (exit 0)
  format-check / lint / typecheck            -> PASS
  test-unit                                  -> PASS: 257 Python, 339 web (25 files), axe clean
  test-integration                           -> PASS: 40
  build                                      -> PASS
  migrate / migrate-check / compose-check    -> PASS
make migrate-test                            -> PASS (baseline, drift detection, seed, 24 CHECK rules, roundtrip)
regression proof: CSS reverted               -> shell.test.tsx 1 failed | 8 passed
regression proof: CSS restored               -> shell.test.tsx 9 passed
hit test at document end (elementsFromPoint over the whole control, 4 px grid, 231 samples)
  /showcase/terminals 320/390/420/768/1280   -> only DIV.pp-shell__body under the control;
                                                no interactive element; disclaimer bottom
                                                above control top; no horizontal overflow
  /showcase/alerts 390/1280                  -> same
```

`/showcase` itself and the plan, route-detail, compare and readiness screens set
`data-sticky-bar`, which hides the control by design, so they cannot be used for this hit test.

**Review (fresh, 0 Critical / 1 Important → fixed / 1 Minor → fixed):**

- *Important:* the new reserve also applied on sticky-action-bar pages, where the control is hidden
  and the bar is in normal flow — measured before the fix on `/showcase/route-detail` and
  `/showcase/compare`: `.pp-main` 144 px and `.pp-guarantee` 144 px on mobile, 100 px / 76 px on
  desktop, for a control that is not shown. Fixed with `body[data-sticky-bar]` overrides on both
  layouts (navigation-only reserve), pinned by the regression test.
- The pre-existing mobile disclaimer margin (`--nav-height`, 60 px) left the disclaimer's last 5 px
  under the rendered 65 px bar; the sticky-page override adds `--space-2`.
- *Minor:* the "why" numbers in this file were corrected (120 px, 36 px).

**Re-review (fresh, 0 Critical / 1 Important → fixed / 2 Minor → 1 fixed, 1 declined):**

- *Important (fixed):* `/ask` hides the control by not rendering it, not through a sticky action
  bar, so it still reserved the full control height (144 px on mobile, 100 px / 76 px on desktop)
  for a control that is never there. `AskPaxPivotAction` now sets `body[data-no-fab]` while it is
  hidden (removed on unmount or navigation), and the navigation-only overrides apply to both
  marks on both layouts. The shell tests pin the mark on `/ask`, its removal on unmount, its
  absence where the control is shown, and both selectors at both breakpoints.
- *Minor (fixed):* the `--fab-height` comment now calls it the control's footprint (44 px target
  plus an 8 px clearance gap), not its own height.
- *Minor (declined):* desktop reserves do not add `env(safe-area-inset-bottom)`; no desktop rule
  in the stylesheet does, and the desktop layout has no bottom navigation to clear.

After the sticky-bar fix (fc326c2), at the document end:

```text
/showcase/route-detail 390  -> main padding 96 px, disclaimer margin 68 px, disclaimer 3 px above the bar, sticky bar above it, no overflow
/showcase/compare      390  -> disclaimer 3 px above the bar
/showcase/route-detail 1280 -> main padding 36 px, disclaimer margin 0, disclaimer fully visible
/showcase/terminals 390/1280 (control shown) -> unchanged: only pp-shell__body under the control
```

After the `/ask` fix (37dbb1a), at the document end:

```text
/ask 390             -> body[data-no-fab] set, no control, main padding 96 px, disclaimer margin 68 px, disclaimer clears the bar, no overflow
/ask 1280            -> main padding 36 px, disclaimer margin 0
/showcase/terminals  -> control shown (44 px), no mark, 144 px reserve, disclaimer above the control
client navigation    -> /ask → Terminals (same document): mark cleared, control shown, 144 px; Ask control → /ask: mark set, 96 px
shell.test.tsx + ask.test.tsx -> 27 passed (shell 10); prettier and ESLint clean
```

**Final review (fresh, on 37dbb1a):** 0 Critical / 0 Important / 1 Minor (this verification block was
stale; updated here in TASK-040). The reviewer mutation-tested the body mark and both selectors:
removing any one fails `shell.test.tsx`.

**Known limitations / risks:** the regression test reads the stylesheet text, so it pins the reserve
rules; the hit tests and browser measurements are the behavioural proof. The body marks are set in
effects, so the very first paint of `/ask` or a sticky-bar page can briefly carry the larger reserve
(extra space only, never an overlap).

**Next dependency:** none.
