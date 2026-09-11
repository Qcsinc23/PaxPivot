# TASK-015 — Ask PaxPivot presentation

## Status

`ready` — the foundation `AskAnswerView` contract merged in TASK-019. Read `docs/tasks/SCREEN_TASK_RULES.md` first.

## Assigned role

`build`

## Goal

Implement the Ask PaxPivot screen: the question, a composed answer card (verdict, a small comparison the answer built, one paragraph, action buttons), a provenance line, suggested follow-up chips and a disabled composer — all from a typed answer model with no AI call.

## Why this task exists

PRD §11 (AI explains deterministic tool results; every factual statement traces to structured records; unknown stays unknown). The presentation must make the grounding visible without letting the browser interpret anything.

## Dependencies

- Required merged task/contract: `TASK-006`
- Required merged foundation contract (TASK-019): `apps/web/lib/presentation/types.ts::AskAnswerView`
  with `AskVerdictKind`, `AskGroundingKind`, `AskActionView` (`variant: AskActionVariant`),
  `AskGroundingView`, `AskComparisonView` (`options: CompareOptionView[]`, `rows: CompareRowView[]`);
  helpers in `apps/web/lib/presentation/ask.ts` (`ASK_VERDICT_WORDING`, `ASK_GROUNDING_NOUNS`,
  `askGroundingText`); fixtures `fixtureAskAnswer` and `fixtureAskAnswerUnknown` in
  `apps/web/lib/presentation/fixtures.ts`; table semantics via `.pp-table-wrap > table.pp-table`
  with `data-emphasis` (TASK-018). Rule: `verdict.kind: "unknown"` renders `ASK_VERDICT_WORDING.unknown.label`
  ("Unknown") verbatim, and grounding renders `askGroundingText(model.grounding)`.

## Owned paths

```text
apps/web/app/ask/**
apps/web/app/showcase/ask/**
apps/web/components/screens/ask/**
apps/web/lib/presentation/screens/ask.ts
apps/web/tests/screens/ask.test.tsx
docs/tasks/TASK-015-ask-paxpivot-presentation.md
```

## Acceptance criteria (once unblocked)

- [ ] Ask is reached from the floating action; the screen has a labelled close `IconButton` and no bottom-nav entry.
- [ ] The answer card renders the verdict pill (`ASK_VERDICT_WORDING[kind]`) and title, the comparison rows (`.pp-table`, `data-emphasis` from the model, no emphasis decided in the screen), the explanation and the actions from the model; grounding renders `askGroundingText(...)` ("Based on 1 route search · 2 source records"); an `unknown` verdict shows "Unknown" verbatim (test with `fixtureAskAnswerUnknown`, whose title does not contain the word).
- [ ] `lib/presentation/screens/ask.ts` defines `AskScreenModel = { status: "empty" | "ready" | "loading" | "error"; answer?: AskAnswerView; composerPlaceholder: string }` plus `emptyAsk`/`fixtureAsk`; the live `/ask` route renders `emptyAsk` (no synthetic answer).
- [ ] Composer is present but disabled with a model-supplied placeholder until the tool contract exists.
- [ ] Tests, axe, responsive and accessibility rules.

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

- No AI provider, no tool calls, no free-text submission.

## Blocked / contract change needed

`None` — resolved by TASK-019 (ADR-003 amendment).

## Handoff

(fill in per template)
