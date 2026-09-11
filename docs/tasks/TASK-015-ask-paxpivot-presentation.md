# TASK-015 — Ask PaxPivot presentation

## Status

`blocked` — needs the foundation `AskAnswerView` contract (see below) before dispatch. Read `docs/tasks/SCREEN_TASK_RULES.md` first.

## Assigned role

`build`

## Goal

Implement the Ask PaxPivot screen: the question, a composed answer card (verdict, a small comparison the answer built, one paragraph, action buttons), a provenance line, suggested follow-up chips and a disabled composer — all from a typed answer model with no AI call.

## Why this task exists

PRD §11 (AI explains deterministic tool results; every factual statement traces to structured records; unknown stays unknown). The presentation must make the grounding visible without letting the browser interpret anything.

## Dependencies

- Required merged task/contract: `TASK-006`
- Required foundation contract (not yet merged): `apps/web/lib/presentation/types.ts::AskAnswerView` with at least
  `{ question; verdict: { title; kind: "recommendation" | "unknown" | "clarification" }; comparison?: CompareRowsView;
  explanation: string; actions: readonly { label; href; variant }[]; grounding: readonly { kind: "route_search" | "source_record" | "policy" | "history"; count }[];
  followUps: readonly string[] }` and the rule that `verdict.kind: "unknown"` must render "Unknown" wording verbatim.

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
- [ ] The answer card renders verdict, comparison rows (reusing the compare table semantics), explanation and actions from the model; grounding renders "Based on N route searches · M source records"; unknown verdicts say so.
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

Foundation must add `AskAnswerView` (and reuse of the compare row shape) to `lib/presentation/types.ts` under an ADR-003 amendment or note, then flip this task to `ready`.

## Handoff

(fill in per template)
