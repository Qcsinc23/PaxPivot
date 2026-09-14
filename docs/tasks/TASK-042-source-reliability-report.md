# TASK-042 — Source reliability report (the source-health gate, computed)

## Status

`review` — PR open; see Handoff.

## Assigned role

`foundation`

## Goal

`make source-report` (locally) and `python -m paxpivot.tooling source-report <days>` (in the API
container) print, per enabled and unrestricted source, the pilot's source-health gate over a
window: expected vs. successful checks, completion, longest gap between successful reads, gaps
over 6.5 h, content changes, an upper bound on change-detection p95, and a PASS / WATCH / STOP /
UNKNOWN verdict. Read-only.

## Why this task exists

The validation review's first production gate is a 30-day source reliability series, and the
pilot baseline (`paxpivot.md`, source-health gate) defines it: pass at ≥ 95 % scheduled checks
completed and p95 material-change detection ≤ 6.5 h; stop below 90 % or on staleness more than
12 h beyond policy. The 6-hourly checks have been recording observations since the TASK-025/038
deploys, but nothing computed those numbers, so the planner-path decision could not rest on them.

## Dependencies

- TASK-041 (`read_services.FRESHNESS_WINDOW`, the single SRC-008 window).
- Existing port: `ObservationReader.list_for_source(source_id, *, limit)` — no port change.

## Owned paths

```text
apps/api/paxpivot/application/source_reliability.py   (new)
apps/api/paxpivot/tooling.py                          (source-report command)
Makefile                                              (source-report target, DAYS)
tests/unit/test_source_reliability.py                 (new)
docs/tasks/TASK-042-source-reliability-report.md
```

README and DEPLOYMENT.md rows for the command are written by the documentation-truth task, which
owns those files in this milestone.

## Read-only context

```text
paxpivot.md (source-health gate, SRC-008)
apps/api/paxpivot/application/read_services.py::FRESHNESS_WINDOW
apps/api/paxpivot/domain/source.py::SourceObservation, RetrievalState, PolicyReviewState
```

## Interfaces consumed

```text
apps/api/paxpivot/application/ports/repositories.py::ObservationReader.list_for_source
apps/api/paxpivot/application/read_services.py::FRESHNESS_WINDOW
```

## Interfaces produced

```text
apps/api/paxpivot/application/source_reliability.py::reliability(observations, cadence_minutes, start, now) -> SourceReliability
apps/api/paxpivot/application/source_reliability.py::Verdict (pass | watch | stop | unknown)
python -m paxpivot.tooling source-report [days=30]   exit 1 any STOP · 2 no observation in window · 0 otherwise
make source-report [DAYS=30]
```

## Definitions

| Measure | Rule |
|---|---|
| window | `[now − days, now]`; a source first observed inside it is measured from that first observation (`clipped`) |
| expected | `floor(measured span / cadence)` — assumes the scheduler runs at the registered cadence |
| successful | observations in the window with retrieval `succeeded` |
| completion | `min(100, successful / expected × 100)`; unknown when nothing is expected yet |
| longest gap | largest interval between successful reads, window start and `now` included |
| changes / detection p95 | successful reads whose content hash differs from the previous successful read; p95 (nearest rank) of the gap before each such read — an upper bound |
| STOP | completion < 90 % or longest gap > 18.5 h (6.5 h + 12 h) |
| PASS | not clipped, completion ≥ 95 % and detection p95 ≤ 6.5 h (or no changes) |
| WATCH | anything else measurable (includes every clipped window) |
| UNKNOWN | no cadence registered, or the source was never observed |

## Acceptance criteria

- [x] A complete history passes; a single missed run is counted but does not fail the gate.
- [x] A gap beyond 18.5 h stops the source even at ≥ 95 % completion.
- [x] Failed reads count as recorded, not successful; completion below 90 % stops.
- [x] Slow change detection (p95 > 6.5 h) keeps a source at WATCH.
- [x] A newly registered source is measured from its first check and cannot PASS.
- [x] No cadence or no history is UNKNOWN, never an outage; a source observed only before the
      window and silent inside it stops.
- [x] Nothing is written; restricted and disabled sources are not measured.
- [x] Tests prove the behaviour and catch seeded defects; no unrelated files changed.

## Required tests

```text
tests/unit/test_source_reliability.py (8 cases)
```

## Verification commands

```bash
make setup
make check
make migrate-test
make source-report
```

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies.

## Out of scope

- Alerting (heartbeat), scheduling the report, storing results.
- A time-bounded repository read (the capped history read is enough at a 6-hour cadence).
- README / DEPLOYMENT.md text (documentation-truth task).

## Blocked / contract change needed

`None`

## Handoff

**Branch:** `foundation/TASK-042-source-reliability-report` (rebased on TASK-041)

**Commit:** reported in the PR.

**Files changed:** the owned paths above.

**Interfaces added/changed:** see "Interfaces produced".

**Migrations:** none.

**Verification run (2026-09-14, on TASK-041):**

```text
mutation check: 4 seeded defects            -> each caught (gap threshold 1, detection threshold 1,
                                               clipped-window rule 1, change detection 2 failures)
make format                                  -> PASS
make check                                   -> PASS (exit 0)
  format-check / lint / typecheck            -> PASS
  test-unit                                  -> PASS: 272 Python (+8), 339 web
  test-integration                           -> PASS: 40
  build / migrate / migrate-check            -> PASS
make migrate-test                            -> PASS (baseline, drift detection, seed, 24 CHECK rules, roundtrip)
make seed && make source-report (local, no observations)
                                             -> four sources UNKNOWN, exit 2 (the no-data path)
```

Two earlier local `make check` runs failed for reasons outside this change: one on a line-length
lint error in the new CLI output (fixed), one on web accessibility tests timing out at the 5 s
default while the machine ran several suites at once (load average 47); those files pass with a
30 s timeout and the whole web suite passed on the clean run above.

**Known limitations / risks:** expected checks assume cron interval = cadence; detection latency is
an upper bound; the report reads up to 10 000 observations per source.

**Next dependency:** run on the pilot VPS after deploy and record the first report.
