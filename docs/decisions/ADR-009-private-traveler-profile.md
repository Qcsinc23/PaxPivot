# ADR-009 — Private traveler/party profile: data minimisation, singleton persistence, retention

## Status

Accepted — foundation-agent decision under TASK-050; 2026-09-14.

## Context

The product owner confirmed the pilot traveler class (2026-09-14): a Category VI sponsor
(DoDI 4515.13 Table 3 item 47, veteran with a permanent service-connected disability rated as
total) plus an accompanying minor dependent. TASK-035, the eligibility engine, needs party facts
from a private profile (INP-001) — not from the trip form, which never carries a category
attestation or age band. Today `/profile` is an honest empty state with no contract behind it.
This ADR gives it one, scoped strictly to what PRV-001 allows a pilot to store, and decides the
persistence shape for a single-user pilot with no user table (ADR-005).

## Decision

**What is stored, and why.** `apps/api/paxpivot/domain/profile.py::ProfileTraveler` carries
exactly five fields: `traveler_id`, `role` (`sponsor`/`dependent`), `category_attestation`
(`I`–`VI`/`unknown`), `age_band` (`under_14`/`minor_14_or_older`/`adult`/`unknown`), and
`sponsor_id` (set only for a dependent). Each is the minimum eligibility needs to apply the
DoDI 4515.13 category/accompaniment rules once TASK-035 exists: the role and category decide
which rule applies, the age band decides accompaniment/unaccompanied-minor handling, and the
sponsor reference decides which sponsor a dependent travels under. `NewParty` (the `PUT` body)
carries the same fields plus the same cardinality/reference rules as
`domain/eligibility.py::PartyFacts` (unique ids, a sponsor has no sponsor, a dependent references
a party sponsor, min 1, max 9 travelers — the same pilot-scale cap as `NewTripRequest.party_size`,
TASK-034). The rule is written directly on `NewParty` rather than imported: `ProfileTraveler` is
this task's own minimal contract, not `TravelerFacts`, and this task does not modify
`domain/eligibility.py`, which TASK-035 owns.

**What is never stored, enforced by schema.** `ProfileTraveler` has no field — not a nullable
one, one that does not exist — for a name, an SSN/DoD ID or other credential number, a
disability rating or other medical evidence, a document or image, a full birth date, or free
text. `test_profile_traveler_carries_no_name_credential_medical_or_free_text_field` pins the
field set; `profile_travelers`' migration-created columns are asserted directly by
`tests/integration/test_profile_db.py`. There is nowhere for the sponsor's actual DoDI Table 3
item 47 disability determination to be entered here, or anywhere else in this task: the pilot
sponsor's `category_attestation` is a self-reported `VI`, not a verified determination, and no
future task may add a disability, document or identity field to this table without a superseding
ADR.

**Two `TravelerFacts` fields this profile never collects.** `PartyFacts`/`TravelerFacts`
(`domain/eligibility.py`) carry `traveler_class` (a versioned policy-class attestation) and
`accompanied` (a bool). Neither is collected here: `traveler_class` cannot be meaningfully
assigned because TASK-035's policy versioning does not exist yet, and `accompanied` is a
per-trip fact (was this dependent actually traveling with the sponsor on a given journey), not a
standing profile fact. `NewParty.to_party_facts()` fills them with an explicit placeholder
(`UNASSIGNED_TRAVELER_CLASS = "unassigned"`) and `None` respectively — never a guess derived
from data the profile does not hold — so the result still validates as a genuine `PartyFacts`
for `GET /api/v1/profile`'s response and for TASK-035 to consume later. `SqlProfileRepository`
reconstructs the same two placeholders on every read, so a read after a write is
indistinguishable from what was written.

**Singleton design.** Chosen: **a database-enforced singleton `profile` row, with child
`profile_travelers` rows referencing it by foreign key.** `profile.singleton` is a boolean column
with a `CHECK (singleton)` (a stored value of `false` is refused outright) and a `UNIQUE`
constraint on that same column — so a second row, whatever its own `profile_id`, always collides
with the first. This is preferred over the alternative (traveler rows with a single-profile
constraint, e.g. a fixed literal `profile_id` CHECKed on every traveler row) because: it gives
travelers a real foreign key to an actual profile row rather than a magic constant repeated on
every traveler row; the boolean-singleton-column trick is a well-understood Postgres idiom that
needs no hard-coded UUID literal baked into the schema; and it makes "the profile is unset" a
structurally distinct, first-class state (zero rows in `profile`) rather than "zero traveler
rows under an implicit profile" being the only signal. `profile_travelers.profile_id` has
`ON DELETE CASCADE` to `profile.profile_id`, and `sponsor_id` self-references
`profile_travelers.traveler_id` with `ON DELETE CASCADE` too, so there is no path to an orphaned
traveler row even outside the application.

**Atomic replace.** `SqlProfileRepository.replace(party)` upserts the singleton `profile` row
(inserting it on the first save, otherwise only touching `updated_at`), deletes every existing
`profile_travelers` row for it, and inserts the submitted travelers sponsor-first — all on the
one `Connection` the caller's `infrastructure.database.transaction()` unit of work already holds,
so the whole replace commits or rolls back together (`tests/integration/test_profile_db.py`
proves a rejected `PUT` leaves the prior party, or the unset state, completely unchanged).
Travelers are inserted sponsor-first so a dependent's `sponsor_id` foreign key always names an
already-inserted row within the same batch, regardless of the order the traveler submitted them
in the form.

**Validation at the boundary, and by DB constraint where a constraint can express it.**
`PUT /api/v1/profile` parses the body into `NewParty` (catching `pydantic.ValidationError` as
`422 {"message_key": "profile.invalid_party"}`) and then calls `NewParty.to_party_facts()`
(the same message key on failure) before any write is attempted — an invalid party writes
nothing. At the database: `role`, `category_attestation` and `age_band` are `CHECK`-enumerated
exactly as the domain's own literal values; `(role = 'sponsor') = (sponsor_id IS NULL)` and
`sponsor_id <> traveler_id` are per-row `CHECK`s; `sponsor_id` and `profile_id` are foreign keys
into `profile_travelers`/`profile`. **Not** DB-enforced, and explained rather than worked
around: that a dependent's `sponsor_id` names a row whose `role` is specifically `sponsor` (a
cross-column condition on the *referenced* row, which a plain foreign key cannot express, and
which this task did not add a trigger for, since `PUT` is the only writer and it always
validates the whole party before any row is written — a defensive trigger would duplicate a
check the sole write path already performs). The party-size cap of 9 **is** enforced at the
database, by a lightweight trigger (`paxpivot_profile_party_cap`, `AFTER INSERT ... FOR EACH
STATEMENT`) rather than a `CHECK`, because a `CHECK` constraint cannot see other rows and a
row-cardinality rule has no other expression in Postgres; it fires once per statement (so a
bulk replace is judged once, at its final row count) and is a backstop behind `NewParty`'s own
`Field(max_length=9)`, matching `NewTripRequest.party_size`'s pilot-scale bound (TASK-034).

**Retention/deletion.** Saving an empty party is impossible by construction (`NewParty` requires
at least one traveler), so there is no "save empty to clear" action to reason about. Clearing the
profile is therefore a distinct, explicit action, not a side effect of the edit form: this task
does not add a "delete my profile" endpoint or control (out of scope; the pilot user's own
Postgres access is the only path to remove the row today). A future task that adds an explicit
clear action can do so as `DELETE /api/v1/profile` (or a `PUT` with a dedicated flag) without any
schema change, since `ON DELETE CASCADE` already makes removing the `profile` row a
single-statement, fully consistent way to remove the whole party.

**No per-user accounts.** Per ADR-005, the pilot has exactly one human behind one shared
passphrase and no user table. `profile` is therefore singular by construction, not
`user_id`-scoped: there is one party because there is one user, and the singleton constraint is
the enforcement of that fact at the database, not a convention the application must remember.
Multi-user support is out of scope here and would need its own ADR (a `profile.owner_id` column,
the removal of the singleton constraint, and per-user authorization — none of which exists yet).

## Alternatives considered

*Traveler rows with a single-profile constraint* (no separate `profile` table; every traveler
row carries a fixed literal `profile_id` CHECKed to one constant): rejected because it repeats a
magic constant on every row instead of a real foreign key, and it collapses "no profile set" and
"a profile with zero travelers" into the same absence of rows with no distinct anchor row to
attach `created_at`/`updated_at` to. *Reusing `domain/eligibility.py::TravelerFacts` directly as
the stored/wire shape*: rejected because it would force either storing `traveler_class` and
`accompanied` (fields this profile has no honest value for) or silently relaxing that contract,
neither of which PRV-001 or the "no fabricated default" rule allows; a minimal `ProfileTraveler`
plus an explicit, documented mapping is safer and keeps `domain/eligibility.py` untouched, as
TASK-035 owns it. *A DB trigger enforcing "a dependent's sponsor_id must name a sponsor-role
row"*: rejected per the "validation at the boundary" section above — the sole writer already
enforces it, and the pilot has no second write path a trigger would need to guard against.
*Storing `traveler_class` as the profile's own `category_attestation` value* (skipping the
placeholder): rejected because the two concepts are different (an attested self-report today
versus a versioned policy-class decision TASK-035 has not defined), and conflating them would
make a future TASK-035 migration harder to reason about, not easier.

## Consequences

`/profile` becomes a live, working form the pilot user can actually use before TASK-035 exists,
with the DB-minimisation guarantees provable today rather than only documented. TASK-035 gets a
stable, already-tested `PartyFacts` value to consume (`profile_service.get_profile`), with the
two explicit placeholders it must itself decide how to treat once policy versioning exists —
that decision is explicitly deferred to TASK-035, not made here. TASK-051 (linking trips to the
party) and TASK-052 (readiness guidance) are unaffected: this task does not touch `trip_requests`
or add any readiness/eligibility computation. A later multi-user pilot needs its own ADR before
the singleton constraint can be relaxed.

## Contract impact

New: `apps/api/paxpivot/domain/profile.py` (`ProfileTraveler`, `NewParty`); `application/
profile_service.py` (`ProfileRead`, `get_profile`, `replace_profile`); `application/ports/
repositories.py` (`ProfileReader`, `ProfileRepository`); `infrastructure/database.py` (`profile`,
`profile_travelers` tables); `infrastructure/repositories.py` (`SqlProfileRepository`);
`infrastructure/schema_probe.py` (the new CHECK/FK rules); migration `0006_traveler_profile`;
`api.py` (`GET`/`PUT /api/v1/profile`); `apps/web/lib/api/contracts.ts` (`ProfileRead`,
`PartyFactsWire`, `NewPartyWire`); `apps/web/lib/api/client.ts` (`writeApi`'s additive `method`
option); `apps/web/lib/presentation/screens/profile.ts` and `apps/web/components/screens/
profile/*` (the party section and the edit form); `apps/web/app/profile/page.tsx` (now a live
server component); `apps/web/app/profile/edit/route.ts` (new). No change to `trip_requests`,
`domain/eligibility.py`, or any existing `/api/v1` route.

## Migration / rollout

`make migrate` applies `0006_traveler_profile`; `make migrate-test` proves fresh-database
upgrade, the CHECK-parity probe (extended with the new rules) and downgrade/re-upgrade. Existing
checkouts and the deployed pilot need only `make migrate`; there is no data to backfill, since no
profile table existed before this task.

## Verification

`tests/unit/test_profile.py` (every `NewParty`/`PartyFacts` rule, the field-set assertion, the
placeholder behaviour of `to_party_facts`); `tests/unit/test_api_v1.py` (401 without bearer,
unset `GET`, `PUT`→`GET` roundtrip, invalid `PUT` → 422 with nothing written); `tests/
integration/test_profile_db.py` (migration upgrade to head, atomic replace, direct-SQL CHECK/FK
rejection, the party-size-cap trigger, the table's column list); `tests/integration/
test_db_correctness.py` (updated CHECK-parity count); `apps/web/tests/screens/profile.test.tsx`
and `apps/web/tests/profile-route.test.ts` (empty state, rendered party, no eligibility
conclusion, forbidden-field scan, route handler success/error, axe checks); `make check` and
`make migrate-test`.
