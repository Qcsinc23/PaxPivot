# TASK-050 — Private traveler/party profile (API, migration 0006, Profile screen)

## Status

`in_progress`

## Assigned role

`foundation`

## Goal

The pilot user can record their party — sponsor plus dependents — on `/profile`, with only the
facts eligibility needs. `GET /api/v1/profile` serves that party as validated `PartyFacts` (or an
explicit unset state, never a fabricated default); `PUT /api/v1/profile` replaces it atomically.

## Why this task exists

Eligibility (TASK-035, next) needs party facts from a private profile (INP-001), not from the
trip form. The product owner confirmed the pilot traveler class on 2026-09-14: a Category VI
sponsor (DoDI 4515.13 Table 3 item 47) plus one accompanying minor dependent. Today `/profile` is
an honest empty state with no backing contract; this task gives it one, scoped strictly to the
data PRV-001 allows.

## Dependencies

- Required merged task/contract: `TASK-034` (trip requests: migration/repository/API pattern this
  task follows), `TASK-030`
- Required ADR: `ADR-009` (written by this task)
- Required interface/schema: `apps/api/paxpivot/domain/eligibility.py::PartyFacts`,
  `TravelerFacts` (consumed, not modified — see "Interfaces consumed")

## Owned paths

```text
apps/api/paxpivot/domain/profile.py
apps/api/paxpivot/application/profile_service.py
apps/api/paxpivot/application/ports/repositories.py
apps/api/paxpivot/infrastructure/database.py
apps/api/paxpivot/infrastructure/repositories.py
apps/api/paxpivot/infrastructure/schema_probe.py
apps/api/paxpivot/api.py
apps/api/migrations/versions/0006_traveler_profile.py
apps/web/lib/api/contracts.ts
apps/web/lib/api/client.ts
apps/web/lib/presentation/screens/profile.ts
apps/web/lib/presentation/adapters/profile.ts
apps/web/components/screens/profile/*
apps/web/app/profile/page.tsx
apps/web/app/profile/edit/route.ts
docs/architecture/CONTRACTS.md
README.md
docs/decisions/ADR-009-private-traveler-profile.md
docs/tasks/TASK-050-traveler-profile.md
tests/unit/test_profile.py
tests/unit/test_api_v1.py
tests/integration/test_profile_db.py
tests/integration/test_db_correctness.py
apps/web/tests/screens/profile.test.tsx
apps/web/tests/profile-route.test.ts
```

## Read-only context

```text
PAXPIVOT_PRODUCTION_PRD.md §8, §17
paxpivot.md INP-001, PRV-001, §15.1, §16.1
docs/architecture/BOUNDARIES.md
docs/architecture/CONTRACTS.md
docs/decisions/ADR-004-sources-terminals-persistence.md
docs/decisions/ADR-005-pilot-access-boundary.md
docs/tasks/TASK-034-trip-request.md
apps/api/paxpivot/domain/eligibility.py
apps/api/paxpivot/domain/trip.py
apps/api/paxpivot/application/trip_service.py
apps/api/migrations/versions/0004_trip_requests.py
```

## Interfaces consumed

```text
apps/api/paxpivot/domain/eligibility.py::TravelerFacts, PartyFacts
apps/api/paxpivot/infrastructure/database.py::transaction, read_snapshot
apps/web/lib/api/client.ts::readApi, writeApi
```

`TravelerFacts` carries two fields this profile never collects: `traveler_class` (a versioned
policy-class attestation TASK-035's engine has not defined yet) and `accompanied` (a per-trip
fact, not a standing profile fact). This task fills them with an explicit placeholder/`None`
when constructing a `PartyFacts` value, never a guess from data the profile does not hold — see
ADR-009.

## Interfaces produced

```text
apps/api/paxpivot/domain/profile.py::ProfileTraveler, NewParty (-> PartyFacts via to_party_facts())
apps/api/paxpivot/application/ports/repositories.py::ProfileReader, ProfileRepository
apps/api/paxpivot/application/profile_service.py::ProfileRead, get_profile, replace_profile
GET /api/v1/profile, PUT /api/v1/profile (bearer)
apps/web/lib/api/contracts.ts::ProfileRead, PartyFactsWire, NewPartyWire
apps/web/lib/api/client.ts::writeApi(path, body, { method }) — additive `method` option (default
  POST) so the profile route handler can PUT; trips/new is unchanged.
```

## Acceptance criteria

- [x] `GET /api/v1/profile` returns the party, or an explicit unset state — never a fabricated
      default.
- [x] `PUT /api/v1/profile` validates and atomically replaces the whole party; an invalid body
      returns 422 with an allowlisted message key and writes nothing.
- [x] Every `PartyFacts`/data-minimisation rule from the task brief is enforced at the API
      boundary, and by DB CHECK/FK constraint wherever a constraint can express it.
- [x] The `profile`/`profile_travelers` tables carry no name, credential number, medical/
      disability data, document, full birth date or free-text column.
- [x] `/profile` reads the profile on the server, shows the party or the honest empty state, and
      offers a form to set the sponsor's category attestation and to add/remove dependents with
      an age band; the eligibility card keeps the existing "No eligibility decision yet" wording.
- [x] Every `/api/v1` route added requires a bearer principal (401 without one).
- [x] `contracts.ts`, `CONTRACTS.md` and the README route table/migration range are updated; the
      drift guard (`tests/unit/test_docs_consistency.py`) passes.
- [x] No unrelated files changed.

## Required tests

```text
tests/unit/test_profile.py — every NewParty/PartyFacts rule (unique ids, sponsor has no sponsor,
  dependent references a party sponsor, party-size cap, unknown/extra fields rejected),
  to_party_facts() placeholder behaviour
tests/unit/test_api_v1.py — GET/PUT /api/v1/profile: 401 without bearer, empty GET, PUT+GET
  roundtrip, invalid PUT -> 422 with an allowlisted message key
tests/integration/test_profile_db.py — migration upgrade to head, atomic replace (nothing
  written on a failed replace), DB CHECK/FK constraints reject invalid rows direct at SQL,
  the party-size-cap trigger, table columns assert no sensitive column exists
tests/integration/test_db_correctness.py — updated CHECK-parity count for the new rules
apps/web/tests/screens/profile.test.tsx — empty state, rendered party, no eligibility
  conclusion, forbidden-field scan extended to profile fixtures, axe checks
apps/web/tests/profile-route.test.ts — route handler success/validation-error redirects
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
make migrate-test
make check
```

## UI behaviour (screen tasks only)

See `docs/tasks/SCREEN_TASK_RULES.md`. No eligibility conclusion is computed or implied on this
screen; the eligibility card keeps rendering the existing "No eligibility decision yet" state
until TASK-035/051.

## Review / merge rules

`docs/agent/MERGE_POLICY.md` applies. A fresh engineering review is recorded in the PR before
merge (see PR body).

## Out of scope

- Not included: the eligibility engine and policy data (TASK-035), readiness guidance
  (TASK-052), linking trips to the party (TASK-051), accounts, compose/deploy/CI files
  (TASK-045/047), the trip page (TASK-044), the auth routes (TASK-046).
- Do not refactor: the existing readiness/notifications sections of `ProfileScreen`, or
  `EligibilityDetailScreen`/`ReadinessScreen`.

## Blocked / contract change needed

`None`

## Handoff

Fill in before review/done.

**Branch:** `foundation/TASK-050-traveler-profile`

**Commit:**

**Files changed:**

**Interfaces added/changed:**

**Migrations:** `0006_traveler_profile`

**Verification run:**

```text
command -> PASS/FAIL summary
```

**Known limitations / risks:**

**Next dependency:** TASK-035 (eligibility engine) consumes `profile_service.get_profile` /
`NewParty.to_party_facts()`.
