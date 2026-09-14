# TASK-041 — Derived source staleness at read time

## Status

`review` — PR open; see Handoff.

## Assigned role

`foundation`

## Goal

A successful observation older than the pilot's freshness window is never presented as current.
Every read that shows source evidence — the terminal network headline, terminal detail (summary
and per-source rows) and source health (rows and counts) — reports the **effective** state at the
read's `generated_at`: `fresh`, `no_departures_published` or `no_compatible_opportunity` older
than 6 h 30 min reads as `source_stale`, with the stale explanation. Stored observations are
never changed.

## Why this task exists

Pilot baseline SRC-008 (`paxpivot.md`): a current view requires a successful check within
6.5 hours. PRD §23 item 9: stale observations cannot remain active. Before this task the provider
wrote `fresh` at retrieval (`infrastructure/providers/firecrawl.py`), the read services passed the
stored state straight through, and the web deliberately derives nothing
(`apps/web/lib/presentation/source-state.ts`). If the 6-hourly check stopped — host, cron,
provider or credits — the app kept showing "Fresh" indefinitely, which is the validation review's
top risk (silent staleness).

## Dependencies

None (TASK-024 read services and TASK-025 provider are merged).

## Owned paths

```text
apps/api/paxpivot/application/read_services.py
tests/unit/test_read_services.py
tests/integration/test_sources_terminals_db.py
tests/integration/test_source_checks_db.py
docs/tasks/TASK-041-derived-source-staleness.md
```

## Read-only context

```text
paxpivot.md (SRC-007, SRC-008)
apps/api/paxpivot/domain/source.py::SourceState, SourceObservation
apps/api/paxpivot/application/source_explanation.py
apps/web/lib/presentation/source-state.ts
```

## Interfaces consumed

```text
apps/api/paxpivot/application/ports/repositories.py::ObservationReader.latest_per_source
apps/api/paxpivot/application/source_explanation.py::explain_source
```

## Interfaces produced

```text
apps/api/paxpivot/application/read_services.py::FRESHNESS_WINDOW = timedelta(hours=6, minutes=30)
apps/api/paxpivot/application/read_services.py::effective(observation, now) -> SourceObservation
evidence_read / terminal_summary / health_row now take `now` (module-internal helpers)
SourceEvidenceRead.state semantics: the effective state at generated_at (shape unchanged)
```

No API shape, schema, migration, provider or web change. The web already renders `source_stale`
("Stale", caution, "no recent successful read; nothing here is current").

## Acceptance criteria

- [x] `fresh` at 6 h 29 m and at exactly 6 h 30 m reads `fresh`; at 6 h 31 m reads `source_stale`.
- [x] `no_departures_published` past the window reads `source_stale`.
- [x] Failure states (`source_unreachable` at 10 h) keep their own state.
- [x] An observation stamped after `now` (clock skew) is unchanged.
- [x] Network headline, terminal detail summary, terminal detail source row and source health
      row and counts all carry the same effective state, and share `generated_at == now`.
- [x] Stale evidence carries the stale explanation.
- [x] The stored observation is unchanged after every read.
- [x] Integration tests that read fixture observations recorded at fixed dates read at the fixture
      clock instead of the wall clock.
- [x] No unrelated files changed.

## Required tests

```text
tests/unit/test_read_services.py::test_every_read_reports_the_effective_state_at_generated_at (6 cases)
tests/integration/test_sources_terminals_db.py::test_observations_are_append_only_and_keep_unknowns
tests/integration/test_source_checks_db.py (health_now reads at EPOCH)
```

## Verification commands

```bash
make setup
make check
make migrate-test
```

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies.

## Out of scope

- Producing `monitor_delayed` (with a 6 h cadence and a 6.5 h window its span would be 30 min).
- A "freshness unknown" state for sources without a cadence (open question; the window applies
  to all sources, which is the stricter reading).
- External alerting when checks stop (heartbeat, separate task).
- Documenting the rule in `docs/architecture/CONTRACTS.md` (done by the documentation-truth task,
  which rewrites that file).

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `foundation/TASK-041-derived-staleness`

**Commit:** reported in the PR.

**Files changed:** the owned paths above.

**Interfaces added/changed:** see "Interfaces produced".

**Migrations:** none.

**Verification run (2026-09-14, worktree on `origin/main` 63e0935 + this change):**

```text
red run (tests first)                 -> 2 failed (fresh at 6h31m, no_departures at 7h) | 10 passed
make format                           -> PASS (reformatted the new test only)
make check                            -> PASS (exit 0)
  format-check / lint / typecheck     -> PASS
  test-unit                           -> PASS: 263 Python (+6), 338 web
  test-integration                    -> PASS: 40 (fixture reads now use the fixture clock)
  build / migrate / migrate-check     -> PASS
make migrate-test                     -> PASS (baseline, drift detection, seed, 24 CHECK rules, roundtrip)
```

**Known limitations / risks:** the window is a code constant, not per-source policy; the effective
state depends on the API host's clock.

**Next dependency:** TASK-042 source reliability report; deploy.
