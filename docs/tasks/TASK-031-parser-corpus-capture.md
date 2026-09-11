# TASK-031 — Parsing approval and labeled-corpus capture for the AMC terminal pages

## Status

`review` — this PR; decisions delegated by the product owner (2026-09-11); see AUDIT.md §4/§6.

## Assigned role

`build`

## Goal

Approve `may_parse` for the four registered AMC terminal pages (product owner's delegated
decision, 2026-09-11; recorded in `APPROVED_TERMINAL_PAGE_POLICY` as a new policy version) and add
`python -m paxpivot.tooling capture-corpus <source_id>` which fetches one page through the existing
Firecrawl provider path and writes the `rawHtml` to `tests/fixtures/parsers/amc-terminal-page/<sha256>.html`
plus an empty label template `<sha256>.labels.yaml`. Nothing is recorded in the database; the
command is for building the labeled corpus SRC-009 requires.

## Dependencies

TASK-025

## Owned paths

```text
apps/api/paxpivot/infrastructure/bootstrap.py (policy version bump: may_parse=True, policy_version_id terminal-page-parse-v2)
apps/api/paxpivot/tooling.py (capture-corpus), apps/api/paxpivot/application/corpus.py, infrastructure/providers/firecrawl.py (fetch_document)
tests/fixtures/parsers/amc-terminal-page/README.md, tests/unit/test_corpus_capture.py
docs/tasks/TASK-031-parser-corpus-capture.md
```

## Acceptance criteria

- [x] Policy version v2 keeps `hash_only`, adds `may_parse=True`; existing v1 observations stay valid history; the pipeline's policy-version check means new observations carry v2.
- [x] `capture-corpus` writes the file and template, prints the hash, records nothing (assert no new `source_observations` row); refuses a source whose policy forbids parsing.
- [x] README states: every corpus file needs a human-completed label file before it may be used by TASK-032; no movement rows are committed without review.
- [x] Unit test with `httpx.MockTransport`.
- [x] Tests prove the behaviour; no unrelated files changed.

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

`docs/agent/MERGE_POLICY.md`; OPSEC review for anything touching source content.

## Out of scope

No parser, no schedule rows, no UI change.

## Blocked / contract change needed

`None`

## Handoff

(fill in per template)

## Review decisions (2026-09-11, delegated product-owner call)

- Captured page bodies live in `private-fixtures/parsers/amc-terminal-page/` (gitignored), never
  in this public repository or the database; retain at most 90 days (PRD §16.4). Registry policy
  stays `hash_only`.
- `seed` upgrades only known prior versions (`terminal-page-metadata-v1`) and never touches
  paused or restricted rows; each upgrade is printed with its source id.
- Capture refuses non-2xx pages, empty bodies, and a provider whose id differs from the
  source's adapter id.
