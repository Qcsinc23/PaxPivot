# TASK-023 — Source registry reference data (terminal pages under review)

## Status

`blocked` — needs the product owner to supply/confirm the official terminal-page URLs for the four
seeded terminals (from the AMC Travel Site directory). Do not look them up by scraping or guess
them; a wrong official URL in the registry is worse than none.

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

- [ ] Every reference source: HTTPS, host ends with `.mil`, `needs_review`, `enabled=False`,
      `may_retrieve=False`, `raw_payload=denied`, no adapter, no cadence; UUID5 ids.
- [ ] Seed inserts N sources on an empty DB and 0 on the second run; downgrade/upgrade still clean.
- [ ] No observation, fact, coordinate or entrance is seeded; `operational_state` stays `unknown`.
- [ ] Unit test scans `bootstrap.py` for any `SourceObservation`/coordinate literal and fails if present.

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

Product owner: confirm the four terminal-page URLs and the directory URL in ADR-004. Then flip to `ready`.

## Handoff

(fill in per template)
