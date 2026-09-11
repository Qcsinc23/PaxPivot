# ADR-004 — Sources + Terminals: persistence, processing policy and the first read slice

## Status

Accepted — foundation-agent decision under TASK-020; 2026-09-10. Extended 2026-09-11 with the
provider-identity contract, the write/read transaction boundaries, and the two resolved policy
questions (below); those additions change no table, migration or wire contract.

## Context

Every live route rendered an honest empty state because no application data existed. The
production PRD (§9, §15, §17; milestone B) and the pilot baseline (SRC-002/003/004/007/008,
§16.2) require a source registry with an audited processing register, immutable observations,
a terminal registry with verified entrances, a kill switch, and an operations view — before any
routing. This ADR establishes that slice end to end (PostgreSQL → repositories → read services →
read API → presentation adapters → the existing Terminals and Advanced screens) so the build
agent can wire live data behind stable contracts, and defines where retrieval adapters attach.

## Decision

**Domain (`paxpivot.domain`)** reuses `SourceIdentity`, `Provenance`, `SourceObservation`,
`SourceState`, `Terminal`, `VerifiedEntrance` unchanged in meaning and adds:
`Source` (registry row; no secrets, no content), `SourceProcessingPolicy` (deterministic
`allows(mode)`), `PolicyReviewState` (`approved | needs_review | paused | restricted`),
`RawPayloadPolicy` (`denied | hash_only | snapshot`), `ProcessingMode`, `KillSwitch`
(`source | adapter | mode` scope, engaged until released; never deleted), `TerminalOperationalFact`
(`TerminalFactKind`; own provenance; validity window), and two optional observation fields,
`payload_ref` and `supersedes_observation_id`. `Terminal.installation` is optional context.

**Policy semantics.** Public accessibility is not permission. `needs_review` (the default)
permits `retrieve` only when `may_retrieve` is set — page/link/timestamp/hash/health monitoring
per pilot §16.2 — and nothing else; `paused` and `restricted` permit nothing; `approved` follows
its flags, and `store_raw` is allowed only with `raw_payload = snapshot` plus a retention term.
Approval requires a reviewer and a review time. `authorize_processing(source, mode, switches)` in
`application/source_gate.py` is the single gate: kill switch → `enabled` → policy, with static
message keys. No provider, parser, job or endpoint may bypass it.

**Raw payload strategy.** The database never stores a source body. `hash_only` keeps a content
hash for change detection; `snapshot` allows an out-of-database store *by reference*
(`payload_ref`) for `snapshot_retention_days`; `denied` keeps neither. Read models never expose
`payload_ref` or `content_hash`. Redaction is therefore structural (nothing to redact in the
DB); the snapshot store itself is a later foundation task and may only be added behind this
policy. The application works fully with metadata/extracted facts alone.

**Persistence (`infrastructure/database.py`, migration `0002_sources_terminals`).** SQLAlchemy
Core tables on the existing `metadata`, no ORM classes: `terminals`, `sources`,
`source_observations`, `terminal_facts`, `processing_switches`. UUID identities; timezone-aware
timestamps; CHECK constraints pin every enumerated value (all 13 `SourceState`s, review states,
raw-payload policy, fact kinds, switch scopes) and the domain invariants (positive states
require successful retrieval, payload requires retrieval, reasons present, snapshot ↔ retention,
approval ↔ reviewer, entrance columns all-or-nothing, base coordinates as a pair); referential
integrity via foreign keys (the two `terminals → sources` provenance keys use `use_alter`).
Provenance is stored inline as observed (source URL/authority at that time) beside the source
key. `source_observations` and `terminal_facts` are **append-only by database trigger**
(`paxpivot_append_only()` rejects UPDATE/DELETE), so history cannot be rewritten from any code
path. Current-state reads use `(source_id, observed_at)` and `(terminal_id, kind, recorded_at)`
indexes. Coordinates are plain double columns for now: the slice needs no spatial query, and a
PostGIS geography column can be added by a later migration without changing the contracts.

**Repositories (`application/ports/repositories.py`, `infrastructure/repositories.py`).**
Synchronous protocols per use case (`SourceRepository`, `SourceObservationRepository`,
`TerminalRepository`, `KillSwitchRepository`) implemented over one `Connection`; the only write
on observations is `append`. Sync is deliberate: the API composes them per request under
FastAPI's threadpool, and there is no async driver dependency.

**Read services and API.** `application/read_services.py` (`list_terminal_network`,
`get_terminal_detail`, `list_source_health`) returns `application/read_models.py` records that
are also the wire contracts of `GET /api/v1/terminals`, `GET /api/v1/terminals/{id}` and
`GET /api/v1/sources/health`. Rules encoded there only: a terminal's headline evidence is the
newest observation across its registered sources; a never-observed source or terminal is
`latest: null`, never a state; the entrance is exposed only when verified; base coordinates are
never exposed; kill switches are a flag and change no observation. Every `/api/v1` route
requires a principal from the `Authenticator` port.

**Interim authentication.** `BearerTokenAuthenticator` compares one server-side token
(`PAXPIVOT_API_TOKEN`, ≥ 32 characters, constant-time) and yields a single local principal;
unset → `DenyAllAuthenticator`. This is the minimum "auth composition" ADR-001 requires for a
private endpoint and is explicitly *not* the per-user authorization the PRD requires; that is a
later foundation gate (see Consequences). The web app reads the API only from server components
(`apps/web/lib/api/client.ts`, refuses to run in a browser), so the token never ships to clients.

**Presentation adapters (`apps/web/lib/presentation/adapters/*`)** are the final seam: they map
`lib/api/contracts.ts` payloads to the existing screen models, formatting ages/timestamps/cadence
and mapping verified entrances to markers. They may not decide eligibility or ranking,
reinterpret a `SourceState`, turn unknown into zero, infer absence or infer coordinates. A
never-observed source renders "Not checked yet" (`SourceStateBadge` with no evidence). The JSON
examples under `apps/web/lib/api/examples/` are generated from the Python read models and
asserted by both test suites, so contract drift fails CI.

**Provider attach point.** `application/source_pipeline.record_observation(source, provider,
observations, switches)`: `authorize_processing(RETRIEVE)` → provider identity vs the registry's
`adapter_id` → `SourceProvider.observe` → validation (registered identity, current policy version,
the observation's own `provider_id` matching the adapter that ran, no payload reference unless
`store_raw` is allowed, no interpreted extraction unless `parse` is allowed) → `append`. A
Firecrawl-backed or any other `SourceProvider` plugs in here and nowhere else; Firecrawl is
retrieval infrastructure, not product truth. Retrieval failure is stored as its failure state.

**Provider identity.** `SourceProvider` declares `provider_id`, and it must equal the source's
registered `adapter_id` before the adapter is invoked at all; an observation whose provenance
names a different adapter is refused after retrieval. Identity is checked before invocation so a
mismatch costs no retrieval and cannot be used to sidestep an ADAPTER-scope kill switch, which
keys on the configured `adapter_id`. A source with `adapter_id IS NULL` is inert: nothing is wired
to it, so nothing may observe it.

## Read and write seams (amended by TASK-026)

`infrastructure/database.transaction(engine)` is the explicit **write** seam: it opens a
transaction, commits on success and rolls back on failure, so a unit of work that raises partway
through leaves no partial observation or fact.

`infrastructure/database.read_snapshot(engine)` is the explicit **read** seam: one
`REPEATABLE READ` snapshot that is also `READ ONLY` at the database (`SET TRANSACTION READ
ONLY`, via SQLAlchemy's `postgresql_readonly`). Any INSERT/UPDATE/DELETE issued through it fails
with a database error whatever Python attempted it, and the block always ends in rollback, so
nothing can be committed from a read. GET routes and read services compose on this seam only,
and they are handed the *reader* ports (`SourceReader`, `ObservationReader`, `TerminalReader`,
`KillSwitchReader`), which carry no mutation method; the repository ports extend the readers with
their append-only writes for write units of work. The distinction is enforced twice — by the
type a read path can name and by the database — not by naming convention.

**Isolation.** Both seams use `REPEATABLE READ`, so every unit of work sees one snapshot. The
read use cases compose several statements per request (terminals, then their sources, then the
newest observations); under `READ COMMITTED` a concurrent append landing between them is visible
to the later statement but not the earlier one, which is how a source with an observation can read
as "never observed". `SERIALIZABLE` was rejected as disproportionate: it would require retry
handling on read paths that never write.

## Two resolved policy questions

**`may_summarize` / `may_aggregate_history`.** Both are declared and consulted by
`SourceProcessingPolicy.allows`, and both are **inert in this slice**: nothing summarizes a source,
and `counts` / `never_observed` in the source-health read model are current-state operational
telemetry derived from the same latest-per-source view as every other row — one entry per source —
not aggregation over observation history. Stating this explicitly is the decision; the alternative
(gating the counts behind `may_aggregate_history`) would be wrong, because the counts stay correct
and source-independent even when history aggregation is forbidden. `test_source_policy` pins it by
proving both flags change no read model.

**Supersession precedence (amended by TASK-026).** `supersedes_observation_id` is an explicit
semantic statement: the observation that carries it retires the observation it names, whatever
either row's timestamps say. Currentness is therefore decided in two steps, and the SQL does
exactly this: (1) drop every observation named by another observation's
`supersedes_observation_id` — the leaves remain; (2) rank the leaves by `observed_at`, then
`recorded_at`, then `observation_id`, newest first. So `A ← B` makes B current even when B carries
an older `observed_at` than A (a withdrawal recorded with the source's earlier timestamp still
retires the claim), a chain `A ← B ← C` leaves only C, and an unrelated newer observation stays
eligible and wins on time among the leaves. Migration 0003 makes the reference sound at the
database: a composite foreign key `(supersedes_observation_id, source_id) → (observation_id,
source_id)` means a superseder must name an **existing observation of the same source**, and a
CHECK forbids naming itself. Rows are append-only and `append` inserts one row per statement, so
from the application a superseder can only name a row that already exists and a cycle is
unreachable — no graph machinery is needed. (A hand-written multi-row INSERT could still build a
two-cycle because foreign keys are checked per statement; that path does not exist in the code.) Superseded rows
stay in `list_for_source`: history is never hidden, only currentness is decided.

**Reference data.** `infrastructure/bootstrap.seed_reference_data` inserts four public AMC
passenger terminals (names, installations, `America/New_York`; `operational_state = unknown`;
no coordinates, no entrance, no facts) and one official directory source, all `needs_review`
and disabled, keyed by UUID5 so seeding is idempotent (`make seed`; `make migrate-test` proves
the second run inserts nothing). No observation is seeded, so nothing seeded is ever fresh.

## Alternatives considered

An ORM mapping layer would duplicate the domain contracts; Core tables plus explicit row mappers
keep one authoritative model. Storing raw bodies in JSONB would make retention and redaction a
database problem the policy forbids by default. A generic feature-flag service is heavier than a
three-scope switch table with history. A separate DTO layer between read models and the API
would be a copy of the same fields; versioning by path (`/api/v1`) suffices. PostGIS geography
now would force a geoalchemy2 dependency for drift checks with no query to serve. Async
repositories would add asyncpg for no current benefit. Making the endpoints public would violate
ADR-001 and pilot §16.1; a per-user auth model is out of this slice's scope.

## Consequences

Terminals and Advanced can render live registry data once the build tasks wire the pages
(TASK-021/022). Plan/Results/Route Detail stay on honest empty states; no route engine,
opportunity builder, Firecrawl crawl, notification or AI code exists. Enabling any real source
requires a human review that sets `approved`, a reviewer and a policy version — the code cannot
do it. Two decisions need the product owner: the per-user authentication model that replaces
the shared token before any non-local deployment, and confirmation of the seeded terminal set
and directory URL (marked `needs_review` until then). Spatial queries and raw-snapshot storage
are deferred behind explicit later migrations/tasks.

## Contract impact

See `docs/architecture/CONTRACTS.md` (rows marked ADR-004) and `docs/architecture/UI_FOUNDATION.md`
("Presentation adapters"). New: `domain/source.py` registry/policy/switch types;
`domain/terminal.py::TerminalOperationalFact`; `application/{source_gate,source_pipeline,read_models,read_services}.py`;
`application/ports/repositories.py`; `infrastructure/{database,repositories,bootstrap,auth}.py`;
`api.py` `/api/v1` routes; migration `0002_sources_terminals`; `apps/web/lib/api/{contracts,client}.ts`;
`apps/web/lib/presentation/adapters/*`; optional `evidence` on `TerminalCardView`,
`SourceHealthRowView`, `NearbyTerminalView`; optional terminal-detail actions.

Additive in the completion pass: `SourceProvider.provider_id` (required attribute on the existing
port — an implementation must now declare which adapter it is); message keys
`source_provider.identity_mismatch` and `source.observation_provider_mismatch`;
`infrastructure/database.transaction(engine)` and `repositories(engine)`. No table, column,
migration or wire-contract change: `/api/v1` responses are byte-identical, and the
`supersedes_observation_id` field keeps the shape it already had.

## Migration / rollout

`make migrate` applies 0002; `make seed` inserts reference data idempotently; `make migrate-test`
proves fresh-database upgrade, drift detection, idempotent seed, downgrade to base and
re-upgrade. Existing checkouts need only `make migrate`.

## Verification

`tests/unit/test_source_policy.py`, `test_read_services.py`, `test_api_v1.py`,
`test_source_pipeline.py`; `tests/integration/test_sources_terminals_db.py` (seed idempotence,
append-only trigger, unknown source time, failed retrieval, latest-per-source, current facts,
kill switch, supersession precedence, write-transaction commit/rollback, API over the real
composition root); `apps/web/tests/adapters.test.tsx`, `api-client.test.ts`; `make check` and
`make migrate-test` in CI.

## Amendments

- **2026-09-11, TASK-026.** Read seam made read-only at the database (`read_snapshot`), reader
  ports introduced, explicit supersession now decides currentness before temporal ranking
  (migration 0003: same-source composite foreign key, not-self CHECK), CHECK-constraint parity
  probe (`infrastructure/schema_probe.py`) run by `make migrate-test`, and `SourceCheckRun.started_at`
  is an `AwareDatetime`. The sections above were rewritten to match the SQL.
