# TASK-025 — Firecrawl-backed SourceProvider (metadata-only)

## Status

`blocked` — needs (1) TASK-024 merged, (2) at least one source set to `approved` with
`may_retrieve=True` by the product owner (TASK-023 data + review), (3) a Firecrawl credential
policy (server-side secret name, budget/cadence per pilot SRC-001) recorded by the product owner.

## Assigned role

`build`

## Goal

An adapter implementing `SourceProvider` over Firecrawl that returns metadata-only observations
(retrieval outcome, content hash when `raw_payload != denied`, page timestamp when present,
unknown otherwise) and never a body, passing the TASK-004 conformance suite and the TASK-024 runner.

## Why this task exists

PRD §9.1/§9.5: Firecrawl is the preferred retrieval layer but not the source of truth; retrieval
failure is preserved, never "no departures". ADR-004 fixes where it attaches.

## Dependencies

- Required merged tasks: `TASK-020`, `TASK-024`.
- Human input: see Status.

## Owned paths

```text
apps/api/paxpivot/infrastructure/providers/firecrawl.py
tests/unit/test_firecrawl_provider.py          (recorded/synthetic responses only; no network)
tests/fixtures/firecrawl/README.md
docs/tasks/TASK-025-firecrawl-source-provider.md
```

## Interfaces consumed

```text
application/ports/source_provider.py::SourceProvider
domain/source.py::SourceObservation, SourceState, RetrievalState, ExtractionState, Provenance
application/source_pipeline.py::record_observation (the only way results are stored)
```

## Interfaces produced

```text
infrastructure/providers/firecrawl.py::FirecrawlSourceProvider(client, *, provider_id="firecrawl", policy_version_id: str)
```

## Acceptance criteria

- [ ] Maps HTTP/Firecrawl outcomes to `source_unreachable` / `source_missing` / `fresh`
      (metadata) / `restricted_user_open_only` (auth-walled) with `extraction=not_attempted`;
      never emits `no_departures_published`, never sets `parser_version`.
- [ ] Never returns page content; `content_hash` only when the source policy is not `denied`;
      `payload_ref` only when `snapshot` is allowed (and no snapshot store exists yet → never).
- [ ] Never follows login flows, never bypasses access controls, never sends credentials to the source.
- [ ] Configuration/auth errors → `Failure` with static keys; no exception text or URL query strings in keys/logs.
- [ ] Passes the TASK-004 conformance suite and the TASK-024 runner with recorded responses; the
      `no_network` guard is armed in tests.

## Required tests

```text
tests/unit/test_firecrawl_provider.py
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

## Review / merge rules

`docs/agent/MERGE_POLICY.md`; OPSEC review required (restricted-source bypass, token leakage, raw exposure).

## Out of scope

- No crawl/monitor scheduling, no parsing, no schedule rows, no snapshot store, no cadence budget UI.

## Blocked / contract change needed

See Status. The provider contract itself is fixed; only inputs are missing.

## Handoff

(fill in per template)
