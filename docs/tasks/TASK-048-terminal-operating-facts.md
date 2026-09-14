# TASK-048 — Terminal operating facts from the approved terminal pages

## Status

`review`

## Assigned role

`foundation`

## Goal

Parse the operating facts the four approved AMC terminal pages actually publish (hours, phone,
email, address/location note, USO information, parking, an access/payment note) and append them
as `terminal_facts` with full provenance, deduplicated against each terminal's latest fact of the
same kind, so `/terminals/{id}` shows real data instead of "Not published" for every kind.

## Why this task exists

`PAXPIVOT_PRODUCTION_PRD.md` §9.2/§16.2 and `paxpivot.md` TML-006 require that hours,
entrance/gate/visitor-center instructions, parking state and last-mile uncertainty be visible for
every candidate, with unknowns permitted but never hidden. The domain contract
(`TerminalOperationalFact`, ADR-004) and the read/API/UI wiring have existed since TASK-023/026,
but nothing has ever produced a fact: bootstrap seeds none, and the Firecrawl provider extracts
only page status, hash and the page's own "current as of" stamp (TASK-038). This task closes that
gap using the parsing authorization the product owner already granted for the four terminal pages
(`terminal-page-parse-v2`, TASK-031), without touching the restricted 72-hour schedule artifacts.

## Dependencies

- Required merged task/contract: `TASK-023` (terminal registry, `terminal_facts` table),
  `TASK-025` (Firecrawl provider), `TASK-031` (`terminal-page-parse-v2` policy, corpus capture),
  `TASK-038` (`amc_page_time.py` parser pattern this task follows)
- Required ADR: `ADR-004` (`TerminalOperationalFact`, `TerminalFactKind`, append-only facts table)
- Required interface/schema: `apps/api/paxpivot/domain/terminal.py::TerminalOperationalFact`,
  `application/ports/repositories.py::TerminalRepository`

## Corpus findings (structural; no page bodies quoted)

The real corpus captured by TASK-031 lives only in the gitignored `private-fixtures/` directory
on the deployment host (`docker … cp` per `docs/DEPLOYMENT.md`); it does not exist in this
worktree or anywhere else on this development host. In its place, the four live, public,
unclassified AMC terminal pages (the exact `*-terminal-page` source URLs registered in
`infrastructure/bootstrap.py`) were fetched read-only, in-process, and discarded — the same
retrieval this project's own Firecrawl adapter already performs every six hours under the
approved `terminal-page-parse-v2` policy — solely to determine their structure. No page body was
copied into this repository, the database, or any commit; the findings below describe structure
and presence/absence only.

All four pages are rendered by the same AFPIMS/DNN content-management template and share a
predictable "Contact Information" module (terminal name, street address, then labelled
Comm/DSN/Fax numbers under a "Service Counter" heading, an "Email:"/"E-Mail:" label, and an
"Hours of operation:" label), plus free-text "Local Travel Information" content that varies per
terminal. Per fact kind:

| `TerminalFactKind` | JB MDL | Dover AFB | BWI | JB Andrews |
| --- | --- | --- | --- | --- |
| `counter_hours` | present | present | present | present |
| `phone` (Service Counter) | present | present | present | present |
| `email` | present | present | present | present |
| `passenger_terminal_note` (name + street address) | present | present | present | present |
| `uso_availability` | absent | present | present | absent |
| `parking` | absent | absent | absent | present |
| `access_note` | absent | absent | present (a payment-method note near the Space-A fee) | present (a card-only/cash-not-accepted notice) |

No page publishes a departure row, a roll-call time, or a check-in window on the HTML page itself
(consistent with TASK-037's finding that departure schedules live only in the restricted 72-hour
artifacts); those remain out of scope for every kind here, deliberately, even though "Service
Counter opens N hours before departure" style text appears near the contact block — it changes
with the flight schedule and is not a stable operating fact.

## Owned paths

```text
apps/api/paxpivot/application/parsers/amc_terminal_facts.py
apps/api/paxpivot/application/ports/source_provider.py
apps/api/paxpivot/application/source_pipeline.py
apps/api/paxpivot/application/source_checks.py
apps/api/paxpivot/infrastructure/providers/firecrawl.py
apps/api/paxpivot/tooling.py
apps/web/lib/presentation/types.ts
apps/web/lib/presentation/screens/terminals.ts
apps/web/lib/presentation/adapters/terminals.ts
apps/web/lib/presentation/fixtures.ts
apps/web/components/screens/terminals/TerminalDetailScreen.tsx
apps/web/components/paxpivot/TerminalFacts.tsx
apps/web/app/terminals/[terminalId]/page.tsx
docs/architecture/CONTRACTS.md
tests/unit/test_amc_terminal_facts.py
tests/unit/test_source_pipeline.py
tests/unit/test_firecrawl_provider.py
tests/unit/test_source_checks.py
tests/unit/test_api_v1.py
apps/web/tests/adapters.test.tsx
apps/web/tests/screens/terminals.test.tsx
docs/tasks/TASK-048-terminal-operating-facts.md
```

## Read-only context

```text
PAXPIVOT_PRODUCTION_PRD.md §9
paxpivot.md TML-005/006, §16
docs/architecture/BOUNDARIES.md
docs/architecture/CONTRACTS.md
docs/decisions/ADR-004-sources-terminals-persistence.md
docs/tasks/TASK-031-parser-corpus-capture.md
docs/tasks/TASK-037-schedule-artifact-sources.md
docs/tasks/TASK-038-terminal-page-time-stamp.md
apps/api/paxpivot/application/parsers/amc_page_time.py
apps/api/paxpivot/application/read_services.py
```

## Interfaces consumed

```text
apps/api/paxpivot/domain/terminal.py::TerminalOperationalFact, TerminalFactKind, FactText
apps/api/paxpivot/application/ports/repositories.py::TerminalRepository (list_current_facts, append_fact)
apps/api/paxpivot/application/source_gate.py::authorize_processing
apps/api/paxpivot/application/read_services.py::displayable_facts, get_terminal_detail (unchanged)
```

## Interfaces produced

```text
application/parsers/amc_terminal_facts.py::parse_terminal_facts(document: str) -> list[ParsedFact]; PARSER_VERSION = "amc-terminal-facts-v1"
application/ports/source_provider.py::TerminalFactProvider (new, additive Protocol) — observe_facts(source: SourceIdentity) -> Result[tuple[ParsedFact, ...]]; SourceProvider itself is unchanged
application/source_pipeline.py::record_terminal_facts(source, facts_provider, terminal_facts, switches, observed_at) -> Result[tuple[TerminalOperationalFact, ...]]
application/source_checks.py::check_source/run_source_checks gain optional keyword-only terminal_facts: TerminalRepository | None = None and facts_provider: TerminalFactProvider | None = None (default None; every existing call site is unaffected)
infrastructure/providers/firecrawl.py::FirecrawlSourceProvider.observe_facts (new method; reuses the same per-run page cache as observe(), so pairing the two costs one Firecrawl fetch, not two)
apps/web/lib/presentation/types.ts::TerminalFactRowView (new)
apps/web/lib/presentation/adapters/terminals.ts::toFactRows (new; excludes counter_hours/parking, already covered by factValue() in the Stats grid)
apps/web/components/paxpivot/TerminalFacts.tsx (new)
```

This widens `SourceProvider`'s surface area only by adding a *separate* Protocol
(`TerminalFactProvider`) rather than changing `observe`'s signature, so none of the ~8 existing
`SourceProvider` test doubles across the suite need a stub method they do not use. Documented
under CONTRACTS.md as an additive, foundation-owned change.

## Design

- **Parser** (`amc_terminal_facts.py`, pure, versioned, modelled on `amc_page_time.py`): splits
  the document on block-level tags (`p`, `div`, `br`, `li`, `h1`-`h6`, `tr`, `td`, `table`, `ul`,
  `ol`) into short lines before stripping remaining inline tags, unescaping entities and
  collapsing whitespace — flattening the whole page into one string first (as the single-stamp
  page-time parser does) would merge a fact's value into the next paragraph or module, which this
  parser cannot risk when it is locating several different facts on one page. Each fact kind has
  its own small, deterministic extraction rule keyed to the template's own labels (e.g. "Contact
  Information", "Service Counter", "Email:"/"E-Mail:", "Hours of operation:", "USO Information",
  a "parking" mention, a "card-only" mention). A kind whose label is absent yields nothing for
  that kind; a kind whose label is present but whose value is empty, unparseable as an email, or
  longer than `MAX_FACT_LENGTH` (500 characters — well under `FactText`'s 2000-character ceiling,
  keeping every fact a genuinely short span) also yields nothing rather than a guess or a
  mid-sentence truncation.
- **Call site**: `FirecrawlSourceProvider.observe_facts` (new method, same class as `observe`)
  fetches the terminal page through the same per-run cache `_fetch_registered` already uses for
  schedule-artifact parent pages (now applied to every terminal-page fetch), so calling it right
  after `observe()` for the same source in one check run costs no second Firecrawl request. It
  returns facts only for `SourceKind.TERMINAL_PAGE`; for every other kind it returns an empty
  tuple without fetching anything.
- `application/source_pipeline.record_terminal_facts` is the authorization + dedup + append seam,
  parallel to `record_observation`: it checks the adapter identity (mirroring
  `record_observation`), then `authorize_processing(source, PARSE, switches)` **and**
  `authorize_processing(source, DISPLAY, switches)` — both must pass, matching the acceptance
  criterion that facts are never written for a source the current policy would not also let
  PaxPivot show. A restricted or schedule-artifact source, or a page with parsing paused by a
  kill switch, therefore never gets a fact appended, even though its retrieval may still succeed.
  It then reads `terminal_facts.list_current_facts(terminal_id)` and appends a new fact only when
  no current fact of that kind exists or the current one's `value` differs — so a 6-hour cadence
  check that reads the same wording again appends nothing.
- `source_checks.check_source`/`run_source_checks` gained two optional, keyword-only,
  default-`None` parameters (`terminal_facts`, `facts_provider`); `tooling.py::check_sources`
  passes the same `SqlTerminalRepository` instance already constructed there for
  `terminal_timezones`, and the same `FirecrawlSourceProvider` instance for both the existing
  `SourceProvider` parameter and the new `TerminalFactProvider` parameter — one object
  structurally satisfies both small Protocols.
- Facts carry the same `observed_at` as the observation recorded in the same check (passed in by
  the caller, not re-read from the clock), a `Provenance` naming the terminal-page source and its
  current `policy_version_id`, and `provider_id="firecrawl"`. `source_time` on a fact is always
  `None`: the page states a fact, not an instant it was authored, and inventing a timestamp would
  violate the no-guess rule these contracts share throughout.
- **UI**: `apps/web/lib/presentation/adapters/terminals.ts::toFactRows` maps every displayable
  fact **the Stats grid does not already show by label** into a new `TerminalFactRowView`
  (`types.ts`): `counter_hours`/`parking` keep rendering only through the existing `factValue()`
  helper in the Stats grid ("Hours"/"Parking"), so `toFactRows` covers the rest — phone, email,
  the address note, USO information, an access note — each with its own value and its
  `observed_at` formatted the same way `EvidenceAge` already formats read times. Showing a kind
  in both places would put two "Hours" (or "Parking") labels with different content on one
  screen, which is confusing and was caught by a rendering test during this task
  (`apps/web/tests/screens/terminals.test.tsx`'s `getByText(stat.label)` check started failing
  once a same-labelled fact row existed) rather than by inspection. `TerminalDetailScreen` renders
  the new rows via a small `TerminalFacts` component in the Evidence tab, next to the existing
  `EvidenceRows`, each showing "Page says `<value>` · Read at `<timestamp>`" — the existing
  terminal-detail provenance pattern extended to every fact kind not already covered. No wording
  states or implies that hours, phone, parking or any other fact is guaranteed or current beyond
  what "Read at" already says.

## Acceptance criteria

- [x] Parser unit tests over synthetic fixtures for every fact kind found in the corpus survey
      (`counter_hours`, `phone`, `email`, `passenger_terminal_note`, `uso_availability`,
      `parking`, `access_note`), covering: the kind absent from a page, an ambiguous/malformed
      value (empty label, unparseable email token), a length bound, and no invented value.
- [x] A pipeline test proving facts are appended only under PARSE **and** DISPLAY authorization,
      never for a restricted or schedule-artifact source, and deduplicated against the latest
      fact of the same kind.
- [x] An integration test proving a fact round-trips through `GET /api/v1/terminals/{id}`.
- [x] A web test showing a fact rendered with its "Page says / Read at" provenance.
- [x] `make check` exits 0, and the drift guard (`schema_probe`/`make migrate-test`) passes.
- [x] `git diff --stat origin/main` touches only the new parser, the provider/pipeline call
      site, `ports/source_provider.py` and `CONTRACTS.md`, the terminals adapter/screen/types and
      their tests, other listed tests, and this task file.

## Required tests

```text
tests/unit/test_amc_terminal_facts.py
tests/unit/test_source_pipeline.py (record_terminal_facts cases)
tests/unit/test_firecrawl_provider.py (observe_facts cases)
tests/unit/test_source_checks.py (check_source/run_source_checks thread facts_provider/terminal_facts unchanged by default)
tests/unit/test_api_v1.py (facts round-trip assertion)
apps/web/tests/adapters.test.tsx (toFactRows / provenance rendering)
apps/web/tests/screens/terminals.test.tsx (fixture facts render, if touched)
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

## UI behaviour (screen tasks only)

See `docs/tasks/SCREEN_TASK_RULES.md` where the shared rules apply unchanged. No new loading,
empty or error state: a fact row simply does not render when a kind is absent (`factValue`
already renders "Not published" in the Stats grid for `counter_hours`/`parking`; the new Evidence
rows are omitted per-kind, not per-screen, so they add no new top-level state to the screen
model). No wording implies a fact is guaranteed or current beyond its own "Read at" timestamp.

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies. OPSEC review specifically for: no `private-fixtures/`
content or the live pages' own text ever committed; only structural findings above; the parser
touches only the four approved `*-terminal-page` sources and never a `*-72hr-schedule` source.

## Out of scope

- Not included: migrations (the `terminal_facts` table and its CHECK constraints already exist
  from migration 0002).
- Not included: the trip page (TASK-044), the web auth routes (TASK-046), compose/deploy/CI
  (TASK-045/047), entrance coordinates, geocoding.
- Do not refactor: `amc_page_time.py`, the read/API layer (`read_services.py`,
  `read_models.py`), or any other adapter.
- Do not touch `*-72hr-schedule` sources or their policy.

## Blocked / contract change needed

`None`. The `SourceProvider` port itself is unchanged; a new, additive `TerminalFactProvider`
Protocol and two optional keyword-only parameters on `source_checks.py` are documented above and
in `docs/architecture/CONTRACTS.md`.

## Handoff

Fill this in before review/done.

**Branch:** `foundation/TASK-048-terminal-facts`

**Commit:** `f77ba2d` (rebased onto `main` at `34a613b`, before this Handoff update)

**Files changed:** see "Owned paths" above; `git diff --stat origin/main` touches exactly those
20 files (parser + test, provider/pipeline/ports + tests, tooling.py wiring, CONTRACTS.md, the
terminals adapter/screen/types/component + tests, and this task file).

**Interfaces added/changed:** see "Interfaces produced" above —
`application/parsers/amc_terminal_facts.py` (new), `TerminalFactProvider` (new, additive
Protocol), `FirecrawlSourceProvider.observe_facts` (new method),
`source_pipeline.record_terminal_facts` (new), `source_checks.check_source`/`run_source_checks`
(two new optional keyword-only parameters, default `None`), `TerminalFactRowView` (new web type),
`toFactRows` (new adapter function), `TerminalFacts` (new web component).

**Migrations:** None. The `terminal_facts` table and its CHECK constraints already exist from
migration 0002; `make migrate-test`'s CHECK-parity probe passes unchanged.

**Verification run** (this worktree, after the final rebase onto `main`):

```text
make setup          -> PASS
make check          -> PASS (format-check, lint, typecheck, test-unit [316 python + 358 web],
                        test-integration [40], build, migrate, migrate-check, compose-check)
make migrate-test   -> PASS (empty-db baseline, drift detection, idempotent seed, 24 CHECK
                        rules, roundtrip)
```

Also verified directly against the four real, public, unclassified AMC terminal pages (fetched
read-only, in-process, never committed) to sanity-check the parser beyond the synthetic
fixtures: every kind in the corpus-findings table above was produced, all within
`MAX_FACT_LENGTH`.

**Known limitations / risks:**

- The real TASK-031 corpus (`private-fixtures/`) exists only on the deployment host, not in any
  development checkout; this task's corpus survey used a fresh, read-only, in-process fetch of
  the same four approved pages instead (see "Corpus findings" above), never storing or
  committing a page body. A reviewer who wants to cross-check against the actual captured corpus
  will need host/VPS access (`docs/DEPLOYMENT.md` "Capturing parser corpus pages").
- The parser's per-kind extraction rules are keyed to the shared AFPIMS/DNN template's own
  labels (e.g. "Service Counter", "Hours of operation:", "USO Information"). If AMC ever changes
  that template's wording or structure, a kind may silently start yielding nothing again until a
  new parser version is written — the same class of risk `amc_page_time.py` already carries for
  its stamp.
- `record_terminal_facts`'s own failures (provider identity mismatch, a scripted `Failure` from
  the facts provider) are deliberately swallowed by `check_source` so they never change a
  `SourceCheckOutcome`; nothing currently surfaces a facts-recording failure to an operator the
  way `source-report`/the reliability report does for observations. Acceptable for this task
  (facts are additional telemetry, not the check's own result) but worth revisiting if silent
  facts-recording failures ever need their own alerting.

**Next dependency:**
