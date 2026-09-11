# TASK-004 — Provider conformance fixtures

## Status

`done` — merged to `main` in 17891a1; post-merge Quality green; Handoff recorded below (lifecycle: docs/agent/WORKFLOW.md §7).

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

**Branch:** `build/TASK-004-provider-conformance-fixtures` from merged `main` @ `001de48`
(TASK-003 merge commit; TASK-002 was `e79776d`).

**Commit:** Single focused commit in this PR, titled "TASK-004: add SourceProvider
conformance fixtures". The exact SHA is reported in the PR body, because amending this file
to embed the SHA would itself change the SHA.

**Files changed:**
- `tests/unit/test_source_provider_conformance.py` (new) — 32 tests.
- `tests/fixtures/source_provider/README.md` (new) — fixture conventions.
- `docs/tasks/TASK-004-provider-conformance-fixtures.md` — Handoff only.

**Interfaces added/changed:** None in production. Test-local `SyntheticObservation` inputs
and three deterministic fakes (`FixtureProvider`, `ConfigurationFailureProvider`,
`InvalidAbsenceProvider`) consumed only through `SourceProvider`. `SourceProvider`,
`SourceIdentity`, `SourceObservation`, `Provenance`, `RetrievalState`, `ExtractionState`,
`Result`, `Success`, `Failure` and `ApplicationError` are consumed unchanged.

**Migrations:** None. No dependency, schema, API registration or config change.

**Coverage:** five synthetic fixture inputs (`unreachable`, `missing`, `changed_unparsed`,
`restricted`, and the valid `no_departures_published` state) plus a configuration `Failure`.
Tests prove protocol-typed consumption (an annotated `SourceProvider` assignment that mypy
enforces), source identity and timestamp survival through JSON, `source_time=None` staying
`null`, three-call determinism, that a failed-retrieval `no_departures_published` is rejected
by `SourceObservation` validation rather than accepted, that failure is reported as
`source_unreachable` and never as absence, and that no fixture carries a credential.

**Verification run:** All commands were run after the final code change:

| Command | Result |
| --- | --- |
| `make setup` | PASS (exit 0) |
| `make format-check` | PASS (exit 0) |
| `make lint` | PASS (exit 0) |
| `make typecheck` | PASS (exit 0), mypy strict clean |
| `make test-unit` | PASS (exit 0), 151 passed (32 in this task's file) |
| `make test-integration` | PASS (exit 0), 2 passed |
| `make test` | PASS (exit 0) |
| `make build` | PASS (exit 0) |
| `make migrate` | PASS (exit 0) |
| `make migrate-check` | PASS (exit 0) |
| `make compose-check` | PASS (exit 0) |

**Review notes:** A module-wide autouse `no_network` fixture refuses `socket.getaddrinfo` and
`socket.create_connection` for every test, so the whole suite runs offline. A dedicated test
proves the guard actually refuses, so the offline claim cannot become vacuous. An earlier
draft used a worker thread plus a stack-walking socket guard; that was replaced because it
was roughly forty lines of machinery to prove the same thing, and patching `socket.socket`
globally breaks asyncio's own event-loop self-pipe. Mutation testing confirmed the suite is
load-bearing: neutering the guard, dropping `source_time`, using a non-synthetic host,
hard-coding the returned state, making the configuration provider succeed, and renaming a
fixture were all caught (6 of 6), and sneaking an HTTP client import back into the module
is caught by the static import check.

**Known limitations / risks:** The guard intercepts DNS and TCP connection establishment, the
entry points realistic HTTP clients use; a hand-rolled raw `socket.connect()` would evade it,
which is why the guard is paired with a static check that the module imports no network
client. The owned `tests/fixtures/source_provider/**` path holds convention documentation
rather than loadable fixture modules, because the current pytest configuration puts only
`tests/unit` and site-packages on `sys.path`, so a module under `tests/fixtures/` cannot be
imported from `tests/unit/`; making it importable is a shared-config change for the
foundation agent. This task enables no live provider: no Firecrawl, no AMC access, no HTTP,
no production adapter, and no endpoint.

**Next dependency:** Foundation review and merge of this PR. No TASK-005 exists yet.
