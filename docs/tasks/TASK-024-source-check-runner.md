# TASK-024 — Source check runner over the observation pipeline

## Status

`review` — TASK-020 is merged (`f430acb`); implemented and verified.

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

**Branch:** `build/TASK-024-source-check-runner` from `main` @ `64122a4` (TASK-022 merge).

**Files changed:** the four owned paths only.

**Interfaces produced:** exactly the three the task specifies, with no additions —
`SourceCheckOutcome`, `SourceCheckRun`, `run_source_checks`. `SourceCheckRun` also exposes
`recorded` / `skipped` / `rejected` / `provider_failures` grouping properties for callers that want
one bucket; they are derived from `outcomes` and assert nothing new.

**Migrations:** none. This task adds no table and changes no contract.

**Behaviour, as required**

| Situation | Outcome | Provider invoked | Stored |
| --- | --- | --- | --- |
| disabled, paused, restricted, unreviewed-without-retrieve | `skipped` + the gate's key | no | nothing |
| source / adapter / mode kill switch engaged | `skipped` + `source.kill_switch_engaged` | no | nothing |
| provider is not the source's registered adapter, or the source has none | `skipped` + `source_provider.identity_mismatch` | no | nothing |
| retrieval failed (`source_unreachable` / `source_missing`) | `recorded` + that exact state | yes | one observation |
| provider returned `Failure` | `provider_failure` | yes | nothing |
| returned observation violates registry/policy | `rejected` | yes | nothing |

`source_unreachable` and `source_missing` are stored as those states and are asserted never to
become `no_departures_published`.

The gate is consulted **before** the provider is invoked, which is what makes "the provider is never
called for a forbidden source" true rather than incidental. It is the same `authorize_processing`
call `record_observation` makes; the runner repeats it only to classify the refusal as a skip
rather than discovering it part-way through. `record_observation` remains the sole writer, so there
is one gate order and one validation path.

`rejected` vs `provider_failure` is decided by the contract's own error codes, not by guessing at
provider wording: with the gate already approved, a `forbidden`/`invalid_input` code can only have
come from `validate_against_policy` refusing what the provider returned.

**Verification run:** after the final edit, on this branch based on `main` @ `64122a4`:

```text
make format-check     -> PASS   make build         -> PASS
make lint             -> PASS   make migrate       -> PASS
make typecheck        -> PASS   make migrate-check -> PASS
make test-unit        -> PASS   make compose-check -> PASS
make test-integration -> PASS   make test           -> PASS
```

Counts: pytest 212 unit + 27 integration (was 190 + 13); Vitest unchanged at 21 files / 319 tests;
mypy clean on 42 files.

**Rejected path, proved against the real database too.** A provider returning an observation
carrying a credentialed URL (`?api_key=…`) is `rejected` with `source.url_carries_credentials`,
the provider *is* recorded as invoked (it is a rejection, not a skip), and nothing is persisted —
so no credentialed URL can reach the database from this path. This closed a gap found during
adversarial review: the `rejected` outcome had been proved only in fakes.

While writing that test, `model_copy` silently skipped `HttpUrl` validation, leaving a plain string
whose `.query` was empty and defeating the check under test. The test now builds the identity
through `model_validate`, and the comment records why — the same trap would hide a real regression.

**Integration proof, against a real temporary database** (`temporary_database`, migrated to head,
dropped afterwards):

```text
seed (1 needs_review directory source, 4 terminals)
  → add a test-only approved source with its own adapter identity
  → run the fixture provider inside db.transaction(...)
  → commit
  → list_source_health reports the new observation as that source's latest
  → run again → history contains two observations, the first still present
```

The seeded directory source is `skipped` in every run and **contributes no observation however many
times the runner runs** — asserted directly, because "cannot be read" has to be proved, not assumed.

**Transaction proof.** A run that appends an observation *and* a terminal fact and then raises
leaves the database exactly as it was: the observation id is not in the source's history, the fact
id is not among the terminal's current facts, and both row counts are unchanged. The commit path is
proved by the runs above, which persist.

**Append-only triggers untouched.** After a real run, `UPDATE source_observations` and
`DELETE FROM source_observations` both still raise `append-only`. The trigger rejected the *test's
own* attempt to clean up rows during development, which is how it earned its place here.

**No-network guard armed.** `socket.getaddrinfo` and `socket.create_connection` raise for every
test in both new files, with a test that proves the guard itself fires. `source_checks.py` is also
parsed for forbidden imports (`httpx`, `requests`, `urllib`, `aiohttp`, `http`, `ssl`, `firecrawl`,
`socket`) so the runner cannot silently gain an HTTP client.

**Mutation proof.** Each required behaviour was reverted in place and the suites re-run, then
restored:

```text
gate not consulted before the provider        ->  9 tests fail
identity mismatch ignored                     ->  4 tests fail
gate denial reported as recorded              -> 11 tests fail
provider Failure reported as recorded         ->  3 tests fail
policy violation reported as provider_failure ->  3 tests fail
```

**Test-isolation note (recorded because it shaped the design).** These tests share one temporary
database, and observations are append-only, so a test cannot clear what an earlier one wrote. Each
test therefore uses its **own** source identity (`uuid5` of a per-test label). That is why the
assertions are about the source under test rather than global row counts: every run walks the whole
registry, which accumulates the sources other tests registered. An earlier draft asserted global
counts and passed only when tests ran in one particular order.

**Out of scope (confirmed absent):** no RQ job, scheduler, cadence enforcement, retries, Firecrawl,
new tables or parser. The runner is a synchronous pass the caller drives.

**Known limitations / risks:** the runner has no caller yet — nothing schedules it, which is
deliberate (no cadence decision exists). `run_source_checks` walks every registered source on every
call; with a large registry that is linear work per run, and a future scheduled caller will need a
cadence/filter decision that this task explicitly does not make.

**Next dependency:** TASK-025 (blocked on product-owner input, plus this task's merge).
