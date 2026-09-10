from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

import pytest
from paxpivot.application.result import Failure, Success
from paxpivot.application.terminal_entrance import select_entrance
from paxpivot.domain.source import Provenance, SourceIdentity
from paxpivot.domain.terminal import Coordinates, Terminal, VerifiedEntrance
from pydantic import HttpUrl

type EntranceKind = Literal["passenger_terminal", "visitor_center", "documented_gate"]
type OperationalState = Literal["verified", "unknown", "conflict", "ended"]

TERMINAL_ID = UUID("33333333-3333-4333-8333-333333333333")
SOURCE_ID = UUID("44444444-4444-4444-8444-444444444444")
OBSERVED_AT = datetime(2026, 1, 1, 0, 0, tzinfo=UTC)

# Deliberately distinct from the entrance coordinates so any substitution is visible.
BASE_LATITUDE = 1.5
BASE_LONGITUDE = 2.5


def provenance(authority: str) -> Provenance:
    return Provenance(
        source=SourceIdentity(
            source_id=SOURCE_ID,
            url=HttpUrl("https://example.invalid/terminal"),
            authority=authority,
        ),
        observed_at=OBSERVED_AT,
        source_time=None,
        provider_id="synthetic-provider",
        policy_version_id="synthetic-not-approved-v1",
    )


def entrance(kind: EntranceKind = "passenger_terminal") -> VerifiedEntrance:
    return VerifiedEntrance(
        kind=kind,
        coordinates=Coordinates(latitude=38.0, longitude=-77.0),
        verification=provenance("entrance-registry"),
        instructions="Use the passenger terminal entrance; synthetic fixture.",
    )


def terminal(
    *,
    operational_state: OperationalState = "verified",
    entrance_value: VerifiedEntrance | None = None,
    base_coordinates: Coordinates | None = None,
) -> Terminal:
    return Terminal(
        terminal_id=TERMINAL_ID,
        name="Synthetic Terminal",
        timezone="America/New_York",
        operational_state=operational_state,
        evidence=provenance("terminal-registry"),
        entrance=entrance_value,
        base_coordinates=base_coordinates,
    )


@pytest.mark.parametrize("kind", ["passenger_terminal", "visitor_center", "documented_gate"])
def test_verified_state_returns_the_unchanged_entrance_for_every_kind(kind: EntranceKind) -> None:
    verified = entrance(kind)
    result = select_entrance(terminal(entrance_value=verified))
    assert isinstance(result, Success)
    assert result.ok is True
    assert result.value is verified
    assert result.value == verified
    assert result.value.kind == kind


def test_verified_entrance_identity_and_provenance_survive_unchanged() -> None:
    verified = entrance("documented_gate")
    subject = terminal(entrance_value=verified)
    result = select_entrance(subject)
    assert isinstance(result, Success)
    assert result.value is subject.entrance
    assert result.value.coordinates is verified.coordinates
    assert result.value.verification is verified.verification
    assert result.value.instructions == verified.instructions
    assert result.value.verification.source.authority == "entrance-registry"
    assert result.value.verification.observed_at == OBSERVED_AT
    assert result.model_dump() == Success(value=verified).model_dump()


def test_missing_entrance_fails_even_with_base_coordinates() -> None:
    base = Coordinates(latitude=BASE_LATITUDE, longitude=BASE_LONGITUDE)
    subject = terminal(entrance_value=None, base_coordinates=base)
    result = select_entrance(subject)
    assert isinstance(result, Failure)
    assert result.ok is False
    assert (result.error.code, result.error.message_key, result.error.retryable) == (
        "unavailable",
        "terminal.entrance_unverified",
        False,
    )
    dumped = result.model_dump_json()
    assert str(BASE_LATITUDE) not in dumped
    assert str(BASE_LONGITUDE) not in dumped
    assert "value" not in result.model_dump()
    assert subject.base_coordinates == base


@pytest.mark.parametrize(
    ("state", "expected"),
    [
        ("unknown", ("unavailable", "terminal.entrance_unverified")),
        ("conflict", ("conflict", "terminal.operational_conflict")),
        ("ended", ("unavailable", "terminal.service_ended")),
    ],
)
def test_non_verified_operations_fail_even_when_an_entrance_exists(
    state: OperationalState, expected: tuple[str, str]
) -> None:
    verified = entrance()
    subject = terminal(operational_state=state, entrance_value=verified)
    result = select_entrance(subject)
    assert isinstance(result, Failure)
    assert result.ok is False
    assert result.error.retryable is False
    assert (result.error.code, result.error.message_key) == expected
    assert "value" not in result.model_dump()
    assert str(verified.coordinates.latitude) not in result.model_dump_json()
    assert subject.entrance is verified


def test_conflict_takes_precedence_over_ended_and_missing_entrance() -> None:
    subject = terminal(
        operational_state="conflict",
        entrance_value=None,
        base_coordinates=Coordinates(latitude=BASE_LATITUDE, longitude=BASE_LONGITUDE),
    )
    result = select_entrance(subject)
    assert isinstance(result, Failure)
    assert (result.error.code, result.error.message_key) == (
        "conflict",
        "terminal.operational_conflict",
    )


def test_ended_state_fails_with_the_service_ended_key() -> None:
    result = select_entrance(terminal(operational_state="ended", entrance_value=None))
    assert isinstance(result, Failure)
    assert (result.error.code, result.error.message_key, result.error.retryable) == (
        "unavailable",
        "terminal.service_ended",
        False,
    )


def test_unknown_state_fails_without_an_entrance_too() -> None:
    result = select_entrance(terminal(operational_state="unknown", entrance_value=None))
    assert isinstance(result, Failure)
    assert (result.error.code, result.error.message_key, result.error.retryable) == (
        "unavailable",
        "terminal.entrance_unverified",
        False,
    )


def test_success_does_not_mutate_or_rekey_the_terminal() -> None:
    verified = entrance("visitor_center")
    subject = terminal(
        entrance_value=verified,
        base_coordinates=Coordinates(latitude=1.0, longitude=2.0),
    )
    before = subject.model_dump_json()
    result = select_entrance(subject)
    assert isinstance(result, Success)
    assert result.value is verified
    assert subject.entrance is verified
    assert subject.model_dump_json() == before
    assert subject.terminal_id == TERMINAL_ID


def test_failure_payload_never_carries_coordinates_or_source_text() -> None:
    result = select_entrance(terminal(operational_state="conflict", entrance_value=entrance()))
    assert isinstance(result, Failure)
    dumped = result.model_dump_json()
    assert "latitude" not in dumped
    assert "longitude" not in dumped
    assert "example.invalid" not in dumped
    assert "synthetic-provider" not in dumped
