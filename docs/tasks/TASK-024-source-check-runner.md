# TASK-024 — Source check runner over the observation pipeline

## Status

`ready` — dispatch after TASK-020 is merged to `main`.

## Assigned role

`build`

## Goal

A deterministic runner that walks the enabled sources, records one observation per source through
`record_observation` with a supplied `SourceProvider`, and reports what happened per source —
proven against the real database with the conformance fixture providers. No scheduler, no network.

## Why this task exists

ADR-004 defines the provider attach point; this task proves the pipeline end to end (gate →
provider → validation → append → source health) before any real adapter exists, so TASK-025 has a
harness to conform to. PRD §9.3: every attempt yields an observation or a health event.

## Dependencies

- Required merged task: `TASK-020`; consumes TASK-004's conformance fakes as a pattern.

## Owned paths

```text
apps/api/paxpivot/application/source_checks.py
tests/unit/test_source_checks.py
tests/integration/test_source_checks_db.py
docs/tasks/TASK-024-source-check-runner.md
```

## Interfaces consumed

```text
application/source_pipeline.py::record_observation
application/source_gate.py::authorize_processing
application/ports/repositories.py::SourceRepository, SourceObservationRepository, KillSwitchRepository
application/ports/source_provider.py::SourceProvider
paxpivot.tooling.temporary_database (integration tests)
```

## Interfaces produced

```text
application/source_checks.py::
  class SourceCheckOutcome(Contract): source_id: UUID; outcome: Literal["recorded","skipped","rejected","provider_failure"]; message_key: Identifier | None; state: SourceState | None
  class SourceCheckRun(Contract): started_at: AwareDatetime; outcomes: tuple[SourceCheckOutcome, ...]
  async def run_source_checks(sources, observations, kill_switches, provider, *, now=None) -> SourceCheckRun
```

## Acceptance criteria

- [ ] Disabled, paused, restricted, unreviewed-without-retrieve and kill-switched sources are
      `skipped` with the gate's message key; the provider is never called for them.
- [ ] A provider failure observation (unreachable/missing) is `recorded` with its failure state.
- [ ] A provider `Failure` is `provider_failure`; a policy violation is `rejected`; nothing is stored in either case.
- [ ] One run over N sources appends at most N observations; running twice appends again (history), never updates.
- [ ] Integration: temporary DB + seed + a test-only approved source + fixture provider → source
      health shows the new latest state; the append-only trigger is untouched.
- [ ] No network access (arm the `no_network` guard pattern from TASK-004).

## Required tests

```text
tests/unit/test_source_checks.py
tests/integration/test_source_checks_db.py
```

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

`docs/agent/MERGE_POLICY.md` applies.

## Out of scope

- No RQ job, scheduler, cadence enforcement, retries or Firecrawl; no new tables; no parser.

## Blocked / contract change needed

`None`

## Handoff

(fill in per template)
