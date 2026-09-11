# TASK-020 — Sources + Terminals production architecture (first vertical slice)

## Status

`review` — this PR; becomes `done` once merged (see Handoff).

## Assigned role

`foundation`

## Goal

Establish the first production data path — PostgreSQL → repositories → read services → read API →
presentation adapters → the existing Terminals and Advanced screens — with the source-processing
policy, kill switch, immutable observations, terminal registry and bootstrap strategy the PRD
requires, proven by reference implementation and tests, so bounded build tasks can wire live data.

## Why this task exists

Production PRD §9 (ingestion pipeline, immutable observations, 13 states), §15 (Source,
SourceProcessingPolicy, SourceObservation, Terminal, TerminalEntrance, TerminalOperationalFact),
§17 (audited source-processing permissions, kill switch), milestone B; pilot SRC-002/003/004/007/008
and §16.2. Decision record: ADR-004.

## Dependencies

- Required merged tasks: `TASK-018`, `TASK-019`.
- ADR: `ADR-004` (this PR).

## Owned paths

```text
apps/api/paxpivot/domain/{source,terminal}.py
apps/api/paxpivot/application/{source_gate,source_pipeline,read_models,read_services}.py
apps/api/paxpivot/application/ports/repositories.py
apps/api/paxpivot/infrastructure/{database,repositories,bootstrap,auth}.py
apps/api/paxpivot/api.py
apps/api/paxpivot/tooling.py                     temporary_database, seed, migrate-test seed check
apps/api/migrations/versions/0002_sources_terminals.py
Makefile                                          seed target
tests/unit/{support_sources,test_source_policy,test_read_services,test_api_v1,test_source_pipeline}.py
tests/integration/test_sources_terminals_db.py
apps/web/lib/api/{contracts,client}.ts, apps/web/lib/api/examples/*.json
apps/web/lib/presentation/adapters/{format,terminals,source-health}.ts
apps/web/lib/presentation/types.ts               TerminalCardView.evidence optional
apps/web/lib/presentation/screens/{terminals,advanced,plan}.ts   optional fields, "all" filter, restricted
apps/web/components/paxpivot/SourceStateBadge.tsx  "Not checked yet"
apps/web/components/screens/{terminals,advanced}/*  optional actions, "all" filter, kill-switch mark
apps/web/tests/{adapters.test.tsx,api-client.test.ts}
docs/decisions/ADR-004-sources-terminals-persistence.md
docs/architecture/{CONTRACTS,UI_FOUNDATION}.md
docs/tasks/TASK-019-*.md (status), TASK-020-*.md, TASK-021-*.md … TASK-025-*.md
```

## Interfaces consumed

```text
domain/source.py::SourceIdentity, Provenance, SourceObservation, SourceState
domain/terminal.py::Terminal, VerifiedEntrance, Coordinates
application/result.py::Result; application/ports/{source_provider,auth}.py
application/source_explanation.py::explain_source
apps/web/lib/presentation/screens/{terminals,advanced}.ts screen models
```

## Interfaces produced

See `docs/architecture/CONTRACTS.md` rows marked ADR-004 and `UI_FOUNDATION.md`
"Presentation adapters". Headline: `Source`, `SourceProcessingPolicy.allows`, `KillSwitch`,
`TerminalOperationalFact`; `authorize_processing`; `record_observation`; four repository ports and
their SQL implementations; read models = `/api/v1` wire contracts; three read routes behind
`require_principal`; `BearerTokenAuthenticator`; migration 0002; `seed_reference_data`;
`readApi`; `toTerminalNetworkScreenModel`, `toTerminalDetailScreenModel`,
`toSourceHealthScreenModel`.

## Acceptance criteria

- [x] Existing domain contracts reused, not duplicated; frozen Pydantic records only.
- [x] Policy model distinguishes retrieve/parse/store_raw/summarize/display/aggregate_history and
      approved/needs_review/paused/restricted; default allows metadata retrieval at most; checked
      by one gate before any processing; kill switch per source/adapter/mode without deleting history.
- [x] Observations append-only (database trigger), unknown source time preserved, retrieval
      failure stored as failure, supersession field present; no raw body in the DB; policy-denied
      payload references rejected before storage.
- [x] Terminal registry with explicit entrance verification (all-or-nothing columns), base
      coordinates never promoted, operational facts with provenance and validity.
- [x] Schema: UUID ids, FKs, tz timestamps, CHECKs for every enum, current-state indexes, single
      head; `make migrate-test` proves empty DB, drift, idempotent seed, downgrade/upgrade.
- [x] Read services deterministic; API exposes no DB models, payload refs or hashes; unknown /
      never-observed / failed distinctions preserved; every route requires a principal.
- [x] Adapters format only; never-observed renders "Not checked yet"; no coordinates invented;
      actions the app cannot honour are omitted; JSON examples asserted by both suites.
- [x] Live routes unchanged (still honest empty states); `/showcase/*` unchanged.
- [x] No route engine, Firecrawl crawl, notification, AI or eligibility code added.
- [x] Downstream tasks TASK-021…025 created with dependency order.

## Required tests

```text
tests/unit/test_source_policy.py        policy matrix, validators, gate order, switch scopes, no secret fields
tests/unit/test_read_services.py        entrance/evidence rules, never-observed, not-found, counts, kill flag
tests/unit/test_api_v1.py               401 on every route, deny-all default, 404/422, no payload refs, JSON examples
tests/unit/test_source_pipeline.py      failure stored, switch prevents provider call, validation rejections
tests/integration/test_sources_terminals_db.py  seed idempotence, append-only trigger, unknown time, facts, switch, API
apps/web/tests/adapters.test.tsx        formatting, markers only for verified entrances, Not checked yet, no absence wording
apps/web/tests/api-client.test.ts       four failure reasons; server-only guard
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
Also: `make migrate-test` (migration change) and `make seed` (idempotent).

## Review / merge rules

`docs/agent/MERGE_POLICY.md`; foundation review recorded in the PR.

## Out of scope

- Not included: live page wiring (TASK-021/022), additional registry data (TASK-023), a source
  check runner (TASK-024), any Firecrawl adapter (TASK-025), per-user auth, raw-snapshot store,
  PostGIS geography columns, schedule parsing, opportunities, routing, notifications, AI.

## Blocked / contract change needed

`None`. Two product-owner decisions are recorded in ADR-004 Consequences (auth model before
non-local deployment; confirmation of the seeded terminal set and directory URL).

## Handoff

**Branch:** `foundation/TASK-020-sources-terminals` from `main` @ `0601c28` (TASK-019 merge).

**Commit:** reported in the PR.

**Files changed:** the owned paths above.

**Interfaces added/changed:** see "Interfaces produced"; additive except `evidence` becoming
optional on `TerminalCardView`, `SourceHealthRowView`, `NearbyTerminalView` and the three
terminal-detail actions/`compareHref`/`evidence.age` becoming optional (screens handle both).

**Migrations:** `0002_sources_terminals` (single head after `0001_postgis`).

**Verification run:** recorded in the PR after the final change.

**Known limitations / risks:** shared-token auth is interim; seeded terminal names/installations
and the directory URL are `needs_review` until confirmed; a terminal's headline evidence is
"newest observation across its sources" (documented in ADR-004); coordinates are plain columns
until a spatial query needs PostGIS.

**Next dependency:** TASK-021 and TASK-022 (build, immediately ready); TASK-024 (build, ready);
TASK-023 and TASK-025 need product-owner input (see their Blocked sections).
