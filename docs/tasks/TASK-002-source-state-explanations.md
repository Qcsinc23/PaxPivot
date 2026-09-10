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

**Branch:** `build/TASK-002-source-state-explanations` from `main` @ `e138634`.

**Commit:** Single focused commit in this PR, titled "TASK-002: add deterministic
source-state explanations". The exact SHA is reported in the PR body, because amending this
file to embed the SHA would itself change the SHA. The PR contains exactly one commit on top
of `main` @ `e138634`.

**Files changed:**
- `apps/api/paxpivot/application/source_explanation.py` (new) — produced interface.
- `tests/unit/test_source_explanation.py` (new) — 77 focused unit tests.
- `docs/tasks/TASK-002-source-state-explanations.md` — status/handoff only.

**Interfaces added/changed:** Added
`paxpivot.application.source_explanation.explain_source(observation: SourceObservation) -> str`
only. No consumed shared contract changed; `SourceState`/`SourceObservation` are untouched.

**Migrations:** None. No dependency, schema, API registration or config change.

**Verification run:** All commands were run after the final production code change
(`make format` was used once to fix formatting, then every command below was rerun):

| Command | Result |
| --- | --- |
| `make setup` | PASS (exit 0) |
| `make format-check` | PASS (exit 0) |
| `make lint` | PASS (exit 0) |
| `make typecheck` | PASS (exit 0), mypy strict clean |
| `make test-unit` | PASS (exit 0), 106 passed (77 in this task's file) |
| `make test-integration` | PASS (exit 0), 2 passed |
| `make test` | PASS (exit 0) |
| `make build` | PASS (exit 0) |
| `make migrate` | PASS (exit 0) |
| `make migrate-check` | PASS (exit 0), no new upgrade operations |
| `make compose-check` | PASS (exit 0) |

**Implementation notes:** One `MappingProxyType` mapping from every current `SourceState`
to fixed explanation copy, indexed by `observation.state`. An import-time guard raises if a
future `SourceState` member lacks approved wording, so the mapping cannot silently drift.
Tests assert the exact approved wording for all 13 states, an explicit uncertainty clause per
failure state, source-scoped absence wording, no inferred policy/seat reason, suppressed
current-availability wording for restricted/review/superseded/withdrawn, deterministic and
pure behavior, and that no URL/query/observation/provider identifier is echoed.

**Known limitations / risks:** Presentation copy only. It consumes an observation's state and
nothing else, so it makes no freshness, retrieval or approval judgement of its own — callers
must still supply valid observations. The approved wording is asserted exactly, so any copy
edit must update `tests/unit/test_source_explanation.py` in the same change.

**Next dependency:** Foundation review and merge of this PR. TASK-003 and TASK-004 declare no
dependency on this task, but per the work queue each later task must branch from merged `main`.
