# TASK-008 — Source-state notices and honest-absence compositions

## Status

`ready` — dispatch after TASK-006 is merged to main. Read `docs/tasks/SCREEN_TASK_RULES.md` first.

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

- [ ] `RefreshNotice` shows "Checking N sources · M done" with `Progress` and per-source pills; `KeptResultNotice` keeps the previous result visible, dimmed, labelled with its read time and a Stale pill and the line "kept on screen while we re-check".
- [ ] `LateCheckNotice` shows expected vs actual check and states the last result stays stale; `ConflictNotice` lists both official claims with dates and "held until a person decides"; both expose the application explanation via `SourceStateDisclosure`.
- [ ] `NotRankedNotice` shows the count and per-source states and the line that none of them is evidence that nothing is flying.
- [ ] `HonestAbsencePanel` renders title, state summary pills, `SourceLedger`, one "best move" card with a single action, an optional commercial option via `CommercialBaselineCard`, and a "Why not just say no flights?" disclosure/link.
- [ ] No notice contains the phrases "no flights", "none scheduled" or "nothing flying" as a state (a test asserts this).
- [ ] Unknown counts/times render "Unknown".
- [ ] Tests, axe, no unrelated files.

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

(fill in per template)
