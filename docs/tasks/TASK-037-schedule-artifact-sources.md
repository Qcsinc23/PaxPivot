# TASK-037 — Schedule artifacts: register the 72-hour PDFs, discover and capture them

## Status

`review` — product-owner decision 2026-09-11: "approve the PDFs as schedule artifacts and go with option 1".

## Assigned role

`foundation`

## Goal

The four AMC terminal pages carry no departure rows (verified on captured pages 2026-09-11); the
72-hour schedules are linked PDF/slide artifacts with dated filenames under each terminal's
official document folder. Register one `schedule_artifact` source per terminal (URL = the
official folder), approved to retrieve and parse (`schedule-artifact-parse-v1`, `hash_only`,
display off until TASK-032 passes the SRC-009 gate). The provider discovers the current file on
the terminal page (prefix + `72` filename match), fetches it through Firecrawl as text
(markdown rendering of the PDF), hashes it, and records the observation against the artifact
source. `capture-corpus` writes `<sha>.md` for artifacts.

## Dependencies

TASK-031 (corpus capture), TASK-023/025 (terminal pages, Firecrawl provider).

## Owned paths

```text
apps/api/paxpivot/infrastructure/bootstrap.py, infrastructure/providers/firecrawl.py, application/corpus.py
tests/unit/test_bootstrap.py, tests/unit/test_firecrawl_provider.py, tests/integration/*
docs/tasks/TASK-037-schedule-artifact-sources.md, docs/tasks/TASK-032-*.md, tests/fixtures/parsers/amc-terminal-page/README.md
```

## Acceptance criteria

- [x] Four artifact sources seeded; every reference source is https `.mil`, no query/fragment, hash-only at most.
- [x] Discovery is deterministic (first matching link under the folder); no link, no parent, or a parent that did not answer is a `Failure`, never an observation and never "no flights".
- [x] Artifact observations carry the artifact source identity and a content hash; extraction stays `not_attempted`.
- [x] Corpus capture of an artifact writes markdown, never a body into git or the database.
- [x] Tests prove the behaviour; no unrelated files changed.

## Verification commands

```bash
make check
make migrate-test
```

## Review / merge rules

`docs/agent/MERGE_POLICY.md`; OPSEC review for anything touching source content.

## Out of scope

No parsing (TASK-032), no display of schedule content, no history.

## Handoff

(fill in after merge)
