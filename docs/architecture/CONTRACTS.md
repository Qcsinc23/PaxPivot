# Foundation contracts

Paths below are relative to `apps/api/paxpivot` unless they start with `migrations/`. Shared
modules are foundation-owned. Domain records are frozen Pydantic models, reject extra fields, use
explicit null for unknown values and timezone-aware timestamps. They are not database ORM models.

| Path | Symbols / contract |
| --- | --- |
| domain/source.py | SourceState: 13 states from production PRD §9.4; SourceIdentity: UUID, URL, authority |
| domain/source.py | Provenance: source identity, observed_at, explicit nullable source_time, provider_id, processing policy_version_id |
| domain/source.py | SourceObservation: UUID, provenance, state, retrieval/extraction state, explicit nullable parser/hash, confidence reasons |
| domain/source.py | POSITIVE_STATES (fresh, no_departures_published, no_compatible_opportunity): require successful retrieval, and are the only states that go stale (TASK-041) |
| domain/source.py (ADR-004) | Source (registry row, no secrets), SourceKind, SourceProcessingPolicy.allows(mode), PolicyReviewState, RawPayloadPolicy, ProcessingMode, KillSwitch/KillSwitchScope; SourceObservation.payload_ref and supersedes_observation_id (optional) |
| domain/terminal.py | Coordinates; VerifiedEntrance: typed terminal/visitor-center/gate point with provenance/instructions; Terminal: UUID, IANA timezone, operational evidence/state, nullable entrance and separate base_coordinates |
| domain/terminal.py (ADR-004) | Terminal.installation (optional); TerminalOperationalFact, TerminalFactKind, FactText |
| domain/trip.py (TASK-034) | NewTripRequest: origin_terminal_id, destination_text, window_start < window_end within MAX_WINDOW (30 days), party_size 1–9; TripRequest adds trip_id, created_at |
| domain/eligibility.py | TravelerFacts: pseudonymous ID, sponsor/dependent role, normalized traveler_class and category attestation, age band, sponsor reference and accompaniment; PartyFacts validates unique IDs and dependent sponsor references |
| domain/eligibility.py | EligibilityDecision: eligible/ineligible/unknown/outside_supported_scope, mandatory controlling policy ID/version/citations/reasons and unresolved conditions (contract only; no engine produces one yet) |
| application/result.py | Success[T](ok=True,value), Failure(ok=False,error), Result[T] discriminated by ok; ApplicationError with static message_key, code and retryability |
| application/ports/source_provider.py | SourceProvider.provider_id: str — the adapter's own identity, which must equal the source's registered adapter_id before the provider is invoked at all; SourceProvider.observe(source: SourceIdentity) -> Result[SourceObservation], async; metadata only, no raw source payload |
| application/ports/auth.py | Principal(user_id), Authenticator.authenticate(credential: str or None) -> Result[Principal], async |
| application/ports/repositories.py | Reader ports SourceReader, ObservationReader (latest_per_source, list_for_source), TerminalReader, KillSwitchReader, TripReader (no mutation methods; what read services and GET routes receive); repository ports extend them with append-only writes (TripRepository.add) — sync protocols |
| application/source_gate.py | authorize_processing(source, mode, switches) -> Result[ProcessingAuthorization]; engaged_switch |
| application/source_pipeline.py | record_observation(source, provider, observations, switches) -> Result[SourceObservation], async; the provider attach point |
| application/source_checks.py | run_source_checks(sources, observations, switches, provider, now=) -> SourceCheckRun (recorded/skipped/rejected/provider failures; started_at is an AwareDatetime and a naive `now` is rejected); exit_code(run) -> 0, 2 (no provider configured) or 3 (provider failure) |
| application/source_explanation.py | explain_source(observation) -> deterministic, metadata-only wording for every SourceState |
| application/terminal_entrance.py | select_entrance(terminal) -> Result[VerifiedEntrance] |
| application/parsers/amc_page_time.py (TASK-038) | parse_page_time(document) -> PageTime or None; PARSER_VERSION `amc-page-time-v1`; reads only the page's own "current as of" stamp |
| application/corpus.py (TASK-031) | capture_corpus(source, provider, switches, directory) -> Result[CorpusCapture], async; writes files for human labeling, records nothing |
| application/read_models.py | SourceEvidenceRead, TerminalSummaryRead, TerminalDetailRead, TerminalNetworkRead, SourceHealthRead (+rows/counts): the /api/v1 wire contracts; no payload refs or hashes |
| application/read_services.py | list_terminal_network, get_terminal_detail -> Result, list_source_health; FRESHNESS_WINDOW (6 h 30 min, SRC-008) and effective(observation, now) (TASK-041) |
| application/trip_service.py (TASK-034) | create_trip_request, list_trip_requests, get_trip_request; TripRead, TripListRead |
| application/source_reliability.py (TASK-042) | report_scope(sources, switches) -> measured sources plus (source, message_key) for every source `authorize_processing(RETRIEVE)` refuses; reliability(observations, cadence_minutes, start, now) -> SourceReliability (hashed says whether change detection was measurable); Verdict pass / watch / stop / unknown |
| infrastructure/auth.py | BearerTokenAuthenticator (PAXPIVOT_API_TOKEN, server-only), authenticator_from_env, LOCAL_PRINCIPAL_ID; DenyAllAuthenticator (every credential unauthorized) is the fallback when no token is configured |
| infrastructure/audit.py | audit_event(logger,event,correlation_id): static event/correlation metadata only |
| infrastructure/database.py | metadata + Core tables terminals, sources, source_observations, terminal_facts, processing_switches (ADR-004) and trip_requests (TASK-034); engine_from_env; transaction(engine)/repositories(engine): the explicit commit-on-success, rollback-on-failure unit of work at REPEATABLE READ; read_snapshot(engine) for read-only use |
| infrastructure/repositories.py | SqlSourceRepository, SqlSourceObservationRepository, SqlTerminalRepository, SqlKillSwitchRepository, SqlTripRepository over one Connection; row <-> domain mappers |
| infrastructure/bootstrap.py | seed_reference_data(engine) idempotent; REFERENCE_TERMINALS (four AMC terminals); DIRECTORY_SOURCE (needs_review, disabled); TERMINAL_PAGE_SOURCES (approved, enabled, Firecrawl adapter, 6-hour cadence, metadata and page stamp only); SCHEDULE_ARTIFACT_SOURCES (restricted, never fetched) |
| infrastructure/providers/firecrawl.py (TASK-025/037/038) | FirecrawlSourceProvider (provider_id `firecrawl`, from_env): one metadata-only retrieval per authorized source — page status, content hash and the page's own time; the retrieved document is discarded in-process; discover_artifact |
| infrastructure/schema_probe.py | verify_check_parity(connection) -> ParityReport: every domain enum member inserts, invented values and invariant counter-examples are refused by the named CHECK; run by make migrate-test |
| api.py | GET /health -> {"status":"ok"}, liveness only; GET /ready -> 200 only when the database answers at migration head, else 503 {"status":"unavailable"} |
| api.py (ADR-004, TASK-034) | GET /api/v1/terminals, /api/v1/terminals/{terminal_id}, /api/v1/sources/health, GET and POST /api/v1/trips, GET /api/v1/trips/{trip_id}; every /api/v1 route behind require_principal; get_repositories/get_engine/get_authenticator are the overridable seams |
| tooling.py | operator CLI behind the Makefile: setup-env, migrate, migrate-check, migrate-test, seed, check-sources (exit 0/2/3), capture-corpus, source-report (exit 0, 1 when a source must stop, 2 with no observations), cold-start-check, dev |
| migrations/versions/0002_sources_terminals.py | tables above, CHECK constraints for every enum, append-only trigger on observations and facts |
| migrations/versions/0003_supersession_integrity.py | supersedes_observation_id must name an existing observation of the same source (composite FK) and never itself (CHECK) |
| migrations/versions/0004_trip_requests.py | trip_requests table (TASK-034) |
| migrations/versions/0005_restricted_allows_nothing.py | CHECK: a restricted source allows no processing and retains nothing (TASK-037) |

A SourceObservation is not a ScheduleObservation or an opportunity. Its `fresh` state may
refer to source metadata only; no automatic movement claim follows. Successful retrieval
is mandatory for fresh/absence states; absence also requires successful interpretation
with parser identity. These structural checks do not replace source approval or the parser
accuracy gate. SourceState enum membership is not a transition engine.

Every processing step goes through `authorize_processing`. The live adapter is
`FirecrawlSourceProvider` (TASK-025), approved for the four AMC terminal pages: page status,
content hash and the page's own "current as of" stamp, run every 6 hours from host cron. The
72-hour schedule artifacts are registered `restricted_user_open_only` and are never fetched,
parsed, hashed or displayed (TASK-037). Failure retrieval produces an explicit source-state
observation; configuration/auth errors use Failure. Message keys are static catalog keys; never
put provider exception text or input values into them.

Effective source state (TASK-041): every evidence read reports `state` as it stands at the read's
`generated_at`. A positive observation older than `FRESHNESS_WINDOW` reads `source_stale` with the
stale explanation. Stored observations never change, and the web renders the state it receives
without deriving one.

Terminal base_coordinates are for identity context only. They never establish an entrance.
A null entrance preserves uncertainty. Coordinates and provenance cannot prove real-world
verification alone; verification remains a separately controlled registry process.

Traveler facts contain no legal conclusion, credentials, medical evidence or birth dates.
The versioned eligibility engine (TASK-035, blocked) will determine what supported
traveler_class values mean; no eligibility rules exist yet. A trip request's party size is what
the traveler submitted; nothing derives seats from it.

Downstream tasks add functions with signatures fixed in their task contracts, not new shared
ports/schema. Only foundation tasks add migrations or `/api/v1` routes.

Source processing (ADR-004): a source is processed only through `authorize_processing`; the
default review state allows metadata retrieval at most; raw bodies never enter the database;
observations and terminal facts are append-only at the database level; a never-observed
source is `latest = None`, not a state; read models never expose payload references or hashes.

Web presentation contracts (view models, source-state lexicon, navigation) are documented in
`docs/architecture/UI_FOUNDATION.md` and decided in ADR-003; they are foundation-owned too. The
pilot sign-in (a signed `HttpOnly` session cookie and the server-only bearer) lives in
`apps/web/lib/auth/` and is decided in ADR-005.
