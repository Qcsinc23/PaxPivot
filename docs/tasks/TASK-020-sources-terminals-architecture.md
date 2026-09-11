# TASK-020 — Sources + Terminals production architecture (first vertical slice)

## Status

`review` — recovered and remediated in this PR; **not yet merged**. The independent
architecture/OPSEC review found defects that are fixed here, plus five residual items that need a
foundation/product decision this agent is not authorised to make. See "Recovery + review record".

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

**Verification run:** after the final remediation change, in this worktree (own Compose project):

```text
make format-check   -> PASS   make build          -> PASS
make lint           -> PASS   make migrate        -> PASS
make typecheck      -> PASS   make migrate-check  -> PASS
make test-unit      -> PASS   make compose-check  -> PASS
make test-integration -> PASS make migrate-test   -> PASS
make test           -> PASS
```

Counts: pytest 184 unit + 8 integration; Vitest 18 files / 278 tests; mypy clean on 39 files.
An independent fresh-database probe (24 checks) also passes: seed inserts-then-idempotent,
append-only triggers reject UPDATE and DELETE **on rows that exist**, unknown `source_time`
stays NULL, latest is the newest by `observed_at`, no raw-body/credential column, no read model
exposes `payload_ref`/`content_hash`, and every `/api/v1` route carries `require_principal`.

**Known limitations / risks:** shared-token auth is interim; seeded terminal names/installations
and the directory URL are `needs_review` until confirmed; a terminal's headline evidence is
"newest observation across its sources" (documented in ADR-004); coordinates are plain columns
until a spatial query needs PostGIS.

## Recovery + review record

**Recovery.** The work was found intact as a committed local branch
(`foundation/TASK-020-sources-terminals` @ `71df38e`) in the `PaxPivot-foundation` worktree, based
directly on `main` @ `0601c28`. The worktree was clean, there were no stashes, and nothing had to
be reconstructed. A backup ref (`backup/TASK-020-recovered-71df38e`) preserves the original commit.

**Independent review.** Three fresh read-only passes were run over `71df38e` (specification,
architecture, security/OPSEC). The headline finding was **reproduced independently here**: a
MODE-scope kill switch did not stop its mode.

```text
MODE=parse engaged     -> ok=True stored=1 extraction=exact_text   (bypass)
MODE=store_raw engaged -> ok=True stored=1 payload_ref=blob://…    (bypass)
MODE='Parse' (typo)    -> ok=True stored=1                          (fails OPEN)
```

That defeats this task's own acceptance criterion "kill switch per source/adapter/mode".

**Fixed in this PR** (each with a regression test; the fix was reverted to prove each test fails):

| Finding | Fix |
| --- | --- |
| Mode kill switches bypassed (Critical) | `validate_against_policy` now authorises PARSE/STORE_RAW through `authorize_processing`, so the gate — not just the policy — decides |
| Kill-switch key typo failed open (Important) | `KillSwitch.key_matches_scope`: mode keys must be a `ProcessingMode`; source keys a canonical UUID |
| Credentialed URLs persisted + served (Critical) | Rejected in `validate_against_policy` and by a `url_carries_no_credentials` CHECK on `sources`, `source_observations`, `terminal_facts`, `terminals` |
| Facts shown without a display gate (Critical) | `displayable_facts` withholds facts whose producing source does not currently `allows(DISPLAY)`; fails closed |
| Non-ASCII credential returned 500 (Important) | `BearerTokenAuthenticator` compares UTF-8 bytes, so it denies (401 + audit) instead of raising |
| `raw_payload=denied` still allowed a content hash (Important) | Rejected unless the policy keeps hashes (`hash_only`/`snapshot`) |
| Failed/never-checked terminal said "No opportunities are published" (Important) | `opportunitiesNote` is now model-supplied and derived from the decided evidence |
| Non-deterministic "latest"/"current fact" (Important) | Added `observation_id` / `fact_id` tiebreakers (`recorded_at` is Postgres transaction time, so ties are real) |
| Unknown source state rewritten to `source_missing` (Critical) | Adapter passes the code through; `SourceStateBadge` renders "Unknown state" |
| Ports omitted the write methods (Important) | `append_fact` / `engage` added to the protocols; fakes implement them |

**Residual items needing a decision (NOT fixed here — out of this agent's authority).**

1. **Provider identity.** The ADAPTER-scope switch keys on the registry's `adapter_id`, but
   `record_observation` accepts any `SourceProvider` and never checks it against the registry.
   Closing this needs a declared identity on the `SourceProvider` port (a pre-existing shared
   contract). No provider is wired yet, so it is latent.
2. **Read isolation.** `get_terminal_detail`/`list_terminal_network` issue two statements per
   request at READ COMMITTED, so a concurrent write between them can read as "never observed".
   Needs a transaction-strategy decision (REPEATABLE READ per request vs one joined statement).
3. **Write transaction seam.** `get_connection` neither commits nor rolls back. Harmless while
   every route is read-only; TASK-024 must add an explicit write seam before wiring
   `record_observation` behind the API.
4. **`may_summarize` / `may_aggregate_history` are declared but unconsulted.** `counts` /
   `never_observed` are current-state operational telemetry, not historical movement aggregation.
   Either state that explicitly or gate them — a source-policy decision.
5. **Supersession precedence.** `supersedes_observation_id` is stored and mapped but no query
   reads it, so a withdrawal carrying an older `observed_at` does not displace the claim it
   withdraws. This task's criterion only requires the field to be present; honouring it in the
   current-state query is a domain-semantics decision.

Also noted for the foundation: `make migrate-test` proves table/column/index drift but **not
CHECK-constraint drift**, and every enum list is hand-duplicated between
`infrastructure/database.py` and migration `0002`. A parity gate would close that.

**Next dependency:** unchanged (TASK-021/022/024 ready; TASK-023/025 need product-owner input) —
but TASK-020 should be settled (merged, or the five decisions recorded) before dependent build
tasks branch from it.

**Next dependency:** TASK-021 and TASK-022 (build, immediately ready); TASK-024 (build, ready);
TASK-023 and TASK-025 need product-owner input (see their Blocked sections).
