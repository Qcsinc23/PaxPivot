# TASK-004 — Provider conformance fixtures

## Status

`ready` — dispatch only after TASK-001 is merged to main.

## Assigned role

`build`

## Goal

Create a reusable synthetic conformance test suite for the existing metadata-only SourceProvider protocol.

## Why this task exists

Production PRD §9.5 and §18 require replaceable providers and explicit failure states. A conformance fixture establishes expectations before any source retrieval adapter is enabled.

## Dependencies

- TASK-001 merged to main and its scaffold gate passed.
- ADR-001-foundation.md and docs/architecture/CONTRACTS.md.
- No dependency on other first-wave build tasks. Each branches from merged foundation.

## Owned paths

```text
tests/unit/test_source_provider_conformance.py
tests/fixtures/source_provider/**
docs/tasks/TASK-004-provider-conformance-fixtures.md
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
apps/api/paxpivot/application/ports/source_provider.py::SourceProvider.observe
apps/api/paxpivot/domain/source.py::SourceIdentity, SourceObservation, Provenance, RetrievalState, ExtractionState
apps/api/paxpivot/application/result.py::Result, Success, Failure, ApplicationError
```

## Interfaces produced

```text
Test-local deterministic SourceProvider implementations and synthetic fixtures only; no new production interfaces.
```

This task may implement the signature above but may not modify consumed shared contracts.

## Acceptance criteria

- [ ] Create deterministic fakes returning valid metadata observations for unreachable, missing, changed-unparsed and restricted states, plus configuration Failure.
- [ ] Exercise each fake through an async consumer typed as SourceProvider, not its concrete implementation.
- [ ] Require source identity and observation timestamps to survive JSON serialization; source_time=None must remain unknown.
- [ ] Prove repeated calls with the same configured fixture produce the same deterministic result, without I/O.
- [ ] Prove an invalid fake result cannot bypass SourceObservation validation to represent failed retrieval as no_departures_published.
- [ ] Use only synthetic UUIDs, dates and example.invalid URLs. No downloaded or copied official source artifact.
- [ ] Tests prove the specified success and failure behavior.
- [ ] Only owned paths changed; no dependency/schema/API registration changes.

## Required tests

Parameterized source failure cases, explicit application Failure, identity/time roundtrip, deterministic repeatability, invalid absence rejection and network-free execution.

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
