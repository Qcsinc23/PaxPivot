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
| application/ports/source_provider.py | SourceProvider.observe(source: SourceIdentity) -> Result[SourceObservation], async; metadata only, no raw source payload |
| application/ports/auth.py | Principal(user_id), Authenticator.authenticate(credential: str or None) -> Result[Principal], async |
| infrastructure/auth.py | DenyAllAuthenticator: every credential produces unauthorized Failure |
| infrastructure/audit.py | audit_event(logger,event,correlation_id): static event/correlation metadata only |
| infrastructure/database.py | metadata: SQLAlchemy naming conventions, no product tables yet |
| api.py | HealthResponse and GET /health -> {"status":"ok"}, liveness only |

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

The initial downstream tasks add functions with signatures fixed in their task contracts,
not new shared ports/schema. No web domain copy, API registration or migration is authorized.

Web presentation contracts (view models, source-state lexicon, navigation) are documented in
`docs/architecture/UI_FOUNDATION.md` and decided in ADR-003; they are foundation-owned too.
