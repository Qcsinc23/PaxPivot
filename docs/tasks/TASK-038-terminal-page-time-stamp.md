# TASK-038 — Terminal page "current as of" stamp as source time

## Status

`done` — merged in PR #45 (56cee3a, post-merge CI green); deployed to the VPS at tag 56cee3a on 2026-09-11.

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

## Review decisions (2026-09-11; 0 Critical / 2 Important → fixed)

- The stamp is read only when `authorize_processing(PARSE)` passes, switches included, so an
  engaged parse switch stops interpretation without discarding the retrieval.
- A date-only stamp sets no `source_time` (reason `page_time_date_only`, extraction failed):
  the UI must never show a clock the page did not print.
- The first stamp on the page decides; a mangled one yields nothing rather than an older notice.
  Months are full names, three-letter forms or "sept"; years 2020–2100; a time needs the page's
  "at" or trailing "L".
- The page's zone token ("EST") is ignored: "L" is the terminal's local clock in its IANA zone
  (reason `page_time_local_clock`).

## Handoff

- **Merged:** PR #45 → 56cee3a; post-merge `Quality` green. Deployed `paxpivot-api:56cee3a`.
- **Live result (check-sources after deploy):** BWI, Andrews and MDL terminal pages now carry
  `source_time` read from their own stamp (`extraction=exact_text`, `amc-page-time-v1`); Dover
  prints no stamp and reports `extraction=failed`, `source_time` unknown. The terminal detail's
  evidence age shows the page time beside the read time (SRC-008).
- **Adversarial review (fresh, 0 Critical / 2 Important → fixed):** parse gated by engaged
  switches; date-only stamps set no time; first stamp decides; strict months/years; local-clock
  interpretation recorded as a reason.
- **Not done:** no departure rows, seat states or opportunities; TASK-032 stays blocked on
  written permission for the marked schedule artifacts (TASK-037).
