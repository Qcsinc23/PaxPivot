# TASK-042 — Source reliability report (the source-health gate, computed)

## Status

`done` — merged to `main` in 5ef033e (PR #49); fourth fresh review 0 Critical / 0 Important / 0 Minor; status normalized in TASK-040.

## Assigned role

`foundation`

## Goal

`make source-report` (locally) and `python -m paxpivot.tooling source-report <days>` (in the API
container) print, per source a check-sources run would read, the pilot's source-health gate over a
window: expected vs. successful checks, completion, longest gap between successful reads, gaps
over 6.5 h, content changes, an upper bound on change-detection p95, and a PASS / WATCH / STOP /
UNKNOWN verdict. Every other source is listed as not measured, with the reason. Read-only.

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
apps/api/paxpivot/application/source_checks.py        (skip_reason, shared with the run; added after review 2)
apps/api/paxpivot/tooling.py                          (source-report command)
Makefile                                              (source-report target, DAYS)
tests/unit/test_source_reliability.py                 (new)
docs/tasks/TASK-042-source-reliability-report.md
```

`source_checks.py` was added after the second review: the run skips a source for two reasons (the
gate, then an adapter that is not the running provider), and the report must skip exactly the same
sources. The skip decision now lives in one function both call, so the two cannot drift.

README and DEPLOYMENT.md rows for the command are written by the documentation-truth task, which
owns those files in this milestone.

## Read-only context

```text
paxpivot.md (source-health gate, SRC-008)
apps/api/paxpivot/application/read_services.py::FRESHNESS_WINDOW
apps/api/paxpivot/application/source_gate.py::authorize_processing
apps/api/paxpivot/domain/source.py::SourceObservation, RetrievalState, SourceProcessingPolicy
apps/api/paxpivot/infrastructure/providers/firecrawl.py::PROVIDER_ID
```

## Interfaces consumed

```text
apps/api/paxpivot/application/ports/repositories.py::ObservationReader.list_for_source
apps/api/paxpivot/application/ports/repositories.py::KillSwitchReader.list_engaged
apps/api/paxpivot/application/source_gate.py::authorize_processing
apps/api/paxpivot/application/read_services.py::FRESHNESS_WINDOW
apps/api/paxpivot/infrastructure/providers/firecrawl.py::PROVIDER_ID
```

## Interfaces produced

```text
apps/api/paxpivot/application/source_checks.py::skip_reason(source, provider_id, switches) -> str | None   (check_source uses it; replaces _identity_mismatch, same message keys)
apps/api/paxpivot/application/source_reliability.py::report_scope(sources, switches, provider_id) -> (measured, [(source, message_key)])
apps/api/paxpivot/application/source_reliability.py::reliability(observations, cadence_minutes, start, now) -> SourceReliability
apps/api/paxpivot/application/source_reliability.py::report_exit_code(results) -> 1 | 2 | 0
apps/api/paxpivot/application/source_reliability.py::Verdict (pass | watch | stop | unknown)
python -m paxpivot.tooling source-report [days=30]   exit 1 any STOP · 2 nothing recorded · 0 otherwise
make source-report [DAYS=30]
```

## Definitions

| Measure | Rule |
|---|---|
| scope | a source is measured only when `skip_reason(source, PROVIDER_ID, engaged switches)` is None — the function check-sources itself uses. Disabled, paused, restricted, kill-switched and unwired (adapter is not the running provider) sources print as `SKIPPED … not measured (<message key>)` |
| window | `[now − days, now]`; a source first observed inside it is measured from that first observation (`clipped`) |
| expected | `floor(measured span / cadence)` — assumes the scheduler runs at the registered cadence |
| successful | observations in the window with retrieval `succeeded` |
| completion | `min(100, successful / expected × 100)`; unknown when nothing is expected yet |
| longest gap | largest interval between successful reads, window start and `now` included |
| hashed | **every** successful read in the window carried a content hash (partial coverage is not hashed) |
| changes / detection p95 | successful reads whose content hash differs from the previous successful read; p95 (nearest rank) of the gap before each such read — an upper bound. Printed as unmeasurable when not hashed, and as "no change seen" when hashed with no change |
| STOP | completion < 90 % or longest gap > 18.5 h (6.5 h + 12 h) |
| PASS | not clipped, completion ≥ 95 %, **hashed**, and detection p95 ≤ 6.5 h or no change seen. Full hash coverage is a precondition: a quick change seen in a few hashed reads cannot pass |
| WATCH | anything else measurable (includes every clipped window and every source without full hash coverage) |
| UNKNOWN | no cadence registered, or the source was never observed |
| exit code | 1 when any measured source is STOP (checked first); otherwise 2 when no measured source recorded an observation (including every source skipped); otherwise 0 |
| truncation | the report reads `limit + 1` rows per source and flags a history longer than the limit |

## Acceptance criteria

- [x] A complete history passes; a single missed run is counted but does not fail the gate.
- [x] A gap beyond 18.5 h stops the source even at ≥ 95 % completion.
- [x] Failed reads count as recorded, not successful; completion below 90 % stops.
- [x] Slow change detection (p95 > 6.5 h) keeps a source at WATCH.
- [x] Hashes that never change pass the detection half; no or partial hash coverage cannot, even
      when a change inside the hashed part was detected quickly.
- [x] A newly registered source is measured from its first check and cannot PASS.
- [x] No cadence or no history is UNKNOWN, never an outage; a source observed only before the
      window and silent inside it stops.
- [x] Exactly the sources check-sources skips (gate refusals and adapter mismatches) are never
      measured, and are listed with the run's own reason; check-sources behaviour is unchanged.
- [x] The exit code stops first: a source that went silent exits 1, not 2; nothing recorded (or
      every source skipped) exits 2.
- [x] A history longer than the read limit is flagged in the output.
- [x] Nothing is written.
- [x] Tests prove the behaviour and catch seeded defects; no unrelated files changed.

## Required tests

```text
tests/unit/test_source_reliability.py (14 cases)
tests/unit/test_source_checks.py (unchanged; proves check_source still skips with the same keys)
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

**Review 1 (fresh, 1 Critical / 1 Important / 2 Minor → all fixed):**

- *Critical:* the report selected sources by `enabled and not restricted`, so a source a person
  paused — which check-sources then never reads again — would have printed STOP, indistinguishable
  from an outage. Scope came from `authorize_processing(RETRIEVE)` via `report_scope`; unmeasured
  sources are listed with the reason.
- *Important:* with no content hashes every detection p95 was `None`, which satisfied PASS exactly
  like "no change happened". `SourceReliability.hashed` separates the two.
- *Minor:* a history reaching the read limit is flagged in the output line.
- *Minor:* no-hash and unchanging-hash cases are pinned by tests.

**Review 2 (fresh re-review, 1 Critical / 1 Important / 1 Minor → all fixed):**

- *Critical:* `hashed` was `any` read hashed, so one stray hash (e.g. a policy that started hashing
  mid-window) let a source PASS detection without a single comparable pair. It requires every
  successful read in the window to be hashed; a partial-coverage test pins it.
- *Important:* the run also skips a source whose adapter is not the running provider, after the
  gate approves it; the report did not, so an unwired source would have read UNKNOWN instead of
  SKIPPED. The run's skip decision is now `source_checks.skip_reason`, used by both `check_source`
  and `report_scope` (with the Firecrawl `PROVIDER_ID`); an unwired-source case is pinned.
- *Minor:* truncation was flagged by equality; the report reads one extra row and flags only a
  history longer than the limit.

**Review 3 (fresh review of the final branch, 1 Critical / 0 Important / 2 Minor → all fixed):**

- *Critical:* full hash coverage was consulted only when no change was seen, so a source hashing
  just its last few reads, with one quick change among them, still passed the detection half —
  printed as `PASS … detection p95 unmeasurable`. Coverage is now an unconditional precondition
  (`hashed and (p95 is None or p95 ≤ 6.5 h)`); a partial-coverage-with-detected-change case pins it.
- *Minor:* the CLI's exit-code precedence had no test. It is now the pure `report_exit_code`,
  tested for STOP-first, silent-source and every-source-skipped cases.
- *Minor:* a fully hashed source with no change printed detection as "unknown"; it now prints
  "no change seen".
- Confirmed unchanged: `skip_reason` keeps `check_source` behaviour and message keys;
  `PROVIDER_ID` is the provider's own identity constant; the import graph has no cycle and no
  infrastructure import outside `tooling.py`.

**Verification run (2026-09-14, final tree on `main` f02c4be):**

```text
mutation check, first version: 4 seeded defects   -> each caught (gap threshold, detection threshold,
                                                     clipped-window rule, change detection)
mutation check, review 1 fixes: 2 seeded defects  -> each caught (paused sources measured,
                                                     unhashed sources passing detection)
mutation check, review 2 fixes: 2 seeded defects  -> each caught (hashed = any read,
                                                     report ignoring the adapter mismatch)
mutation check, review 3 fixes: 2 seeded defects  -> each caught (old detection rule,
                                                     "no data" checked before STOP)
ruff format / ruff check / mypy                   -> PASS
test_source_reliability.py + test_source_checks.py -> 38 passed (check_source unchanged)
make check                                        -> PASS (exit 0)
  format-check / lint / typecheck                 -> PASS
  test-unit                                       -> PASS: 278 Python (+14), 341 web
  test-integration                                -> PASS: 40
  build / migrate / migrate-check / compose-check -> PASS
make migrate-test                                 -> PASS (baseline, drift detection, seed, 24 CHECK rules, roundtrip)
make seed && make source-report (local, no observations; first version)
                                                  -> four sources UNKNOWN, exit 2 (the no-data path)
```

Two earlier local `make check` runs failed for reasons outside the change: one on a line-length lint
error in the new CLI output (fixed), one on web accessibility tests timing out at the 5 s default
while the machine ran several suites at once (load average 47); those files passed with a 30 s
timeout and the whole web suite passed on every clean run since.

**Known limitations / risks:** expected checks assume cron interval = cadence; detection latency is
an upper bound; a source paused or kill-switched for part of the window and later re-enabled shows
that gap; the report reads up to 10 001 observations per source.

**Next dependency:** run on the pilot VPS after deploy and record the first report.
