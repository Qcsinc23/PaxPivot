# TASK-008 — Source-state notices and honest-absence compositions

## Status

`done` — merged to `main` in 83d915e; post-merge Quality green; Handoff recorded below (lifecycle: docs/agent/WORKFLOW.md §7).

## Assigned role

`build`

## Goal

Provide the shared compact notices every results-style screen needs for the pilot §11.3 view states — refreshing, stale-kept, late check, conflict held, not-ranked, restricted, and the "No supported Space-A route yet" panel — as fixture-driven components with no domain logic.

## Why this task exists

PRD §4.3 and pilot §11.3 require that loading, stale, unreachable, changed-unparsed, conflict, missing, monitor-delayed and no-route states each name the source, the reason and the next action, and never read as "no flights". Results (TASK-009), Trips (TASK-013) and Terminals (TASK-012) all reuse them; building them once prevents drift.

## Dependencies

- Required merged task/contract: `TASK-006`

## Owned paths

```text
apps/web/components/paxpivot/notices/**
apps/web/lib/presentation/notices.ts
apps/web/app/showcase/notices/**
apps/web/tests/notices.test.tsx
docs/tasks/TASK-008-source-state-notices.md
```

## Read-only context

```text
docs/architecture/UI_FOUNDATION.md
apps/web/components/paxpivot/**
apps/web/lib/presentation/**
apps/api/paxpivot/application/source_explanation.py (wording is supplied by the application; do not copy it)
```

## Interfaces consumed

```text
components/ui: Card, Progress, StatusPill, Button, Disclosure, EmptyState, ErrorState, LoadingState
components/paxpivot: SourceStateBadge, SourceStateDisclosure, SourceLedger, CommercialBaselineCard
lib/presentation/types: SourceEvidenceView, SourceLedgerRowView, CommercialBaselineView, Fact
```

## Interfaces produced

```text
lib/presentation/notices.ts::RefreshNoticeView  ({ total: number; done: number; sources: readonly { name; evidence }[] })
lib/presentation/notices.ts::KeptResultNoticeView ({ fromText; evidence; title; facts })
lib/presentation/notices.ts::LateCheckNoticeView ({ sourceName; dueText; lateByText; evidence })
lib/presentation/notices.ts::ConflictNoticeView ({ sourceName; claims: readonly { source; claim; dateText }[]; evidence })
lib/presentation/notices.ts::NotRankedNoticeView ({ count; rows: readonly SourceLedgerRowView[]; href })
lib/presentation/notices.ts::HonestAbsenceView ({ title; summary: readonly { evidence; count }[]; ledger; nextAction: { title; body; action: { label; href } };
  commercial?: CommercialBaselineView; whyHref })
components/paxpivot/notices/RefreshNotice.tsx, KeptResultNotice.tsx, LateCheckNotice.tsx, ConflictNotice.tsx, NotRankedNotice.tsx, HonestAbsencePanel.tsx
lib/presentation/notices.ts::fixtureNotices
```

## Acceptance criteria

- [x] `RefreshNotice` shows "Checking N sources · M done" with `Progress` and per-source pills; `KeptResultNotice` keeps the previous result visible, dimmed, labelled with its read time and a Stale pill and the line "kept on screen while we re-check".
- [x] `LateCheckNotice` shows expected vs actual check and states the last result stays stale; `ConflictNotice` lists both official claims with dates and "held until a person decides"; both expose the application explanation via `SourceStateDisclosure`.
- [x] `NotRankedNotice` shows the count and per-source states and the line that none of them is evidence that nothing is flying.
- [x] `HonestAbsencePanel` renders title, state summary pills, `SourceLedger`, one "best move" card with a single action, an optional commercial option via `CommercialBaselineCard`, and a "Why not just say no flights?" disclosure/link.
- [x] No notice contains the phrases "no flights", "none scheduled" or "nothing flying" as a state (a test asserts this).
- [x] Unknown counts/times render "Unknown".
- [x] Tests, axe, no unrelated files.

## Required tests

```text
apps/web/tests/notices.test.tsx — each notice from fixture; forbidden-phrase scan; unknown not zero; disclosure closed by default; axe
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

- No screen routes; no data fetching; no changes to existing foundation components.

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `build/TASK-008-source-state-notices` from `main` @ `0dee150` (TASK-007 merge).

**Commit:** Reported in the PR.

**Files changed** (all owned paths):

```text
apps/web/lib/presentation/notices.ts                    RefreshNoticeView, KeptResultNoticeView,
                                                        LateCheckNoticeView, ConflictClaimView,
                                                        ConflictNoticeView, NotRankedNoticeView,
                                                        HonestAbsenceView, sourceCountText, fixtureNotices
apps/web/components/paxpivot/notices/RefreshNotice.tsx
apps/web/components/paxpivot/notices/KeptResultNotice.tsx
apps/web/components/paxpivot/notices/LateCheckNotice.tsx
apps/web/components/paxpivot/notices/ConflictNotice.tsx
apps/web/components/paxpivot/notices/NotRankedNotice.tsx
apps/web/components/paxpivot/notices/HonestAbsencePanel.tsx
apps/web/app/showcase/notices/page.tsx                  development-only gallery of all six
apps/web/tests/notices.test.tsx                         15 tests
docs/tasks/TASK-008-source-state-notices.md
```

No file outside the owned paths was modified.

**Interfaces added/changed:** the six view types plus `sourceCountText` and `fixtureNotices` in
`lib/presentation/notices.ts`, and the six notice components. No foundation type, component,
token, dependency or API/schema contract changed. No existing foundation component was edited
("Out of scope: no changes to existing foundation components").

**Migrations:** None.

**Verification run:** after the final change, on the exact head:

```text
make format-check -> PASS
make lint         -> PASS
make typecheck    -> PASS
make test-unit    -> PASS (pytest 156 unit; Vitest 8 files / 97 tests, 15 new)
make test-integration -> PASS (pytest 3)
make test         -> PASS
make build        -> PASS
make migrate      -> PASS
make migrate-check-> PASS
make compose-check-> PASS
```

**Live responsive probe** (Next dev, real Chromium) on `/showcase/notices` at 360 / 375 / 430 /
1280 px: no page-level horizontal scroll, no element overflows the viewport, exactly one `h1`,
and both `SourceStateDisclosure` elements render closed by default.

**How criterion 5 is enforced.** The task requires a literal `"Why not just say no flights?"`
affordance while also forbidding the phrase "no flights" in a notice. The test therefore
separates the two: no `.pp-pill` (the vocabulary that asserts a source state) may contain
"no flights", "none scheduled" or "nothing flying", and outside that question affordance no
notice text may contain them at all. The live probe confirms exactly one visible occurrence of
"no flights" across the whole gallery — the question link — and zero in every state pill. The
`NotRankedNotice` line is phrased "None of these states is evidence that nothing is flying.",
which also avoids the forbidden substrings.

**Known limitations / risks:** the specified notice fields for counts and times are plain
`number`/`string` rather than `Fact`, so the unknown case applies to `KeptResultNotice.facts`
(covered by test) and to `SourceEvidenceView.ageText`, which the foundation omits when no read
time exists. `RefreshNotice` is `role="status"` with `aria-live="polite"`, so a screen reader
announces the running count; it is not a focus target. Colour contrast remains review-verified.

**Next dependency:** TASK-009 consumes all six notices and may now be dispatched.

