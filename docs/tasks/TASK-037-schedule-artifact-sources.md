# TASK-037 — Schedule artifacts: register the 72-hour PDFs, discover and capture them

## Status

`done` — merged in PR #43 (da424f5, post-merge CI green) and the option-1 follow-up PR; artifacts are registered but user-opened only after the marking finding below.

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

## Marking finding and product-owner decision (2026-09-11)

The first captures showed that the Joint Base Andrews 72-hour slide deck is stamped CUI and
that the Andrews and Dover documents carry a notice restricting the information to determining
Space-A availability and forbidding retransmission. PRD §16.2 and the register's "notice/marking
state" make this a stop. The retrieved text was deleted from the host, the container and the
working directory; the three hash-only observations hold no content. The product owner chose
option 1: the artifacts stay registered (so the terminal page can point travelers at the
official document) under `schedule-artifact-user-open-v2`: restricted, never retrieved, parsed,
hashed or displayed by PaxPivot. Re-seeding tightens any `schedule-artifact-parse-v1` row to
this policy and never loosens a pause.

## Review fixes on the option-1 follow-up (0 Critical / 1 Important → fixed)

- A restricted source contributes no evidence to terminal reads (summary headline and the
  per-source row show nothing); operators keep the history on source health. The three
  hash-only observations recorded under v1 are retained as history lawful under that version:
  a SHA-256 is not content, and `Provenance.policy_version_id` records which policy applied.
- Domain validator and CHECK `ck_sources_restricted_allows_nothing` (migration 0005): a
  restricted register row allows nothing and retains nothing, so the register cannot contradict
  the gate. Gate keys `source.restricted` / `source.paused` distinguish a decision from a pending
  review. The provider refuses any source its own gate refuses, even on a direct call.
- Seeding never rewrites a paused row, even to tighten it; a person re-applies the restriction.
- Firecrawl's own logs and caches for the four renders are outside PaxPivot's control; request
  deletion through the account if the owner wants that closed.

## Handoff

- **Merged:** PR #43 (discovery, capture, hash-only observation) and the option-1 follow-up.
- **Live:** artifact register rows restricted; `check-sources` skips them (`skipped` outcome).
- **Not done:** no schedule parsing; TASK-032 is blocked until AMC/terminal permission exists
  (option 2). The terminal page's own "current as of" stamp is the honest next signal
  (proposed TASK-038: page metadata parse under `terminal-page-parse-v2`).

## Review decisions (2026-09-11)

- An artifact's parent page is fetched only under the page's own authorization (review state
  and engaged kill switches are passed into the provider); a paused or switched page is never
  fetched on the artifact's behalf.
- Discovery requires a `72 hour`/`72HR` filename, refuses path separators (encoded or not),
  resolves relative links against the page, and matches the folder case-insensitively.
- One provider instance caches each terminal page per run, so a run costs 4 page fetches + 4
  PDF renders (Firecrawl bills PDFs per page); an empty or unrenderable PDF is recorded as
  `fresh` with `content_hash_unavailable`, never as a hash of nothing.
