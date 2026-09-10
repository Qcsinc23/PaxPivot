# PaxPivot Production Product & Architecture Requirements

> **Status:** Development target
>
> **Date:** 2026-09-10
>
> **Purpose:** Turn the validated PaxPivot concept into a production-capable, source-aware Space-A journey planner that helps an eligible traveler understand **what is available, what is supported by official evidence, how to reach a useful terminal, how to connect across terminals, and how to complete the journey with the least stranding risk**.
>
> **Relationship to `paxpivot.md`:** The original bounded validation pilot remains the evidence, policy, source-handling, privacy, failure-state, and validation baseline. This document supersedes the pilot **for product scope and development direction**. Where this document is silent, the stricter source-truth, dissemination, privacy, uncertainty, and no-guarantee rules in `paxpivot.md` continue to control.

---

## 1. Product mission

PaxPivot is not a Space-A schedule board. It is an **end-to-end military Space-A journey planning engine**.

The user should be able to enter a real-world origin, final destination, travel window, party, and eligibility profile and receive an evidence-backed answer to:

1. Which passenger terminals are realistically reachable from me?
2. What current official Space-A opportunities are publicly supported?
3. Which multi-terminal paths could get me closer to my actual destination?
4. Which commercial, ground, rail, rideshare, rental, or other positioning legs are required?
5. Which route is least likely to strand me?
6. What is known, unknown, stale, unverified, or only historical?
7. What should I do next?

The product promise is:

> **PaxPivot shows what current official sources support, how the complete journey fits together, what remains uncertain, and the safest practical fallback when Space-A does not work.**

PaxPivot must never turn an observation into a reservation, a historical pattern into a boarding probability, a source failure into “no flights,” or an AI-generated inference into an official fact.

---

## 2. Product principles

These are non-negotiable across every phase.

1. **Official source truth first.** Every consequential Space-A claim must retain provenance, source time when present, observation time, extraction state, parser version, and confidence reasons.
2. **Unknown is a valid value.** Missing, stale, conflicting, changed-unparsed, inaccessible, restricted, ambiguous, and unverified states must remain visible.
3. **Complete journey, not air leg only.** Every recommended route must connect the user's real origin to the real final destination.
4. **Least-stranding first.** Route ranking prioritizes dependency and stranding risk before convenience.
5. **Deterministic policy.** Eligibility, geography, party rules, and critical routing constraints are rule-engine decisions, not LLM judgments.
6. **AI explains; deterministic services decide.** The conversational layer may interpret intent and explain results but may not invent flights, eligibility, seat states, source facts, or route edges.
7. **No boarding-probability claim without evidence.** Historical observations may be displayed factually. A predictive boarding or completion model is prohibited until the explicit evidence gate in this PRD is met.
8. **Source-specific processing controls.** Public accessibility alone does not authorize cloud parsing, retention, retransmission, alerts, or republishing. Preserve the source-processing register and default-deny posture from the pilot PRD.
9. **No restricted-source bypass.** No CAC/login scraping, credentialed social scraping, access-control bypass, restricted endpoint discovery, ADS-B movement inference, or CUI/restricted artifact processing unless explicitly authorized by the controlling source and product owner.
10. **User trust through explainability.** Every ranked route must say why it ranks where it does and which unresolved facts could invalidate it.

---

## 3. Product phases

The coding agent must implement PaxPivot in phases. Do not jump to predictive intelligence before source correctness and route completeness are proven.

### Phase 0 — Preserve and validate the original pilot

Retain the original `paxpivot.md` pilot requirements as regression fixtures for:

- Category VI accompanied-party behavior;
- Northern New Jersey terminal discovery;
- exact entrance routing;
- source-health state handling;
- Firecrawl monitoring behavior;
- direct opportunity construction;
- fallback behavior;
- privacy and dissemination controls;
- failure injection; and
- explainable ranking.

Phase 0 is a regression baseline, not the final scope.

### Phase 1 — Production core

Build a private production-capable PWA supporting:

- user accounts and saved traveler/party profiles;
- versioned eligibility rules;
- origin and final-destination search;
- nationwide official terminal registry;
- terminal-detail pages;
- Firecrawl source monitoring and approved parsing;
- immutable schedule-observation history;
- current direct Space-A opportunity discovery;
- ground positioning and commercial fallback;
- destination intelligence;
- route comparison and detail;
- source-health dashboard;
- notifications; and
- a conversational “Ask PaxPivot” interface backed only by deterministic tools.

### Phase 2 — Temporal multi-hop network

Add:

- multi-Space-A routing;
- OCONUS and policy-permitted international geography;
- Patriot Express and other official scheduled AMC movements where publicly and legally processable;
- cross-terminal and commercial-air positioning;
- connection buffers and temporal feasibility;
- route alternatives by least-stranding, fastest, lowest-known-cost, and fewest-handoffs;
- return-trip planning; and
- disruption/replan workflows.

### Phase 3 — Historical intelligence

After sufficient approved observations exist, add factual historical analytics such as:

- observed route count;
- observation period;
- days since last observation;
- published seat-state distribution;
- released-seat summaries when exact numeric fields were publicly available and approved for retention;
- source consistency/stability metrics; and
- seasonal or day-of-week descriptive patterns when sample size is adequate.

Do **not** call these boarding probability, route reliability, future frequency, or likelihood unless the prediction gate in Section 16 is separately met.

---

## 4. Primary user experience

The default interaction should feel closer to Google Flights + Google Maps than an AMC schedule archive.

### 4.1 Trip request

The user provides:

- exact or approximate origin;
- final real-world destination, not necessarily a military installation;
- outbound travel window;
- optional return window;
- saved traveler/party profile;
- acceptable positioning radius/time;
- whether commercial-air positioning is allowed;
- whether overnight positioning is acceptable;
- preference: least-stranding, fastest, lowest-known-cost, or fewest-handoffs.

### 4.2 Primary result

Return a small set of route cards, not a raw schedule dump.

Each route card must show:

- origin-to-destination leg strip;
- terminals used;
- Space-A dependencies;
- commercial/ground dependencies;
- current evidence status;
- source freshness;
- unresolved conditions;
- known time;
- known cost;
- number of handoffs;
- fallback path;
- ranking reason; and
- “what to do next.”

Example conceptual output:

```text
BEST CURRENT OPTION
Home → JBMDL → Space-A opportunity → destination ground leg

Why it ranks first:
Fresh official evidence, complete ground access, fewer unresolved handoffs,
and an independent commercial fallback.

Unknown:
Boarding is not guaranteed; final seat selection remains a roll-call decision.

Next:
Review documents → verify terminal status → plan arrival buffer → open official source.
```

### 4.3 Honest absence

When PaxPivot cannot support a viable Space-A route, it must return a useful answer rather than a dead end:

- state which sources were checked;
- distinguish no published departures from inaccessible/stale/unparsed sources;
- show nearby terminals worth monitoring;
- show a commercial-only fallback or continuation; and
- explain the next useful action.

---

## 5. Destination intelligence

Users should not need to know the military terminal network.

### 5.1 Destination resolver

Create a `DestinationResolver` service that converts a user destination into candidate arrival zones and useful terminal endpoints.

Input examples:

- `Honolulu`
- `Tokyo`
- `London`
- `Anchorage`
- `Greenville, SC`
- a street address;
- a landmark;
- a region such as `southern Germany`.

Output must include:

- geocoded destination;
- nearby commercial airports;
- nearby official passenger terminals;
- maximum acceptable last-mile distance/time;
- onward ground/transit options; and
- destination utility score based on actual final-destination access, not airfield proximity alone.

### 5.2 Destination utility

A military terminal is not automatically useful because it is geographically near the destination. Score utility using:

1. verified passenger service status;
2. terminal-to-final-destination ground time;
3. ground/transit availability;
4. installation exit/access constraints;
5. hours and arrival practicality;
6. overnight/late-arrival risk; and
7. commercial continuation options.

Unknown provider supply remains unknown and cannot be converted into guaranteed utility.

---

## 6. Temporal Space-A graph

This is the central production enhancement.

### 6.1 Graph model

Represent travel as a **time-dependent directed multigraph**.

#### Nodes

Nodes may represent:

- verified Space-A passenger terminals;
- commercial airports;
- user origin;
- final destination;
- rail/transit hubs when materially useful; and
- approved intermediate positioning points.

#### Edge types

1. `GROUND_DRIVE`
2. `GROUND_TRANSIT`
3. `GROUND_RIDESHARE_HANDOFF`
4. `GROUND_RENTAL_HANDOFF`
5. `COMMERCIAL_AIR_HANDOFF`
6. `SPACE_A_OBSERVED_OPPORTUNITY`
7. `AMC_SCHEDULED_PUBLIC` such as approved public Patriot Express information
8. `USER_CONFIRMED_LEG`

Every edge must carry its own provenance and uncertainty.

### 6.2 Required edge fields

At minimum:

```text
edge_id
edge_type
from_node_id
to_node_id
departure_window
arrival_window
source_id
source_url
source_time
observed_at
freshness_state
extraction_state
parser_version
eligibility_state
party_compatibility
seat_state_raw
seat_compatibility
known_duration_min
known_duration_max
known_cost_min
known_cost_max
handoff_required
provider_confirmation_required
source_confidence
applicability_confidence
restricted_processing_state
revision_id
supersedes_edge_id
```

### 6.3 Temporal feasibility

A route is feasible only if every later leg can be reached after the previous leg while respecting:

- terminal readiness/roll-call lead time;
- expected ground transfer time;
- security/access tasks;
- required overnight buffer;
- source validity window;
- user constraints; and
- policy-permitted geography.

Unknown Space-A arrival time must not be converted into a fake precise connection time. When connection feasibility cannot be established, mark the connection unresolved or require an overnight/large-buffer strategy.

### 6.4 Multi-hop limits

Start Phase 2 with conservative search limits:

- maximum 2 Space-A air legs by default;
- maximum 1 commercial-air positioning leg before the first Space-A leg;
- maximum 1 commercial continuation after the last Space-A leg;
- maximum total route horizon set by the user's travel window;
- configurable minimum transfer buffers;
- no cyclic routes unless explicitly necessary for repositioning and strictly bounded.

Expand only after performance and route-quality fixtures justify it.

---

## 7. Route generation and ranking

### 7.1 Candidate generation

Use a graph-search pipeline:

1. validate traveler and party;
2. evaluate eligibility/geography rules;
3. resolve reachable origin terminals;
4. resolve useful destination terminals/airports;
5. load fresh approved graph edges;
6. generate temporally feasible paths;
7. attach ground/commercial fallback legs;
8. reject incomplete or policy-incompatible paths;
9. produce a Pareto candidate set; and
10. rank candidates with an explainable comparator.

### 7.2 Pareto candidate generation

Before final ranking, eliminate routes that are dominated across all relevant dimensions.

Candidate dimensions include:

- stranding/dependency tier;
- evidence quality;
- unresolved critical conditions;
- number of Space-A dependencies;
- handoff count;
- known elapsed time;
- known cost; and
- destination utility.

Do not collapse these into an opaque weighted score.

### 7.3 Final ranking

Preserve the pilot's explainable, risk-first philosophy.

Default comparator:

1. lower stranding/dependency tier;
2. no unresolved critical feasibility condition before unresolved;
3. stronger evidence tuple: authority → freshness → extraction → applicability;
4. greater destination utility;
5. fewer Space-A-dependent connections;
6. fewer total handoffs;
7. lower known journey time;
8. lower known out-of-pocket cost.

For user-selected modes:

- **Least-stranding:** use the default comparator.
- **Fastest:** still enforce minimum evidence/safety gates, then prioritize known journey time.
- **Lowest-known-cost:** still enforce minimum evidence/safety gates, then prioritize known cost.
- **Fewest-handoffs:** still enforce minimum evidence/safety gates, then prioritize handoff count.

The UI must expose the first decisive comparison field.

### 7.4 Forbidden ranking behavior

Do not:

- treat unknown cost/time as zero;
- use an unexplainable weighted score;
- infer boarding probability from seat codes or historical counts;
- rank stale evidence as a current opportunity;
- hide a difficult final ground leg;
- assume a connection will wait for a Space-A traveler; or
- call a route “confirmed” unless the responsible provider or user supplied that confirmation state.

---

## 8. Eligibility and policy engine

Create a standalone, versioned `EligibilityEngine`.

### 8.1 Responsibilities

The engine must answer deterministic questions such as:

- traveler category;
- sponsor/dependent accompaniment requirement;
- permitted geography per segment;
- party compatibility;
- document/readiness guidance state;
- whether the product may evaluate the requested segment; and
- which controlling rule/version produced the answer.

### 8.2 Data model

Eligibility rules must be versioned data, not hard-coded copy scattered through UI components.

Suggested entities:

```text
PolicyVersion
EligibilityCategory
TravelerClass
SegmentClass
GeographyRule
AccompanimentRule
CredentialGuidance
ReadinessRequirement
PolicyCitation
PolicyConflict
```

### 8.3 LLM prohibition

The conversational layer may ask `EligibilityEngine` questions and explain returned results. It may not independently classify a traveler or override a policy decision.

---

## 9. Source ingestion and Firecrawl architecture

Firecrawl remains the preferred public-source retrieval and monitoring layer, but it is not the source of truth and not the route engine.

### 9.1 Ingestion pipeline

```text
Official source registry
        ↓
Source policy gate
        ↓
Firecrawl monitor/scrape
        ↓
Raw retrieval metadata + content fingerprint
        ↓
Source-specific parser
        ↓
Critical-field validator
        ↓
Human-review gate when required
        ↓
Immutable ScheduleObservation
        ↓
Opportunity builder
        ↓
Temporal graph
```

### 9.2 Parser registry

Do not use one universal parser for all AMC/terminal layouts.

Create source-specific adapters implementing a shared interface such as:

```text
probe_source()
extract_metadata()
extract_schedule_rows()
validate_critical_fields()
classify_source_state()
```

Each parser has:

- source/layout identifier;
- version;
- labeled test corpus;
- critical-field accuracy report;
- last successful validation date; and
- automatic-opportunity permission state.

### 9.3 Immutable observations

Never overwrite the previous official observation.

Every successful or failed collection attempt produces an auditable observation record or source-health event.

This history powers:

- source debugging;
- revision detection;
- withdrawal/supersession;
- historical analytics;
- reliability measurement; and
- future model evaluation.

### 9.4 Required source states

Retain the pilot state model:

```text
fresh
source_stale
source_unreachable
source_changed_unparsed
source_missing
source_conflict
monitor_delayed
no_departures_published
no_compatible_opportunity
```

Add where necessary:

```text
restricted_user_open_only
parser_review_required
superseded
withdrawn
```

### 9.5 Firecrawl fallback

When Firecrawl cannot reliably access or parse a permitted public source:

1. retry within a bounded policy;
2. preserve the failure state;
3. use a source-specific HTTP or Playwright adapter only if permitted;
4. use document/image extraction only if permitted and validated;
5. never bypass authentication/access controls; and
6. never translate retrieval failure into “no departures.”

---

## 10. Historical observation warehouse

### 10.1 Purpose

PaxPivot should begin collecting permitted immutable observations immediately because historical evidence becomes more valuable with time.

### 10.2 Safe descriptive analytics

After minimum sample gates, PaxPivot may display factual summaries such as:

- `observed 14 times in 90 successful observation windows`;
- `last observed 8 days ago`;
- `numeric released-seat data published in 9 observations`;
- `median published released seats: 18`;
- `source changed format twice in the period`.

Always show:

- numerator;
- denominator;
- date range;
- source coverage limitations; and
- the fact that historical observations do not guarantee future movement or boarding.

### 10.3 No silent survivorship bias

Historical analytics must preserve:

- successful observations;
- explicit no-departure observations;
- stale periods;
- source outages;
- changed-unparsed periods; and
- unapproved/restricted periods where only metadata could be retained.

Do not calculate historical rates using only successful movement observations.

---

## 11. “Ask PaxPivot” conversational planner

The AI experience is an interface to deterministic tools.

### 11.1 Supported questions

Examples:

- “I’m in New Jersey and want to get to Hawaii next week. What should I watch?”
- “Is it worth driving to BWI instead of McGuire?”
- “Show me the least risky way to get near Tokyo.”
- “Why did you rank Dover below McGuire?”
- “What documents and readiness steps do I still need?”
- “What changed since I checked this morning?”

### 11.2 Tool boundary

The LLM must use typed internal tools such as:

```text
resolve_destination()
get_traveler_eligibility()
find_origin_terminals()
get_terminal_details()
get_current_observations()
search_routes()
compare_routes()
get_historical_summary()
get_readiness_tasks()
get_source_health()
```

### 11.3 Response grounding

Every factual movement or policy statement returned by AI must be traceable to structured PaxPivot records. The AI layer must distinguish:

- official current evidence;
- historical observation;
- computed route result;
- provider handoff;
- user-confirmed state; and
- general explanatory text.

If a required deterministic tool returns unknown, the assistant must say unknown.

---

## 12. Maps and positioning

### 12.1 Home network

For each user, generate a home-terminal network based on actual travel time, not only straight-line distance.

For a Northern New Jersey user, the engine should be capable of evaluating terminals such as JBMDL, Dover, BWI, Andrews, and other useful candidates based on configured access thresholds and current operational evidence.

Do not hard-code New Jersey behavior; use the same engine for every origin.

### 12.2 Reposition recommendation

PaxPivot should be able to say:

> No useful current opportunity is supported from your closest terminal, but repositioning to another gateway exposes a stronger route.

A reposition recommendation must include:

- extra ground/commercial positioning burden;
- added cost if known;
- source evidence difference;
- added/removed handoffs;
- return/fallback implications; and
- why the farther gateway is materially better.

---

## 13. Notifications and change detection

Notifications should continue the trip-planning goal, not become a raw movement broadcast.

Support opt-in notifications for:

- source changed;
- source recovered;
- source became stale;
- new approved opportunity relevant to a saved trip;
- relevant opportunity withdrawn/superseded;
- readiness task due;
- route ranking materially changed; and
- fallback condition materially changed where a live provider integration explicitly supports that state.

Movement-detail delivery remains subject to the source-specific dissemination register. Preserve deduplication, quiet-hours, delivery-state, and webhook idempotency requirements from the pilot.

---

## 14. Recommended implementation architecture

### 14.1 Frontend

- **Next.js** with TypeScript
- App Router
- server-rendered public/non-sensitive informational pages
- authenticated application area
- responsive PWA first
- React Query/TanStack Query for client cache where needed
- accessible component library with minimal custom complexity
- MapLibre GL JS for interactive maps

### 14.2 Backend

- **Python FastAPI**
- Pydantic domain contracts
- SQLAlchemy 2 + Alembic
- service boundaries for policy, sources, routing, destinations, notifications, and AI tools
- explicit typed internal APIs rather than UI components querying provider adapters directly

### 14.3 Data

- **PostgreSQL 16**
- **PostGIS** for geospatial terminal/destination queries
- immutable observation and revision tables
- JSONB only for source-specific raw normalized payloads; critical fields must also have typed columns

### 14.4 Background jobs

- Redis
- RQ, ARQ, or another small Python worker system; choose one and keep it simple
- scheduled source monitoring
- parser validation jobs
- notification jobs
- historical aggregation jobs

Do not introduce Kubernetes or a distributed microservice platform for the initial production build.

### 14.5 Routing

Start with:

- NetworkX or a small internal graph abstraction for candidate search;
- Postgres/PostGIS as the durable source of graph data;
- temporal path-search code isolated behind a `RouteEngine` interface.

Do not introduce Neo4j unless profiling demonstrates a real need.

### 14.6 External adapters

Use replaceable provider adapters for:

- Firecrawl;
- ground routing/transit;
- geocoding;
- commercial search handoff;
- email/push notifications;
- AI provider; and
- future permitted official data feeds.

No provider-specific assumptions should leak into route-domain entities.

### 14.7 Deployment

Initial deployment should use Docker Compose on the existing VPS if capacity/security checks pass:

```text
web
api
worker
scheduler
postgres
redis
reverse-proxy
```

Require:

- TLS;
- secrets outside source control;
- encrypted backups;
- tested restore;
- health checks;
- structured logs without sensitive trip details;
- job dead-letter/retry visibility; and
- source/provider budget controls.

---

## 15. Core domain model

Minimum durable entities:

```text
User
TravelerProfile
TravelParty
TripRequest
TripPreference
PolicyVersion
EligibilityRule
PolicyConflict
Terminal
TerminalEntrance
TerminalOperationalFact
Source
SourceProcessingPolicy
SourceObservation
SourceHealthEvent
ScheduleObservation
ScheduleRowRevision
SpaceAOpportunity
Destination
DestinationCandidate
GroundQuoteObservation
CommercialHandoff
GraphNode
GraphEdge
RouteSearch
RouteCandidate
RouteLeg
RouteHandoff
HistoricalAggregate
ReadinessTask
NotificationSubscription
NotificationEvent
UserConfirmedState
AuditEvent
```

Important relationships:

- a `Source` has many immutable `SourceObservation` records;
- an approved source observation may produce many `ScheduleObservation` rows;
- a schedule observation may produce zero or more current `SpaceAOpportunity` objects;
- opportunities and provider observations become graph edges;
- a `RouteCandidate` contains ordered `RouteLeg` and `RouteHandoff` records;
- every consequential derived record retains provenance back to its inputs.

---

## 16. Prediction and probability gate

PaxPivot must not display a boarding, route-success, or completion probability during Phases 0–2.

A future predictive feature may be considered only after all of the following are true:

1. source-specific retention and use is authorized;
2. historical denominators include non-movement and source-failure states where relevant;
3. at least 500 eligible route-level historical observations exist across multiple terminals and periods;
4. at least 100 consented user outcome records exist for the intended prediction target;
5. calibration, discrimination, and confidence intervals are evaluated on held-out data;
6. the model is independently compared with a simple baseline;
7. the UI can explain what the probability means and does not mean;
8. OPSEC/privacy review approves the feature; and
9. the product owner explicitly enables it.

Until then, use descriptive evidence and explainable route-risk tiers only.

---

## 17. Security, privacy, dissemination, and OPSEC

The stricter rules from `paxpivot.md` remain authoritative.

Production additionally requires:

- per-user authorization on every private resource;
- encrypted secrets and sensitive persisted trip data;
- no identity-document uploads unless a separately approved feature requires them;
- no medical/disability evidence storage for eligibility classification;
- data minimization by default;
- user deletion controls;
- audited source-processing permissions;
- no public movement archive by default;
- no detailed movement push/email unless the relevant source policy explicitly permits it;
- no aircraft tracking or undisclosed movement inference;
- no source access bypass;
- provider egress logging that records metadata, not sensitive payloads; and
- a kill switch for any source adapter that violates parsing, security, budget, or dissemination constraints.

---

## 18. Testing requirements

### 18.1 Unit tests

Required for:

- eligibility matrices;
- geography rules;
- terminal-candidate thresholds;
- freshness calculations;
- parser normalization;
- source-state transitions;
- temporal feasibility;
- graph cycle/limit behavior;
- Pareto filtering;
- final comparator behavior;
- unknown time/cost handling;
- revision withdrawal/supersession;
- notification deduplication; and
- AI tool authorization/grounding.

### 18.2 Parser fixtures

Every enabled parser must have versioned fixtures covering:

- normal layout;
- empty/no-departure state;
- malformed row;
- changed columns;
- date crossing midnight;
- ambiguous seat state;
- duplicate row;
- withdrawal/revision;
- inaccessible source;
- stale source;
- changed-unparsed source; and
- restricted/unapproved artifact.

No parser can create automatic opportunities until it passes the critical-field accuracy gate inherited from the pilot.

### 18.3 Route fixtures

Maintain deterministic scenarios including:

1. closest terminal wins;
2. farther terminal wins because evidence is stronger;
3. farther terminal loses because positioning burden is excessive;
4. direct Space-A beats multi-hop;
5. multi-hop beats no useful direct route;
6. commercial positioning unlocks a materially better Space-A route;
7. unknown connection time blocks an unsafe transfer;
8. destination terminal is geographically close but operationally poor;
9. no Space-A opportunity returns a complete commercial fallback;
10. stale/restricted source never becomes a current opportunity;
11. return trip has different optimal gateway;
12. route revision invalidates the previous top result.

### 18.4 AI tests

The conversational layer must be tested for:

- refusing to invent a flight absent tool evidence;
- preserving unknown states;
- never overriding eligibility engine output;
- explaining ranking correctly;
- distinguishing historical from current evidence;
- citing the relevant internal source records; and
- not exposing another user's trip/profile.

---

## 19. Observability

Provide an authenticated internal operations view with:

- source checks due/completed/failed;
- source freshness distribution;
- parser version and approval status;
- parser error samples stripped of restricted/sensitive content;
- queue depth and failed jobs;
- notification delivery states;
- Firecrawl/provider usage and projected cost;
- route-search latency;
- number of candidate paths explored/pruned;
- cache hit rates where useful;
- source-adapter kill switches; and
- current release gates.

Do not collect full session replay containing trip fields.

---

## 20. Performance targets

Initial targets:

- cached terminal/destination search: p95 under 500 ms;
- route-search API with existing fresh graph: p95 under 3 seconds;
- full route refresh requiring live ground/provider queries: progressive UI with first useful state under 3 seconds and final enriched result target under 12 seconds;
- source monitoring occurs asynchronously and is never triggered by every user page view;
- graph search must have explicit path/hop/horizon bounds;
- expensive provider calls must be cached according to provider terms and freshness requirements.

Do not sacrifice correctness or source transparency to meet a latency target.

---

## 21. Agent implementation boundaries

The development agent must follow these rules:

1. Build from the domain model outward; do not start by designing a pretty schedule table.
2. Preserve `paxpivot.md` as the original validation baseline and use its failure/source/privacy rules as regression requirements.
3. Implement deterministic policy and source-state engines before conversational AI.
4. Implement direct route generation before multi-hop.
5. Implement immutable observations before historical analytics.
6. Implement temporal graph search before advanced intelligence.
7. Do not add a probability model during initial development.
8. Do not scrape or process a source that lacks an approved `SourceProcessingPolicy`.
9. Keep provider adapters replaceable.
10. Prefer simple self-hostable infrastructure.
11. Every major feature must include tests and failure states in the same change.
12. Do not silently broaden scope beyond this PRD.

---

## 22. Recommended build sequence

### Milestone A — Foundation

- project scaffolding;
- Docker Compose;
- Postgres/PostGIS;
- Redis worker;
- auth;
- migrations;
- core domain entities;
- structured audit/error model;
- seed the policy/source registries from the pilot baseline.

### Milestone B — Source truth

- terminal registry;
- source-processing register;
- Firecrawl adapter;
- source-health state machine;
- immutable source observations;
- first approved source-specific parser;
- parser fixture suite;
- source operations UI.

### Milestone C — Direct planner

- traveler/party profile;
- eligibility engine;
- destination resolver;
- origin terminal finder;
- exact terminal-entrance routing;
- direct Space-A opportunities;
- commercial fallback;
- route cards/detail;
- readiness workflow.

### Milestone D — Production UX

- PWA shell;
- maps;
- saved trips;
- notifications;
- route refresh;
- “why this route” explanations;
- source evidence drawer;
- honest absence/failure UX.

### Milestone E — Temporal graph

- graph-node/edge materialization;
- temporal path search;
- Pareto candidate pruning;
- multi-hop Space-A;
- commercial positioning;
- connection buffers;
- OCONUS/policy geography expansion;
- return planning;
- route replan on revisions.

### Milestone F — Ask PaxPivot

- typed internal tools;
- AI provider abstraction;
- natural-language trip creation;
- route explanation;
- change explanation;
- grounding/authorization tests.

### Milestone G — Historical intelligence

- approved aggregates;
- observation denominators;
- route history UI;
- descriptive pattern summaries;
- sample-size warnings;
- prediction feature remains locked.

---

## 23. Production acceptance criteria

PaxPivot is not production-ready merely because screens render.

Before a production release:

1. every enabled Space-A source has a documented processing policy;
2. enabled parsers meet the pilot's critical-field correctness gate;
3. a source failure cannot produce a positive movement claim;
4. eligibility fixtures are 100% correct for supported categories/geographies;
5. every route is end-to-end complete or explicitly marked incomplete and not ranked viable;
6. every route explanation matches deterministic comparator output;
7. unknown cost/time/provider supply is never represented as zero or guaranteed;
8. multi-hop search cannot create impossible temporal connections;
9. stale, superseded, withdrawn, and changed-unparsed observations cannot remain active opportunities;
10. all private-resource authorization tests pass;
11. backup/restore and deletion tests pass;
12. provider budget controls and alerts are active;
13. AI hallucination fixtures prove it cannot create unsupported flight/policy facts;
14. failure-injection matrix passes; and
15. product owner approves the supported source/category/geography release matrix.

---

## 24. Definition of the finished product

A user should be able to open PaxPivot and ask:

> “I’m in New Jersey and want to get to Honolulu next week. What are my best Space-A options?”

PaxPivot should be able to:

1. understand the real-world destination;
2. evaluate the user's eligible geography and party;
3. find realistically reachable origin terminals;
4. inspect current approved official evidence;
5. search direct and permitted multi-hop temporal routes;
6. compare a closer terminal against a better-positioned farther gateway;
7. include every required ground/commercial handoff;
8. show a fallback if Space-A fails;
9. explain why the top route ranks first;
10. show exactly what is current, historical, unknown, or unverified;
11. provide readiness and next-action guidance; and
12. do all of the above without claiming a reservation, guaranteed seat, undisclosed movement, or unsupported probability.

That is the product PaxPivot should become.
