# TASK-002 — Source-state explanations

## Status

`ready` — dispatch only after TASK-001 is merged to main.

## Assigned role

`build`

## Goal

Provide one deterministic, metadata-only explanation for every SourceState without inventing availability.

## Why this task exists

Production PRD §9.4 and §4.3; pilot §11.3 require visible failures and honest absence. This helper prepares source-health presentation without adding an endpoint or scraping.

## Dependencies

- TASK-001 merged to main and its scaffold gate passed.
- ADR-001-foundation.md and docs/architecture/CONTRACTS.md.
- No dependency on other first-wave build tasks. Each branches from merged foundation.

## Owned paths

```text
apps/api/paxpivot/application/source_explanation.py
tests/unit/test_source_explanation.py
docs/tasks/TASK-002-source-state-explanations.md
```

## Read-only context

```text
AGENTS.md
PAXPIVOT_PRODUCTION_PRD.md
paxpivot.md
docs/architecture/BOUNDARIES.md
docs/architecture/CONTRACTS.md
apps/api/paxpivot/domain/**
apps/api/paxpivot/application/ports/**
apps/api/paxpivot/application/result.py
Makefile
```

## Interfaces consumed

```text
apps/api/paxpivot/domain/source.py::SourceObservation, SourceState
```

## Interfaces produced

```text
apps/api/paxpivot/application/source_explanation.py::explain_source(observation: SourceObservation) -> str
```

This task may implement the signature above but may not modify consumed shared contracts.

## Acceptance criteria

- [ ] Use an explicit exhaustive SourceState mapping; never infer a different state.
- [ ] Unreachable, stale, missing, changed-unparsed, conflict and delayed states must explicitly preserve uncertainty; never say no flights.
- [ ] For no_departures_published, say only that the source explicitly published no departures; do not generalize to all sources.
- [ ] For no_compatible_opportunity, state only that the evaluated evidence did not support compatibility; do not infer policy/seat reasons.
- [ ] For fresh, describe a fresh source observation and require official verification; do not claim a flight or guaranteed availability.
- [ ] Restricted/review/superseded/withdrawn states suppress current-availability wording. Do not include URL query data, movement details or raw provider text.
- [ ] Tests prove the specified success and failure behavior.
- [ ] Only owned paths changed; no dependency/schema/API registration changes.

## Required tests

Parametrize all 13 states with synthetic observations. Assert failure states never produce positive/absence claims, explicit absence wording stays source-specific, and restricted states request official review.

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

`make test-unit` includes this task's owned test file. Record fresh PASS results after the
final change. Use `make format` to fix formatting before checking. No new runner needed.

## Out of scope

No live sources, scraping, parsing, network provider calls, source approvals, policy rules,
new domain contracts, persistence, migrations, API registration, UI, auth changes, routing,
AI, notifications, historical intelligence or probability claims. No unrelated cleanup.

## Blocked / contract change needed

`None` — the TASK-001 merge is a dispatch dependency. If the fixed contract is insufficient,
record the exact proposed change here and stop; foundation owns the resolution.

## Handoff

**Branch:** Pending execution.

**Commit:** Pending execution.

**Files changed:** Pending execution.

**Interfaces added/changed:** Only the produced interface above is authorized.

**Migrations:** None allowed.

**Verification run:** Pending execution; no PASS claim yet.

**Known limitations / risks:** Synthetic-only helper/test work; does not enable a live source or product release.

**Next dependency:** Foundation reviews/merges the task before integrating any future consumer.
