# TASK-015 — Ask PaxPivot presentation

## Status

`review` — implemented on `build/TASK-015-ask-paxpivot` after TASK-019 merged; see Handoff.

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

- [x] Ask is reached from the floating action; the screen has a labelled close `IconButton` and no bottom-nav entry.
- [x] The answer card renders the verdict pill (`ASK_VERDICT_WORDING[kind]`) and title, the comparison rows (`.pp-table`, `data-emphasis` from the model, no emphasis decided in the screen), the explanation and the actions from the model; grounding renders `askGroundingText(...)` ("Based on 1 route search · 2 source records"); an `unknown` verdict shows "Unknown" verbatim (test with `fixtureAskAnswerUnknown`, whose title does not contain the word).
- [x] `lib/presentation/screens/ask.ts` defines `AskScreenModel = { status: "empty" | "ready" | "loading" | "error"; answer?: AskAnswerView; composerPlaceholder: string }` plus `emptyAsk`/`fixtureAsk`; the live `/ask` route renders `emptyAsk` (no synthetic answer).
- [x] Composer is present but disabled with a model-supplied placeholder until the tool contract exists.
- [x] Tests, axe, responsive and accessibility rules.

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

**Branch:** `build/TASK-015-ask-paxpivot` from `main` @ `0601c28` (TASK-019 merge).

**Commit:** Reported in the PR.

**Files changed** (all owned paths):

```text
apps/web/lib/presentation/screens/ask.ts              NEW  AskScreenModel, emptyAsk, fixtureAsk,
                                                           fixtureAskUnknown
apps/web/components/screens/ask/AskScreen.tsx          NEW
apps/web/app/ask/page.tsx                              MOD  replaces the scaffold stub
apps/web/app/showcase/ask/page.tsx                     NEW  development-only
apps/web/app/showcase/ask/unknown/page.tsx             NEW  development-only, unknown verdict
apps/web/tests/screens/ask.test.tsx                    NEW  17 tests
docs/tasks/TASK-015-ask-paxpivot-presentation.md
```

No file outside the owned paths was modified.

**Interfaces added/changed:** `AskScreenModel`, `emptyAsk`, `fixtureAsk`, `fixtureAskUnknown`,
`AskScreen({ model })`. No foundation type, component, token, dependency or API/schema contract
changed — the TASK-019 `AskAnswerView` contract, `ASK_VERDICT_WORDING` and `askGroundingText` are
consumed exactly as merged.

**Migrations:** None.

**Verification run:** after the final change, on the exact head:

```text
make format-check -> PASS      make test-integration -> PASS (pytest 3)
make lint         -> PASS      make test             -> PASS
make typecheck    -> PASS      make build            -> PASS
make test-unit    -> PASS      make migrate          -> PASS
                               make migrate-check    -> PASS
                               make compose-check    -> PASS
```

Counts: pytest 156 unit + 3 integration; Vitest 17 files / 276 tests (17 new, all passing).

**Live responsive probe** (Next dev, real Chromium) on `/ask`, `/showcase/ask` and
`/showcase/ask/unknown` at 360 / 430 / 1280 px: no page-level sideways scroll and no overflowing
element at any width; exactly one `h1`; no skipped heading level; the composer is present and
disabled everywhere; Ask is not a bottom-nav destination; the comparison table scrolls inside its
own box on narrow screens; the live route shows no table.

**How the "unknown renders Unknown verbatim" rule is proved.** `fixtureAskAnswerUnknown.verdict
.title` is asserted NOT to contain the word "Unknown", and the test then asserts the text
"Unknown" is present while "Recommendation" and "Needs clarification" are absent. The pill
therefore cannot be passing by accident of the title.

**How "the screen decides no emphasis" is proved.** The test counts `td[data-emphasis]` cells in
the rendered table and compares that count with the number of model cells whose emphasis is not
`none`, then asserts every emphasised cell carries exactly `better` or `tie`. A screen that
computed emphasis could not satisfy both halves.

**Review findings corrected.** One accessibility defect of mine: the composer card carried
`aria-label="Ask a question"` while the field's visible label had the same text, so the field had
two accessible names and `getByLabelText` matched both. The card is now named "Question composer".

**Known limitations / risks:** the composer, its submit button and the follow-up chips are
present but not wired — asking a question needs the Ask tool contract, which is explicitly out of
scope; the chips are rendered as disabled buttons rather than tappable chips so they do not
imply an action they cannot perform. The composer's styling is token-valued inline CSS because
this task owns no stylesheet and the foundation has no form-control class yet; a shared
`pp-input` primitive would be the cleaner long-term home. Colour contrast remains review-verified
(jsdom cannot compute it), as in TASK-006…TASK-016.

**Next dependency:** none — this closes the last build task that was independent of the
Sources + Terminals foundation.

