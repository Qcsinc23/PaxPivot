# TASK-019 — AskAnswerView presentation contract

## Status

`review` — this PR; becomes `done` once merged (see Handoff).

## Assigned role

`foundation`

## Goal

Define the structured answer contract the Ask PaxPivot screen consumes, so TASK-015 can be
dispatched to the build agent without any AI provider, tool call or free-text submission.

## Why this task exists

PRD §11: the AI layer explains deterministic tool results; every factual statement traces to
structured records; unknown stays unknown. TASK-015 was blocked because `AskAnswerView` did
not exist as a foundation contract. The contract must make it impossible for the browser to
compose facts: no free-text answer field, counted grounding rather than citations, a
comparison in the existing row contract, and an explicit `unknown` verdict kind.

## Dependencies

- Required merged task: `TASK-018` (`.pp-table` semantics the comparison reuses).
- ADR: ADR-003 amendment (recorded in the ADR's Amendments section).

## Owned paths

```text
apps/web/lib/presentation/types.ts            Compare{Emphasis,CellView,RowView,OptionView}, Ask*
apps/web/lib/presentation/ask.ts              NEW
apps/web/lib/presentation/fixtures.ts         fixtureAskAnswer, fixtureAskAnswerUnknown
apps/web/lib/presentation/screens/compare.ts  re-exports the promoted types
apps/web/tests/presentation.test.ts
docs/architecture/UI_FOUNDATION.md
docs/decisions/ADR-003-ui-foundation.md       Amendments section only
docs/tasks/TASK-015-ask-paxpivot-presentation.md   status → ready; consumed interfaces
docs/tasks/TASK-019-ask-answer-view.md
```

## Interfaces consumed

```text
apps/web/lib/presentation/fact.ts::Fact
apps/web/lib/presentation/types.ts::SourceEvidenceView, RouteHeadline, Href
```

## Interfaces produced

```text
types.ts::CompareEmphasis, CompareCellView, CompareRowView, CompareOptionView   (moved from screens/compare.ts)
types.ts::AskVerdictKind = "recommendation" | "unknown" | "clarification"
types.ts::AskGroundingKind = "route_search" | "source_record" | "policy" | "history"
types.ts::AskActionVariant, AskActionView, AskGroundingView, AskComparisonView, AskAnswerView
ask.ts::ASK_VERDICT_WORDING, ASK_GROUNDING_NOUNS, askGroundingItemText, askGroundingText
fixtures.ts::fixtureAskAnswer, fixtureAskAnswerUnknown
```

## Acceptance criteria

- [x] `AskAnswerView` has exactly: question, verdict {title, kind}, comparison?, explanation,
      actions, grounding, followUps — no free-text field that could carry a new fact.
- [x] `unknown` is an explicit verdict kind; `ASK_VERDICT_WORDING.unknown.label === "Unknown"`.
- [x] Comparison data is structured and is the same type the Compare screen renders
      (`screens/compare.ts` re-exports it; TASK-010's imports are unchanged).
- [x] Grounding is `{ kind, count }` provenance metadata; `askGroundingText` formats counts and
      states "no structured records" explicitly for an empty list.
- [x] No AI provider dependency, no LLM call, no tool invocation, no eligibility/routing logic
      is added; `package.json` is unchanged.
- [x] TASK-015 is `ready` and names the exact consumed interfaces.
- [x] `make check` green.

## Required tests

```text
apps/web/tests/presentation.test.ts   "AskAnswerView contract" (4 tests)
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

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies.

## Out of scope

- The Ask screen itself (TASK-015, build agent), any `/ask` route change, the composer, and any
  application-side tool contract or answer builder (a later foundation task after the
  read-API slice exists).

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `foundation/TASK-019-ask-answer-view` from `main` @ `6c84a63` (TASK-018 merge).

**Commit:** reported in the PR.

**Files changed:** the owned paths above.

**Interfaces added/changed:** listed under "Interfaces produced". `CompareScreenModel` is
unchanged; its row/option types now live in `types.ts` and are re-exported.

**Migrations:** none.

**Verification run:** recorded in the PR after the final change.

**Known limitations / risks:** the answer builder (application → `AskAnswerView`) does not
exist yet; the live `/ask` route stays an honest empty state. The verdict pill tones (`best`,
`unknown`, `caution`) are presentation choices; the kinds are the contract.

**Next dependency:** TASK-015 (build agent) may be dispatched after this merges.
