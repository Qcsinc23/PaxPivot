# TASK-023 — Source registry reference data (terminal pages under review)

## Status

`review` — unblocked 2026-09-11: the product owner delegated the URL confirmation and the
metadata-only approval decision. URLs were read from the official AMC Travel Site directory
(not guessed): Joint-Base-MDL, Dover-AFB, Baltimore-Washington-International-Airport and
Joint-Base-Andrews passenger-terminal pages under `amc.af.mil/AMC-Travel-Site/Terminals/CONUS-Terminals/`.

## Assigned role

`build`

## Goal

Extend `REFERENCE_TERMINALS`/reference sources so each seeded terminal has one `terminal_page`
source (official URL, authority, `needs_review`, disabled, no cadence) and prove the registry is
metadata-only, idempotent and free of observations.

## Why this task exists

ADR-004 seeds only the directory page. Live Terminals detail needs each terminal's official page
as its "Official page" action and as the source whose future observations back its evidence.
pilot SRC-002: every source has a register entry with authority and public URL; default "not approved".

## Dependencies

- Required merged task: `TASK-020`.
- Human input: confirmed URLs (see Status).

## Owned paths

```text
apps/api/paxpivot/infrastructure/bootstrap.py
tests/unit/test_bootstrap.py
tests/integration/test_sources_terminals_db.py   (extend seed assertions only)
docs/tasks/TASK-023-source-registry-review-data.md
```

## Interfaces consumed

```text
domain/source.py::Source, SourceIdentity, SourceKind, SourceProcessingPolicy (UNREVIEWED_POLICY)
infrastructure/bootstrap.py::seed_reference_data, REFERENCE_TERMINALS, DIRECTORY_SOURCE
```

## Interfaces produced

```text
infrastructure/bootstrap.py::REFERENCE_SOURCES: tuple[Source, ...]   (directory + terminal pages)
```

## Acceptance criteria

- [x] Every reference source: HTTPS, `.mil` host, no query/fragment, UUID5 ids; the directory page stays
      `needs_review`/disabled; the four terminal pages are `approved` for retrieve+hash+display only
      (`hash_only`, adapter `firecrawl`, cadence 360 min).
- [x] Seed inserts 5 sources on an empty DB and 0 on the second run; downgrade/upgrade still clean.
- [x] No observation, fact, coordinate or entrance is seeded; `operational_state` stays `unknown`.
- [x] Unit test scans `bootstrap.py` for any `SourceObservation`/coordinate literal and fails if present.

## Required tests

```text
tests/unit/test_bootstrap.py
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
Also `make migrate-test` and `make seed` twice.

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies.

## Out of scope

- No retrieval, no Firecrawl, no approval (a human sets `approved` through a later operator path).

## Blocked / contract change needed

`None` — resolved by the product owner's delegated decision (2026-09-11). Approval recorded in
`APPROVED_TERMINAL_PAGE_POLICY` (reviewer `product-owner-delegated-2026-09-11`): retrieve, hash
(`hash_only`) and display only; parse/summarize/aggregate remain forbidden.

## Handoff

(fill in per template)
