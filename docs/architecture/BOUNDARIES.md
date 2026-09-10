# PaxPivot Architecture Boundaries

This document gives implementation agents a concise map of the intended system boundaries. It does not replace `PAXPIVOT_PRODUCTION_PRD.md`.

## Dependency direction

Dependencies flow inward toward the domain. Provider and framework code must not define product truth.

```text
UI / API / Jobs
      ↓
Application services
      ↓
Domain engines + typed contracts
      ↓
Repository/provider interfaces
      ↓
Infrastructure adapters
```

The domain layer must not import Next.js, FastAPI, Firecrawl SDKs, Redis clients, email SDKs, or database-driver-specific objects.

## Major bounded contexts

### Identity & Travel Party

Owns users, traveler profiles, parties, saved trip preferences, authorization, and user-confirmed journey state.

Must not determine Space-A policy itself; it supplies normalized traveler/party facts to the Eligibility context.

### Eligibility & Policy

Owns versioned policy, category/geography rules, accompaniment rules, readiness requirements, policy citations, and unresolved policy conflicts.

Authoritative for eligibility decisions. LLM/UI/provider code may not override it.

### Terminal & Destination

Owns verified passenger terminals, actual terminal entrances, operational terminal facts, destination resolution, nearby useful terminals/airports, and destination utility.

Airfield/base coordinates alone are never sufficient to establish a usable passenger terminal.

### Sources & Observations

Owns source registry, source-processing policy, Firecrawl/provider retrieval, source health, immutable observations, parser versions, schedule-row revisions, withdrawal/supersession, and provenance.

Retrieval adapters do not create routes directly. They produce validated observations.

### Opportunities

Owns conversion of approved fresh schedule observations into party/geography-compatible `SpaceAOpportunity` records.

An observation is not automatically an opportunity. An opportunity is not a reservation or guaranteed flight.

### Routing

Owns graph nodes/edges, temporal feasibility, candidate generation, Pareto pruning, ranking, complete route construction, ground/commercial fallback, and route explanations.

Routing consumes decisions/records from Eligibility, Terminal/Destination, Sources/Observations, Opportunities, and provider handoff services. It must not scrape sources itself.

### Ground & Commercial Handoffs

Owns ground-routing queries, transit/rideshare/rental/parking handoffs, commercial-air search handoffs, freshness, provider attribution, and unknown provider supply/cost states.

Provider handoffs do not become guarantees.

### Notifications

Owns opt-in subscriptions, material-change detection, quiet hours, deduplication/idempotency, source-policy content gating, and delivery telemetry.

Notifications consume approved product events; they must not independently interpret source material.

### Ask PaxPivot

Owns natural-language intent parsing and explanation of deterministic tool results.

It may call typed application tools only. It may not create or modify official facts, eligibility outcomes, opportunities, graph edges, provider confirmations, or probabilities.

## Shared contract ownership

Shared domain contracts are foundation-agent-owned by default.

Examples:

- eligibility decision types;
- source-state enums;
- observation/provenance types;
- opportunity types;
- route/leg/handoff types;
- provider interface protocols;
- API request/response schemas;
- database schema/migration heads.

The build agent may consume these contracts and implement bounded behavior behind them. Changing them requires an explicit task/ADR and foundation-agent review.

## Suggested repository shape after scaffolding

The scaffold agent may adapt names to ecosystem conventions, but preserve these boundaries.

```text
apps/
  web/                  # Next.js PWA
  api/                  # FastAPI composition / HTTP surface

packages/ or src/
  domain/               # framework-independent domain types/engines
  application/          # use cases and orchestration
  infrastructure/       # DB/provider implementations
  integrations/         # Firecrawl/maps/email/AI adapters if kept separate

workers/                # scheduled/background job entrypoints if not in api package

tests/
  unit/
  integration/
  contract/
  fixtures/

docs/
  architecture/
  agent/
  decisions/
  tasks/
```

If using a Python monorepo layout, the backend directories may live under `apps/api/`. Do not create parallel copies of domain logic in multiple apps.

## Cross-boundary rules

1. UI never calls Firecrawl or map/email providers directly.
2. Provider adapters never write product-facing claims directly.
3. Source parsers never perform eligibility decisions.
4. Eligibility never depends on an LLM.
5. Routing never treats unknown time/cost as zero.
6. Historical analytics never mutate source observations.
7. Notifications never bypass dissemination/source-processing policy.
8. AI never bypasses application-service authorization.
9. All consequential derived records retain provenance to their inputs.
10. Shared contracts require tests before dependent implementation work begins.

## Architecture change rule

If a task requires breaking one of these boundaries, create an ADR under `docs/decisions/` and have the foundation agent resolve it before implementation continues.
