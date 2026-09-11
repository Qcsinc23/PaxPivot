# Foundation contracts

All paths below are relative to apps/api/paxpivot. Shared modules are foundation-owned.
Domain records are frozen Pydantic models, reject extra fields, use explicit null for
unknown values and timezone-aware timestamps. They are not database ORM models.

| Path | Symbols / contract |
| --- | --- |
| domain/source.py | SourceState: 13 states from production PRD §9.4; SourceIdentity: UUID, URL, authority |
| domain/source.py | Provenance: source identity, observed_at, explicit nullable source_time, provider_id, processing policy_version_id |
| domain/source.py | SourceObservation: UUID, provenance, state, retrieval/extraction state, explicit nullable parser/hash, confidence reasons |
| domain/terminal.py | Coordinates; VerifiedEntrance: typed terminal/visitor-center/gate point with provenance/instructions; Terminal: UUID, IANA timezone, operational evidence/state, nullable entrance and separate base_coordinates |
| domain/eligibility.py | TravelerFacts: pseudonymous ID, sponsor/dependent role, normalized traveler_class and category attestation, age band, sponsor reference and accompaniment; PartyFacts validates unique IDs and dependent sponsor references |
| domain/eligibility.py | EligibilityDecision: eligible/ineligible/unknown/outside_supported_scope, mandatory controlling policy ID/version/citations/reasons and unresolved conditions |
| application/result.py | Success[T](ok=True,value), Failure(ok=False,error), Result[T] discriminated by ok; ApplicationError with static message_key, code and retryability |
| application/ports/source_provider.py | SourceProvider.provider_id: str — the adapter's own identity, which must equal the source's registered adapter_id before the provider is invoked at all; SourceProvider.observe(source: SourceIdentity) -> Result[SourceObservation], async; metadata only, no raw source payload |
| application/ports/auth.py | Principal(user_id), Authenticator.authenticate(credential: str or None) -> Result[Principal], async |
| infrastructure/auth.py | DenyAllAuthenticator: every credential produces unauthorized Failure |
| infrastructure/audit.py | audit_event(logger,event,correlation_id): static event/correlation metadata only |
| infrastructure/database.py | metadata + Core tables terminals, sources, source_observations, terminal_facts, processing_switches (ADR-004); engine_from_env; transaction(engine)/repositories(engine): the explicit commit-on-success, rollback-on-failure unit of work at REPEATABLE READ, so one request reads one snapshot |
| api.py | HealthResponse and GET /health -> {"status":"ok"}, liveness only |
| domain/source.py (ADR-004) | Source (registry row, no secrets), SourceKind, SourceProcessingPolicy.allows(mode), PolicyReviewState, RawPayloadPolicy, ProcessingMode, KillSwitch/KillSwitchScope; SourceObservation.payload_ref and supersedes_observation_id (optional) |
| domain/terminal.py (ADR-004) | Terminal.installation (optional); TerminalOperationalFact, TerminalFactKind, FactText |
| application/source_gate.py | authorize_processing(source, mode, switches) -> Result[ProcessingAuthorization]; engaged_switch |
| application/source_pipeline.py | record_observation(source, provider, observations, switches) -> Result[SourceObservation], async; the provider attach point |
| application/ports/repositories.py | Reader ports SourceReader, ObservationReader, TerminalReader, KillSwitchReader (no mutation methods; what read services and GET routes receive); repository ports extend them with append-only writes — sync protocols |
| application/read_models.py | SourceEvidenceRead, TerminalSummaryRead, TerminalDetailRead, TerminalNetworkRead, SourceHealthRead (+rows/counts): the /api/v1 wire contracts; no payload refs or hashes |
| application/read_services.py | list_terminal_network, get_terminal_detail -> Result, list_source_health |
| infrastructure/repositories.py | Sql* implementations over one Connection; row <-> domain mappers |
| infrastructure/bootstrap.py | seed_reference_data(engine) idempotent; REFERENCE_TERMINALS, DIRECTORY_SOURCE (needs_review, disabled) |
| infrastructure/auth.py | BearerTokenAuthenticator (PAXPIVOT_API_TOKEN, interim), authenticator_from_env, LOCAL_PRINCIPAL_ID |
| api.py (ADR-004) | GET /api/v1/terminals, /api/v1/terminals/{id}, /api/v1/sources/health; every route behind require_principal; get_repositories/get_engine/get_authenticator are the overridable seams |
| migrations/versions/0002_sources_terminals.py | tables above, CHECK constraints for every enum, append-only trigger on observations and facts |
| migrations/versions/0003_supersession_integrity.py | supersedes_observation_id must name an existing observation of the same source (composite FK) and never itself (CHECK) |
| infrastructure/schema_probe.py | verify_check_parity(connection) -> ParityReport: every domain enum member inserts, invented values and invariant counter-examples are refused by the named CHECK; run by make migrate-test |
| application/source_checks.py | SourceCheckRun.started_at: AwareDatetime; run_source_checks rejects a naive `now` |

A SourceObservation is not a ScheduleObservation or an opportunity. Its `fresh` state may
refer to source metadata only; no automatic movement claim follows. Successful retrieval
is mandatory for fresh/absence states; absence also requires successful interpretation
with parser identity. These structural checks do not replace source freshness/approval
or the parser accuracy gate. SourceState enum membership is not a transition engine.

Caller supplies source-processing approval before invoking any eventual live adapter.
No approval registry or live adapter exists yet. Failure retrieval produces an explicit
source-state observation; configuration/auth errors use Failure. Message keys are static
catalog keys; never put provider exception text or input values into them.

Terminal base_coordinates are for identity context only. They never establish an entrance.
A null entrance preserves uncertainty. Coordinates and provenance cannot prove real-world
verification alone; verification remains a separately controlled registry process.

Traveler facts contain no legal conclusion, credentials, medical evidence or birth dates.
The versioned eligibility engine will determine what supported traveler_class values mean;
this task implements no eligibility rules or broad-category support. Party size is derived
from travelers. No independently mutable seat count can diverge from party size.

Downstream tasks add functions with signatures fixed in their task contracts, not new shared
ports/schema. Only foundation tasks add migrations or `/api/v1` routes.

Source processing (ADR-004): a source is processed only through `authorize_processing`; the
default review state allows metadata retrieval at most; raw bodies never enter the database;
observations and terminal facts are append-only at the database level; a never-observed
source is `latest = None`, not a state; read models never expose payload references or hashes.

Web presentation contracts (view models, source-state lexicon, navigation) are documented in
`docs/architecture/UI_FOUNDATION.md` and decided in ADR-003; they are foundation-owned too.
