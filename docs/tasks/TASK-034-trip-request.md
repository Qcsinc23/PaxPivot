# TASK-034 — Trip request: domain, persistence, API, Plan form

## Status

`ready` — decisions delegated by the product owner (2026-09-11); see AUDIT.md §4/§6.

## Assigned role

`foundation`

## Goal

`TripRequest` (id, origin terminal id or home, destination text, window start/end, party size,
created_at) as a domain contract, `trip_requests` table (migration 0004 or 0005), repository
port + SQL, `POST /api/v1/trips` and `GET /api/v1/trips[/{id}]` behind the bearer token, a Plan
form (server action, behind the session) that posts it, and Trips listing the user's requests.
Results for a trip render the honest "no route search yet" panel until TASK-036.

## Dependencies

TASK-030

## Owned paths

```text
apps/api/paxpivot/domain/trip.py, application/ports/repositories.py, application/trip_service.py, read_models.py, api.py
apps/api/migrations/versions/000N_trip_requests.py, infrastructure/{database,repositories}.py
apps/web/app/page.tsx, app/trips/page.tsx, app/trips/[tripId]/page.tsx, lib/api/{contracts,client}.ts (write helper), adapters
tests (unit, integration, web), docs/tasks/TASK-034-trip-request.md
```

## Acceptance criteria

- [ ] A trip can be created from Plan and appears on Trips; its Results page is honest until routes exist.
- [ ] Input validated at the boundary (window sane, party 1–9, destination non-empty); no free text reaches logs.
- [ ] Single-user pilot: trips are not user-scoped yet (documented; per-user auth is the later gate).
- [ ] Tests prove the behaviour; no unrelated files changed.

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

`docs/agent/MERGE_POLICY.md`; OPSEC review for anything touching source content.

## Out of scope

No eligibility, no routes.

## Blocked / contract change needed

`None`

## Handoff

(fill in per template)
