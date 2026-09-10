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

**Branch:** Pending execution.

**Commit:** Pending execution.

**Files changed:** Pending execution.

**Interfaces added/changed:** Only the produced interface above is authorized.

**Migrations:** None allowed.

**Verification run:** Pending execution; no PASS claim yet.

**Known limitations / risks:** Synthetic-only helper/test work; does not enable a live source or product release.

**Next dependency:** Foundation reviews/merges the task before integrating any future consumer.
