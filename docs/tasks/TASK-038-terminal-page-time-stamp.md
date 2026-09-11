# TASK-038 — Terminal page "current as of" stamp as source time

## Status

`review` — product owner: "go ahead with TASK-038" (2026-09-11).

## Assigned role

`foundation`

## Goal

With schedule artifacts restricted (TASK-037), the honest next signal is the terminal page's own
update stamp ("Current as of 11 SEPTEMBER 2026 at 0350"). A pure, versioned parser
(`amc-page-time-v1`) reads that stamp and nothing else; the Firecrawl provider records it as the
observation's `source_time` in the terminal's own clock, with `extraction=exact_text`, only for
terminal pages whose policy allows parsing. No stamp → `extraction=failed`, `source_time` unknown,
reason `page_time_not_found`; unknown terminal zone → `page_time_zone_unknown`. The UI already
shows source time beside read time (SRC-008), so travelers now see "schedule updated <stamp>"
instead of "Page showed no timestamp".

## Dependencies

TASK-025 (provider), TASK-031 (policy v2 allows parsing).

## Owned paths

```text
apps/api/paxpivot/application/parsers/amc_page_time.py, infrastructure/providers/firecrawl.py, tooling.py
tests/unit/test_amc_page_time.py, tests/unit/test_firecrawl_provider.py
docs/tasks/TASK-038-terminal-page-time-stamp.md
```

## Acceptance criteria

- [x] Parser is pure, versioned, reads only the stamp; impossible dates and non-stamps yield `None`.
- [x] `source_time` is set only from the page's stamp, zone-aware in the terminal's timezone; never inferred.
- [x] No stamp or zone → failed extraction with a static reason; never a guess, never "no flights".
- [x] Parsing only when the policy allows `PARSE`; metadata-only sources are unchanged.
- [x] Tests prove the behaviour; no unrelated files changed.

## Verification commands

```bash
make check
make migrate-test
```

## Review / merge rules

`docs/agent/MERGE_POLICY.md`; OPSEC review for anything touching source content.

## Out of scope

Departure rows, seat states, opportunities (TASK-032, blocked on permission).

## Handoff

(fill in after merge)
