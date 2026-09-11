# TASK-025 — Firecrawl-backed SourceProvider (metadata-only)

## Status

`done` — merged to `main` in 8de8f27 (PR #37); post-merge Quality green; deployed on the pilot VPS with a 6-hourly `check-sources` cron. Retrieval starts on the first run after the product owner places `FIRECRAWL_API_KEY` in `/opt/paxpivot/.env.production` (until then each run exits 2 and records nothing).

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
apps/api/paxpivot/infrastructure/providers/{__init__,firecrawl}.py
apps/api/paxpivot/tooling.py (check-sources), Makefile (check-sources), compose.prod.yml (FIRECRAWL_API_KEY passthrough)
pyproject.toml, uv.lock (httpx runtime dependency)
tests/unit/test_firecrawl_provider.py          (httpx.MockTransport; network refused)
tests/integration/test_source_checks_db.py     (runner + provider on a temporary database)
docs/DEPLOYMENT.md, docs/tasks/TASK-025-firecrawl-source-provider.md
```

## Interfaces consumed

```text
application/ports/source_provider.py::SourceProvider
domain/source.py::SourceObservation, SourceState, RetrievalState, ExtractionState, Provenance
application/source_pipeline.py::record_observation (the only way results are stored)
```

## Interfaces produced

```text
infrastructure/providers/firecrawl.py::FirecrawlSourceProvider(api_key, sources: Mapping[UUID, Source], *, transport=None, clock=...)
  .from_env(sources, env) -> provider | None; provider_id == "firecrawl"
tooling: `python -m paxpivot.tooling check-sources` (exit 2 without FIRECRAWL_API_KEY); `make check-sources`
```

## Acceptance criteria

- [x] Maps HTTP/Firecrawl outcomes to `source_unreachable` / `source_missing` / `fresh`
      (metadata) with `extraction=not_attempted`; 401/403 are `source_unreachable` (`http_forbidden`), never
      `restricted_user_open_only` (an edge refusal is not evidence of a user-open-only source);
      never emits `no_departures_published`, never sets `parser_version`.
- [x] Never returns page content; `content_hash` only when the source policy is not `denied`;
      `payload_ref` only when `snapshot` is allowed (and no snapshot store exists yet → never).
- [x] Never follows login flows, never bypasses access controls, never sends credentials to the source.
- [x] Configuration/auth errors → `Failure` with static keys; no exception text or URL query strings in keys/logs.
- [x] Passes the TASK-004 conformance suite and the TASK-024 runner with recorded responses; the
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

## Handoff notes (review outcomes)

- A transport failure to Firecrawl is a `Failure` (nothing recorded), never a `source_unreachable`
  observation: an outage on our side is not evidence about the official page.
- `check-sources` exits 2 (no key) or 3 (provider failures) so cron output is actionable; the run
  is one write transaction (all-or-nothing per run; do not run under an idle-in-transaction
  timeout shorter than ~5 minutes).
- `cadence_minutes` is informational until a scheduler task lands: the runner checks every
  enabled source on every invocation, so keep the cron interval equal to the cadence (360 min).

## Out of scope

- No crawl/monitor scheduling, no parsing, no schedule rows, no snapshot store, no cadence budget UI.

## Blocked / contract change needed

`None`. Runtime prerequisite: `FIRECRAWL_API_KEY` set on the API host (product owner's account).

## Handoff

**Branch/commit:** `foundation/TASK-025-firecrawl-provider`, merged as 8de8f27. **Migrations:** none. **Dependency:** `httpx` runtime.
**Verification:** make check + migrate-test PASS on the final head (pytest 234 unit / 36 integration; Vitest 329); two adversarial review passes, final 0 Critical / 0 Important; live: images 8de8f27 running, `/ready` 200, first `check-sources` exits 2 (no key yet).
**Operations:** `/etc/cron.d/paxpivot-checks` (every 6 h, log at `/opt/paxpivot/backups/checks.log`); exit 2 = no key, 3 = provider failure.
