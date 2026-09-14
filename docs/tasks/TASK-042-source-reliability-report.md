# TASK-042 — Source reliability report (the source-health gate, computed)

## Status

`review` — PR #49 open; see Handoff.

## Assigned role

`foundation`

## Goal

`make source-report` (locally) and `python -m paxpivot.tooling source-report <days>` (in the API
container) print, per source the pipeline may currently retrieve, the pilot's source-health gate
over a window: expected vs. successful checks, completion, longest gap between successful reads,
gaps over 6.5 h, content changes, an upper bound on change-detection p95, and a PASS / WATCH /
STOP / UNKNOWN verdict. Every other source is listed as not measured, with the reason. Read-only.

## Why this task exists

The validation review's first production gate is a 30-day source reliability series, and the
pilot baseline (`paxpivot.md`, source-health gate) defines it: pass at ≥ 95 % scheduled checks
completed and p95 material-change detection ≤ 6.5 h; stop below 90 % or on staleness more than
12 h beyond policy. The 6-hourly checks have been recording observations since the TASK-025/038
deploys, but nothing computed those numbers, so the planner-path decision could not rest on them.

## Dependencies

- TASK-041 (`read_services.FRESHNESS_WINDOW`, the single SRC-008 window).
- Existing seams: `ObservationReader.list_for_source(source_id, *, limit)`,
  `KillSwitchReader.list_engaged()`, `source_gate.authorize_processing` — no port change.

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
apps/api/paxpivot/application/source_gate.py::authorize_processing
apps/api/paxpivot/domain/source.py::SourceObservation, RetrievalState, SourceProcessingPolicy
```

## Interfaces consumed

```text
apps/api/paxpivot/application/ports/repositories.py::ObservationReader.list_for_source
apps/api/paxpivot/application/ports/repositories.py::KillSwitchReader.list_engaged
apps/api/paxpivot/application/source_gate.py::authorize_processing
apps/api/paxpivot/application/read_services.py::FRESHNESS_WINDOW
```

## Interfaces produced

```text
apps/api/paxpivot/application/source_reliability.py::report_scope(sources, switches) -> (measured, [(source, message_key)])
apps/api/paxpivot/application/source_reliability.py::reliability(observations, cadence_minutes, start, now) -> SourceReliability
apps/api/paxpivot/application/source_reliability.py::Verdict (pass | watch | stop | unknown)
python -m paxpivot.tooling source-report [days=30]   exit 1 any STOP · 2 no observation in window · 0 otherwise
make source-report [DAYS=30]
```

## Definitions

| Measure | Rule |
|---|---|
| scope | a source is measured only while `authorize_processing(source, RETRIEVE, engaged switches)` allows it — the gate check-sources applies; disabled, paused, restricted and kill-switched sources are printed as `SKIPPED … not measured (<message key>)` |
| window | `[now − days, now]`; a source first observed inside it is measured from that first observation (`clipped`) |
| expected | `floor(measured span / cadence)` — assumes the scheduler runs at the registered cadence |
| successful | observations in the window with retrieval `succeeded` |
| completion | `min(100, successful / expected × 100)`; unknown when nothing is expected yet |
| longest gap | largest interval between successful reads, window start and `now` included |
| hashed | at least one successful read in the window carried a content hash |
| changes / detection p95 | successful reads whose content hash differs from the previous successful read; p95 (nearest rank) of the gap before each such read — an upper bound; printed as unmeasurable when not hashed |
| STOP | completion < 90 % or longest gap > 18.5 h (6.5 h + 12 h) |
| PASS | not clipped, completion ≥ 95 %, and detection p95 ≤ 6.5 h — or no change seen while the reads were hashed |
| WATCH | anything else measurable (includes every clipped window and every unhashed source) |
| UNKNOWN | no cadence registered, or the source was never observed |

## Acceptance criteria

- [x] A complete history passes; a single missed run is counted but does not fail the gate.
- [x] A gap beyond 18.5 h stops the source even at ≥ 95 % completion.
- [x] Failed reads count as recorded, not successful; completion below 90 % stops.
- [x] Slow change detection (p95 > 6.5 h) keeps a source at WATCH.
- [x] Hashes that never change pass the detection half; reads with no content hash cannot pass it.
- [x] A newly registered source is measured from its first check and cannot PASS.
- [x] No cadence or no history is UNKNOWN, never an outage; a source observed only before the
      window and silent inside it stops.
- [x] Paused, disabled, restricted and kill-switched sources are never measured, and are listed
      with the gate's reason; a history that hits the read limit is flagged in the output.
- [x] Nothing is written.
- [x] Tests prove the behaviour and catch seeded defects; no unrelated files changed.

## Required tests

```text
tests/unit/test_source_reliability.py (11 cases)
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

**Branch:** `foundation/TASK-042-source-reliability-report` (on `main` after TASK-039/041)

**Commit:** reported in the PR.

**Files changed:** the owned paths above.

**Interfaces added/changed:** see "Interfaces produced".

**Migrations:** none.

**Review (fresh, 1 Critical / 1 Important / 2 Minor → all fixed):**

- *Critical:* the report selected sources by `enabled and not restricted`, so a source a person
  paused — which check-sources then never reads again — would have printed STOP, indistinguishable
  from an outage. Scope now comes from `authorize_processing(RETRIEVE)`, the pipeline's own gate,
  via `report_scope`; unmeasured sources are listed with the gate's reason.
- *Important:* with no content hashes every detection p95 was `None`, which satisfied PASS exactly
  like "no change happened". `SourceReliability.hashed` now distinguishes the two: an unhashed
  source can at best WATCH and its detection prints as unmeasurable.
- *Minor:* a history that reaches the 10 000-row read limit is now flagged in the output line.
- *Minor:* a no-hash case (and the unchanging-hash counterpart) is now pinned by tests.

**Verification run (2026-09-14):**

```text
mutation check, first version: 4 seeded defects -> each caught (gap threshold 1, detection
                                                   threshold 1, clipped-window rule 1, change detection 2)
mutation check, review fixes: 2 seeded defects  -> each caught (paused sources measured 1,
                                                   unhashed sources passing detection 1)
ruff format / ruff check / mypy                 -> PASS
test_source_reliability.py                      -> 11 passed
make check (after review fixes, on main f02c4be) -> PASS (exit 0)
  format-check / lint / typecheck               -> PASS
  test-unit                                     -> PASS: 275 Python (+11), 341 web
  test-integration                              -> PASS: 40
  build / migrate / migrate-check / compose-check -> PASS
make migrate-test                               -> PASS (baseline, drift detection, seed, 24 CHECK rules, roundtrip)
make seed && make source-report (local, no observations)
                                                -> four sources UNKNOWN, exit 2 (the no-data path)
```

Two earlier local `make check` runs failed for reasons outside the change: one on a line-length lint
error in the new CLI output (fixed), one on web accessibility tests timing out at the 5 s default
while the machine ran several suites at once (load average 47); those files passed with a 30 s
timeout and the whole web suite passed on the next clean run.

**Known limitations / risks:** expected checks assume cron interval = cadence; detection latency is
an upper bound; a source paused or kill-switched for part of the window and later re-enabled shows
that gap; the report reads up to 10 000 observations per source.

**Next dependency:** run on the pilot VPS after deploy and record the first report.
