# TASK-003 — Verified entrance selection

## Status

`ready` — dispatch only after TASK-001 is merged to main.

## Assigned role

`build`

## Goal

Return only an already verified entrance from a verified operational Terminal, preserving uncertainty otherwise.

## Why this task exists

Production PRD §12 and pilot TML-002/TML-005 require entrance-specific access. This bounded helper prevents later providers from silently routing to an airfield centroid.

## Dependencies

- TASK-001 merged to main and its scaffold gate passed.
- ADR-001-foundation.md and docs/architecture/CONTRACTS.md.
- No dependency on other first-wave build tasks. Each branches from merged foundation.

## Owned paths

```text
apps/api/paxpivot/application/terminal_entrance.py
tests/unit/test_terminal_entrance.py
docs/tasks/TASK-003-verified-entrance-selection.md
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
apps/api/paxpivot/domain/terminal.py::Terminal, VerifiedEntrance
apps/api/paxpivot/application/result.py::Result, Success, Failure, ApplicationError
```

## Interfaces produced

```text
apps/api/paxpivot/application/terminal_entrance.py::select_entrance(terminal: Terminal) -> Result[VerifiedEntrance]
```

This task may implement the signature above but may not modify consumed shared contracts.

## Acceptance criteria

- [ ] Return Success with the exact unchanged entrance only when operational_state=verified and entrance is present.
- [ ] For operational_state=conflict, return Failure(code=conflict,message_key=terminal.operational_conflict,retryable=False).
- [ ] For ended, return Failure(code=unavailable,message_key=terminal.service_ended,retryable=False).
- [ ] For unknown or a missing entrance, return Failure(code=unavailable,message_key=terminal.entrance_unverified,retryable=False).
- [ ] Never fabricate coordinates, fetch sources, geocode, change provenance or fall back to base_coordinates.
- [ ] Accept verified passenger_terminal, visitor_center and documented_gate kinds without implying provider installation access.
- [ ] Tests prove the specified success and failure behavior.
- [ ] Only owned paths changed; no dependency/schema/API registration changes.

## Required tests

Cover verified entrance success for all three kinds, missing entrance with base coordinates, unknown/conflicting/ended operations even with an entrance, and identity/provenance preservation.

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

**Branch:** `build/TASK-003-verified-entrance-selection` from merged `main` @ `e79776d`
(TASK-002 merge commit; TASK-001 was `e138634`).

**Commit:** Single focused commit in this PR, titled "TASK-003: add verified terminal
entrance selection". The exact SHA is reported in the PR body, because amending this file to
embed the SHA would itself change the SHA.

**Files changed:**
- `apps/api/paxpivot/application/terminal_entrance.py` (new) — produced interface.
- `tests/unit/test_terminal_entrance.py` (new) — 13 focused unit tests.
- `docs/tasks/TASK-003-verified-entrance-selection.md` — Handoff only.

**Interfaces added/changed:** Added
`paxpivot.application.terminal_entrance.select_entrance(terminal: Terminal) -> Result[VerifiedEntrance]`
only. `Terminal`, `VerifiedEntrance`, `Result`, `Success`, `Failure` and `ApplicationError`
are consumed unchanged.

**Migrations:** None. No dependency, schema, API registration or config change.

**Behavior:** `conflict` is checked before `ended`, and both before the entrance test, so a
conflicting or ended terminal fails with its own key even when an entrance is present.
`unknown` and a missing entrance share `terminal.entrance_unverified`. Every failure is
`retryable=False`. Success returns the terminal's existing entrance object itself, so
coordinates, `verification` provenance and `instructions` cannot be copied, rewritten or
re-derived. Airfield/base coordinates are never read: `base_coordinates` does not appear in
the module.

**Verification run:** All commands were run after the final code change (two review findings
were fixed, then every command below was rerun):

| Command | Result |
| --- | --- |
| `make setup` | PASS (exit 0) |
| `make format-check` | PASS (exit 0) |
| `make lint` | PASS (exit 0) |
| `make typecheck` | PASS (exit 0), mypy strict clean |
| `make test-unit` | PASS (exit 0), 119 passed (13 in this task's file) |
| `make test-integration` | PASS (exit 0), 2 passed |
| `make test` | PASS (exit 0) |
| `make build` | PASS (exit 0) |
| `make migrate` | PASS (exit 0) |
| `make migrate-check` | PASS (exit 0) |
| `make compose-check` | PASS (exit 0) |

**Review notes:** An independent truth-table probe covered all 16 combinations of
`{verified, unknown, conflict, ended}` x entrance present/absent x base coordinates
present/absent; every outcome matched the contract, and no failure payload contained any
coordinate. Two findings were fixed during review: two tests were tautological (one exercised
`zoneinfo`/the domain validator against a test-helper value, one asserted a nonexistent JSON
field was absent under `extra="forbid"`) and were removed, and a local `ErrorCode` alias that
re-declared the `ApplicationError.code` literal set was deleted in favour of explicit
inline failure construction.

**Known limitations / risks:** This helper reports registry evidence only. It cannot tell
whether an entrance is still physically correct, reachable, or open; that remains the
separately controlled verification process described in `CONTRACTS.md`. It deliberately
performs no geocoding or provider call, so a terminal with only base coordinates always
fails rather than approximating a location.

**Next dependency:** Foundation review and merge of this PR. TASK-004 declares no dependency
on this task, but per the work queue it must branch from merged `main`.
