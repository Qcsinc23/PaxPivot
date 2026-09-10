import asyncio
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from paxpivot.api import app
from paxpivot.application.ports.auth import Authenticator
from paxpivot.application.ports.source_provider import SourceProvider
from paxpivot.application.result import Result, Success
from paxpivot.domain.eligibility import EligibilityDecision, PartyFacts, TravelerFacts
from paxpivot.domain.source import (
    ExtractionState,
    Provenance,
    RetrievalState,
    SourceIdentity,
    SourceObservation,
    SourceState,
)
from paxpivot.domain.terminal import Coordinates, Terminal, VerifiedEntrance
from paxpivot.infrastructure.auth import DenyAllAuthenticator
from pydantic import TypeAdapter, ValidationError


def provenance() -> Provenance:
    return Provenance.model_validate(
        {
            "source": {
                "source_id": str(uuid4()),
                "url": "https://example.invalid/source",
                "authority": "synthetic",
            },
            "observed_at": "2026-01-01T00:00:00Z",
            "source_time": None,
            "provider_id": "fake",
            "policy_version_id": "synthetic-not-approved-v1",
        }
    )


def observation() -> SourceObservation:
    return SourceObservation(
        observation_id=uuid4(),
        provenance=provenance(),
        state=SourceState.UNREACHABLE,
        retrieval=RetrievalState.FAILED,
        extraction=ExtractionState.NOT_ATTEMPTED,
        parser_version=None,
        content_hash=None,
        confidence_reasons=("retrieval_failed",),
    )


def test_health_only() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    for path in ["/trips", "/docs", "/openapi.json"]:
        assert client.get(path).status_code == 404


@pytest.mark.parametrize("state", list(SourceState))
def test_all_source_states(state: SourceState) -> None:
    assert TypeAdapter(SourceState).validate_json(f'"{state.value}"') == state


@pytest.mark.parametrize("value", ["no_flights", "", "confirmed", "unknown_new_state"])
def test_source_state_rejects_invented_values(value: str) -> None:
    with pytest.raises(ValidationError):
        TypeAdapter(SourceState).validate_python(value)


def test_provenance_roundtrip_and_required_identity() -> None:
    original = observation()
    assert SourceObservation.model_validate_json(original.model_dump_json()) == original
    assert original.provenance.source_time is None
    for key in ["source", "observed_at", "source_time", "provider_id", "policy_version_id"]:
        data = provenance().model_dump()
        del data[key]
        with pytest.raises(ValidationError):
            Provenance.model_validate(data)
    data = provenance().model_dump()
    data["observed_at"] = datetime(2026, 1, 1)  # Naive timestamp rejected.
    with pytest.raises(ValidationError):
        Provenance.model_validate(data)


@pytest.mark.parametrize(
    "state", [SourceState.FRESH, SourceState.NO_DEPARTURES, SourceState.NO_COMPATIBLE]
)
def test_source_failure_cannot_claim_positive_evidence(state: SourceState) -> None:
    data = observation().model_dump()
    data["state"] = state
    with pytest.raises(ValidationError):
        SourceObservation.model_validate(data)


def test_no_departures_requires_interpretation() -> None:
    data = observation().model_dump()
    data.update(state=SourceState.NO_DEPARTURES, retrieval=RetrievalState.SUCCEEDED)
    with pytest.raises(ValidationError):
        SourceObservation.model_validate(data)
    data.update(extraction=ExtractionState.EXACT, parser_version="synthetic-v1")
    assert SourceObservation.model_validate(data).state == SourceState.NO_DEPARTURES


def test_terminal_does_not_promote_base_coordinates() -> None:
    coords = Coordinates(latitude=0, longitude=0)
    terminal = Terminal(
        terminal_id=uuid4(),
        name="Synthetic terminal",
        timezone="UTC",
        operational_state="unknown",
        evidence=provenance(),
        entrance=None,
        base_coordinates=coords,
    )
    assert terminal.entrance is None
    with pytest.raises(ValidationError):
        VerifiedEntrance.model_validate(
            {
                "kind": "airfield",
                "coordinates": coords,
                "verification": provenance(),
                "instructions": "synthetic",
            }
        )
    entrance = VerifiedEntrance(
        kind="passenger_terminal",
        coordinates=coords,
        verification=provenance(),
        instructions="synthetic",
    )
    assert entrance.verification.observed_at == datetime(2026, 1, 1, tzinfo=UTC)
    data = entrance.model_dump()
    del data["verification"]
    with pytest.raises(ValidationError):
        VerifiedEntrance.model_validate(data)


def test_policy_version_is_mandatory_even_for_unknown() -> None:
    data = {
        "state": "unknown",
        "controlling_policy_id": "synthetic",
        "controlling_policy_version": "v1",
        "citations": [provenance()],
        "reasons": ["not_evaluated"],
        "unresolved_conditions": ["policy_review"],
    }
    assert EligibilityDecision.model_validate(data).state == "unknown"
    for key in ["controlling_policy_id", "controlling_policy_version", "citations"]:
        broken = dict(data)
        del broken[key]
        with pytest.raises(ValidationError):
            EligibilityDecision.model_validate(broken)
    data["controlling_policy_version"] = " "
    with pytest.raises(ValidationError):
        EligibilityDecision.model_validate(data)


def test_party_references_and_minimization() -> None:
    sponsor = TravelerFacts(
        traveler_id=uuid4(),
        role="sponsor",
        traveler_class="synthetic_class",
        category_attestation="VI",
        age_band="adult",
        sponsor_id=None,
        accompanied=None,
    )
    dependent = TravelerFacts(
        traveler_id=uuid4(),
        role="dependent",
        traveler_class="dependent",
        category_attestation="unknown",
        age_band="under_14",
        sponsor_id=sponsor.traveler_id,
        accompanied=True,
    )
    assert len(PartyFacts(travelers=(sponsor, dependent)).travelers) == 2
    with pytest.raises(ValidationError):
        PartyFacts(travelers=(dependent,))
    with pytest.raises(ValidationError):
        PartyFacts(travelers=(sponsor, sponsor))
    data = sponsor.model_dump()
    data["document_number"] = "prohibited"
    with pytest.raises(ValidationError):
        TravelerFacts.model_validate(data)


def test_provider_substitution_preserves_failure_observation() -> None:
    class FakeProvider:
        async def observe(self, source: SourceIdentity) -> Result[SourceObservation]:
            result = observation()
            return Success(value=result)

    provider: SourceProvider = FakeProvider()
    result = asyncio.run(provider.observe(provenance().source))
    assert result.ok
    assert result.value.state == SourceState.UNREACHABLE
    assert result.value.retrieval == RetrievalState.FAILED


@pytest.mark.parametrize("credential", [None, "invented-token"])
def test_auth_stub_always_denies(credential: str | None) -> None:
    authenticator: Authenticator = DenyAllAuthenticator()
    result = asyncio.run(authenticator.authenticate(credential))
    assert not result.ok
    assert result.error.code == "unauthorized"
    assert credential is None or credential not in result.model_dump_json()
