"""TASK-050: the private traveler/party profile stores exactly what eligibility needs, and
`NewParty.to_party_facts()` reuses `PartyFacts`'s own cross-reference validation."""

from uuid import uuid4

import pytest
from paxpivot.domain.eligibility import PartyFacts
from paxpivot.domain.profile import (
    MAX_PARTY_SIZE,
    UNASSIGNED_TRAVELER_CLASS,
    NewParty,
    ProfileTraveler,
)
from pydantic import ValidationError

SPONSOR_ID = uuid4()
DEPENDENT_ID = uuid4()


def sponsor(**overrides: object) -> dict[str, object]:
    data: dict[str, object] = {
        "traveler_id": SPONSOR_ID,
        "role": "sponsor",
        "category_attestation": "VI",
        "age_band": "adult",
        "sponsor_id": None,
    }
    return {**data, **overrides}


def dependent(**overrides: object) -> dict[str, object]:
    data: dict[str, object] = {
        "traveler_id": DEPENDENT_ID,
        "role": "dependent",
        "category_attestation": "unknown",
        "age_band": "under_14",
        "sponsor_id": SPONSOR_ID,
    }
    return {**data, **overrides}


def party(*travelers: dict[str, object]) -> NewParty:
    return NewParty.model_validate({"travelers": travelers})


def test_a_sponsor_alone_is_a_valid_party() -> None:
    solo = party(sponsor())
    assert solo.travelers[0].role == "sponsor"


def test_a_sponsor_plus_dependent_is_a_valid_party() -> None:
    both = party(sponsor(), dependent())
    assert [t.role for t in both.travelers] == ["sponsor", "dependent"]


def test_traveler_ids_must_be_unique() -> None:
    with pytest.raises(ValidationError):
        party(sponsor(), dependent(traveler_id=SPONSOR_ID))


def test_a_sponsor_cannot_reference_another_sponsor() -> None:
    with pytest.raises(ValidationError):
        party(sponsor(sponsor_id=uuid4()))


def test_a_dependent_must_reference_a_party_sponsor() -> None:
    with pytest.raises(ValidationError):
        party(dependent(sponsor_id=None))
    with pytest.raises(ValidationError):
        party(dependent(sponsor_id=uuid4()))  # references nobody in this party


def test_at_least_one_traveler_is_required() -> None:
    with pytest.raises(ValidationError):
        NewParty.model_validate({"travelers": []})


def test_party_size_is_capped_to_match_the_trip_request_bound() -> None:
    assert MAX_PARTY_SIZE == 9
    travelers = [sponsor()] + [dependent(traveler_id=uuid4()) for _ in range(MAX_PARTY_SIZE - 1)]
    assert len(party(*travelers).travelers) == MAX_PARTY_SIZE
    with pytest.raises(ValidationError):
        party(*travelers, dependent(traveler_id=uuid4()))


def test_unknown_or_extra_fields_are_rejected() -> None:
    with pytest.raises(ValidationError):
        party(sponsor(name="Traveler"))
    with pytest.raises(ValidationError):
        NewParty.model_validate({"travelers": [sponsor()], "notes": "free text"})


@pytest.mark.parametrize(
    "field,value",
    [
        ("role", "guardian"),
        ("category_attestation", "VII"),
        ("age_band", "teen"),
    ],
)
def test_enum_fields_reject_invented_values(field: str, value: str) -> None:
    with pytest.raises(ValidationError):
        party(sponsor(**{field: value}))


def test_profile_traveler_carries_no_name_credential_medical_or_free_text_field() -> None:
    """PRV-001: the schema itself is the enforcement, not just docs."""
    assert set(ProfileTraveler.model_fields) == {
        "traveler_id",
        "role",
        "category_attestation",
        "age_band",
        "sponsor_id",
    }


def test_to_party_facts_reuses_party_facts_validation_and_fills_explicit_placeholders() -> None:
    facts = party(sponsor(), dependent()).to_party_facts()
    assert isinstance(facts, PartyFacts)
    by_id = {t.traveler_id: t for t in facts.travelers}
    for traveler in by_id.values():
        # Never a guess: an explicit placeholder/unknown, not derived from data this profile
        # does not hold.
        assert traveler.traveler_class == UNASSIGNED_TRAVELER_CLASS
        assert traveler.accompanied is None
    assert by_id[SPONSOR_ID].category_attestation == "VI"
    assert by_id[DEPENDENT_ID].sponsor_id == SPONSOR_ID


def test_to_party_facts_still_rejects_a_party_that_only_party_facts_itself_would_catch() -> None:
    """`NewParty` does not duplicate `PartyFacts`'s cross-reference validator; it is reused."""
    # NewParty's own validation is field-level only (ids, enums, cardinality); construct a party
    # that is only invalid once mapped through PartyFacts's referential check by bypassing the
    # constructor's normal path via model_construct (frozen models still validate at use).
    unchecked = NewParty.model_construct(
        travelers=(
            ProfileTraveler.model_validate(sponsor()),
            ProfileTraveler.model_validate(dependent(sponsor_id=SPONSOR_ID)),
            ProfileTraveler.model_validate(dependent(traveler_id=uuid4(), sponsor_id=uuid4())),
        )
    )
    with pytest.raises(ValidationError):
        unchecked.to_party_facts()
