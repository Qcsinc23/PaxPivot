# TASK-032 — JB MDL terminal-page parser, critical-field validator and accuracy gate

## Status

`blocked` — retargeted 2026-09-11: the terminal HTML pages carry no departure rows, so the parser input is the 72-hour schedule artifact rendered as text (TASK-037), not the page. Blocked: the 72-hour artifacts are CUI/notice-marked and restricted to user-opened use (TASK-037, product-owner option 1, 2026-09-11). No parser may be built until written permission exists.

## Assigned role

`foundation`

## Goal

First source-specific parser (PRD §9.2): `parse_schedule_artifact(text) -> ParsedSchedule` over the markdown rendering of the JB MDL 72-hour artifact (TASK-037)
(published 72-hour departures: date/time, destination, seat state text, roll call, notes; each
row with the text span it came from), `validate_critical_fields`, and an accuracy report against
the labeled corpus. Add `schedule_observations` (append-only, FK to the source observation,
parser version, row revision) via migration 0004. Automatic rows are stored with state
`parser_review_required` until the corpus report shows ≥ 99 % exact critical fields and zero
false rows (SRC-009); then `fresh`.

## Dependencies

TASK-031, TASK-037 + at least 10 labeled artifact corpus files (`<sha>.md` + `.labels.yaml`)

## Owned paths

```text
apps/api/paxpivot/domain/schedule.py, application/parsers/amc_terminal_page.py, application/parser_gate.py
apps/api/paxpivot/infrastructure/database.py, repositories.py, migrations/versions/0004_schedule_observations.py
apps/api/paxpivot/application/source_pipeline.py (parse step behind PARSE authorization)
tests/unit/test_amc_terminal_page_parser.py, tests/integration/test_schedule_observations_db.py
docs/decisions/ADR-006-schedule-parsing.md, docs/tasks/TASK-032-jb-mdl-terminal-page-parser.md
```

## Acceptance criteria

- [ ] Parser is pure, versioned, and never invents a field; a missing critical field rejects the row.
- [ ] Accuracy report is a command (`parser-report`) and a test; the gate flips automatically from `parser_review_required` to `fresh` only on ≥ 99 % with zero false rows.
- [ ] Rows carry provenance to the source observation and never claim availability beyond the page's own words.
- [ ] Migration tests: append-only trigger, FK, CHECK parity rule added to the probe.
- [ ] Tests prove the behaviour; no unrelated files changed.

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

`docs/agent/MERGE_POLICY.md`; OPSEC review for anything touching source content.

## Out of scope

No opportunities, no routing, no UI beyond what TASK-033 owns.

## Blocked / contract change needed

See Dependencies.

## Handoff

(fill in per template)
