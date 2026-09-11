# TASK-034 — Trip request: domain, persistence, API, Plan form

## Status

`done` — merged in PR #41 (merge commit 4b96308, post-merge CI green); deployed to the VPS at tag 4b96308 on 2026-09-11 (alembic head `0004_trip_requests`), live API verified: create 201, list, get 200, invalid body 422.

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

- [x] A trip can be created from Plan and appears on Trips; its Results page is honest until routes exist.
- [x] Input validated at the boundary (window sane, party 1–9, destination non-empty); no free text reaches logs.
- [x] Single-user pilot: trips are not user-scoped yet (documented; per-user auth is the later gate).
- [x] Tests prove the behaviour; no unrelated files changed.

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

## Implementation notes (2026-09-11)

- Domain `NewTripRequest`/`TripRequest` (aware datetimes, end > start, span ≤ 30 days, party 1–9,
  destination 1–200 chars); migration `0004_trip_requests` with matching CHECK constraints,
  verified by the schema parity probe (23 rules).
- API: `POST /api/v1/trips` (201; 422 `trip.unknown_origin_terminal` for an unregistered origin),
  `GET /api/v1/trips`, `GET /api/v1/trips/{id}` (404), all behind the principal gate. Writes use
  one `transaction` per request; reads stay on the read snapshot.
- Web: Plan renders a plain HTML form posted to `/trips/new` (server route, token never in the
  browser) → 303 to `/trips/{id}`. Trips lists requests newest first with no source evidence; the
  trip page shows the request and states that no route has been searched.
- `datetime-local` values are treated as UTC for the pilot (single user, documented here);
  terminal-local windows are a later task.
- Trips are not user-scoped; per-user auth is the gate before multi-user (ADV-005 boundary).

## Review fixes (2026-09-11, adversarial review: 0 Critical / 1 Important → fixed)

- Engine created with `hide_parameters=True`; an `IntegrityError` on the insert (origin terminal
  removed between check and insert) maps to 422 without the statement, so request text never
  reaches a log line (test asserts the log is clean).
- Trip page requires a full UUID and treats an API `invalid` as not found; window inputs are
  labelled UTC; error lookup uses own properties only; impossible calendar dates are rejected.

## Handoff

- **Merged:** PR #41 → 4b96308; post-merge `Quality` green. Deployed `paxpivot-{api,web}:4b96308`; migration 0004 applied at API start; smoke from inside the stack: POST 201, list shows the trip first with the origin name, GET 200, party_size 0 → 422.
- **Adversarial review (fresh, 0 Critical / 1 Important → fixed):** engine `hide_parameters=True` and FK race → 422 so request text never reaches logs; strict UUID on the trip page; UTC labels on the window inputs; own-property error lookup; impossible dates rejected.
- **Known limits (pilot):** windows are UTC; trips are not user-scoped (per-user auth before multi-user); no idempotency on double submit; Trips list has no LIMIT and one terminal lookup per trip (fine at pilot scale, join before multi-user).
- **Next:** TASK-036 route search consumes `trip_requests`; TASK-032 parser after ≥10 labeled corpus files.
- **Not done here:** no eligibility, routing, ranking or "no flights" claims; the trip page states that no route has been searched.
