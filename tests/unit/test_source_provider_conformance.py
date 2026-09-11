"""Reusable synthetic conformance suite for the metadata-only SourceProvider port.

Every fake here is deterministic, performs no I/O, and returns only the metadata the port
permits. Nothing in this module downloads, scrapes or reproduces an official source
artifact: identities, URLs, timestamps and observations are synthetic. The fixture
conventions are documented beside their directory in ``tests/fixtures/source_provider``.
"""

import ast
import asyncio
import dataclasses
import pathlib
import socket
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

import pytest
from paxpivot.application.ports.source_provider import SourceProvider
from paxpivot.application.result import ApplicationError, Failure, Result, Success
from paxpivot.domain.source import (
    ExtractionState,
    Provenance,
    RetrievalState,
    SourceIdentity,
    SourceObservation,
    SourceState,
)
from pydantic import HttpUrl, TypeAdapter, ValidationError

SOURCE_ID = UUID("55555555-5555-4555-8555-555555555555")
OBSERVATION_ID = UUID("66666666-6666-4666-8666-666666666666")
OBSERVED_AT = datetime(2026, 2, 1, 12, 0, tzinfo=UTC)
SOURCE_TIME = datetime(2026, 2, 1, 6, 0, tzinfo=UTC)
CONFIGURATION_MESSAGE_KEY = "source_provider.not_configured"
# The identity every fixture provider declares, and the value it stamps into the observations it
# returns. A real adapter's own identity and its provenance stamp are the same string, and the
# pipeline refuses a result whose `provider_id` names a different adapter than the one that ran.
FIXTURE_PROVIDER_ID = "synthetic-fixture-provider"


class NetworkAccessAttemptedError(AssertionError):
    """Raised when a conformance test tries to resolve or connect to anything."""


@pytest.fixture(autouse=True)
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """Refuse DNS and TCP connects for every test in this module.

    ``socket.getaddrinfo`` and ``socket.create_connection`` are the entry points every
    realistic HTTP client uses, and neither is needed by asyncio's own event loop, so the
    loop still runs normally while the fixtures are held to a genuinely offline path.
    """

    def refuse(*args: object, **kwargs: object) -> None:
        raise NetworkAccessAttemptedError("conformance fixtures must not perform network I/O")

    monkeypatch.setattr(socket, "getaddrinfo", refuse)
    monkeypatch.setattr(socket, "create_connection", refuse)


@dataclass(frozen=True)
class SyntheticObservation:
    """A fixture input, not a production provider. Never backed by real source material."""

    label: str
    state: SourceState
    retrieval: RetrievalState
    extraction: ExtractionState
    source_time: datetime | None
    confidence_reasons: tuple[str, ...]


# One entry per condition the suite must cover. All values are synthetic.
SYNTHETIC_FIXTURE_INPUTS: tuple[SyntheticObservation, ...] = (
    SyntheticObservation(
        label="unreachable",
        state=SourceState.UNREACHABLE,
        retrieval=RetrievalState.FAILED,
        extraction=ExtractionState.NOT_ATTEMPTED,
        source_time=None,
        confidence_reasons=("retrieval_failed",),
    ),
    SyntheticObservation(
        label="missing",
        state=SourceState.MISSING,
        retrieval=RetrievalState.FAILED,
        extraction=ExtractionState.NOT_ATTEMPTED,
        source_time=None,
        confidence_reasons=("source_not_found",),
    ),
    SyntheticObservation(
        label="changed_unparsed",
        state=SourceState.CHANGED_UNPARSED,
        retrieval=RetrievalState.SUCCEEDED,
        extraction=ExtractionState.FAILED,
        source_time=SOURCE_TIME,
        confidence_reasons=("layout_changed", "parser_confidence_low"),
    ),
    SyntheticObservation(
        label="restricted",
        state=SourceState.RESTRICTED,
        retrieval=RetrievalState.NOT_ATTEMPTED,
        extraction=ExtractionState.NOT_ATTEMPTED,
        source_time=None,
        confidence_reasons=("source_not_approved_for_processing",),
    ),
    SyntheticObservation(
        label="no_departures_published",
        state=SourceState.NO_DEPARTURES,
        retrieval=RetrievalState.SUCCEEDED,
        extraction=ExtractionState.EXACT,
        source_time=SOURCE_TIME,
        confidence_reasons=("explicit_empty_table",),
    ),
)

FIXTURE_LABELS = tuple(fixture.label for fixture in SYNTHETIC_FIXTURE_INPUTS)


def synthetic_source() -> SourceIdentity:
    return SourceIdentity(
        source_id=SOURCE_ID,
        url=HttpUrl("https://example.invalid/synthetic-source"),
        authority="synthetic-authority",
    )


def provenance(fixture: SyntheticObservation) -> Provenance:
    return Provenance(
        source=synthetic_source(),
        observed_at=OBSERVED_AT,
        source_time=fixture.source_time,
        provider_id=FIXTURE_PROVIDER_ID,
        policy_version_id="synthetic-not-approved-v1",
    )


def observation_for(fixture: SyntheticObservation) -> SourceObservation:
    interpreted = fixture.extraction in {ExtractionState.EXACT, ExtractionState.REVIEWED}
    return SourceObservation(
        observation_id=OBSERVATION_ID,
        provenance=provenance(fixture),
        state=fixture.state,
        retrieval=fixture.retrieval,
        extraction=fixture.extraction,
        parser_version="synthetic-parser-v1" if interpreted else None,
        content_hash="sha256-synthetic" if interpreted else None,
        confidence_reasons=fixture.confidence_reasons,
    )


@dataclass(frozen=True)
class FixtureProvider:
    """Deterministic metadata-only provider driven by one synthetic fixture input."""

    fixture: SyntheticObservation
    provider_id: str = FIXTURE_PROVIDER_ID

    async def observe(self, source: SourceIdentity) -> Result[SourceObservation]:
        del source  # The fixture already fixes identity; no I/O and no provider call.
        return Success(value=observation_for(self.fixture))


@dataclass(frozen=True)
class ConfigurationFailureProvider:
    """Returns an application Failure, distinct from an expected source-state observation."""

    provider_id: str = FIXTURE_PROVIDER_ID

    async def observe(self, source: SourceIdentity) -> Result[SourceObservation]:
        del source
        return Failure(
            error=ApplicationError(
                code="unavailable",
                message_key=CONFIGURATION_MESSAGE_KEY,
                retryable=False,
            )
        )


@dataclass(frozen=True)
class InvalidAbsenceProvider:
    """A provider that tries to disguise failed retrieval as an absence claim."""

    provider_id: str = FIXTURE_PROVIDER_ID

    async def observe(self, source: SourceIdentity) -> Result[SourceObservation]:
        del source
        data = observation_for(SYNTHETIC_FIXTURE_INPUTS[0]).model_dump()
        data.update(state=SourceState.NO_DEPARTURES, retrieval=RetrievalState.FAILED)
        return Success(value=SourceObservation.model_validate(data))


async def collect_once(
    provider: SourceProvider, source: SourceIdentity
) -> Result[SourceObservation]:
    """Consume a provider through the protocol type, never through its concrete class."""
    return await provider.observe(source)


@pytest.mark.parametrize("fixture", SYNTHETIC_FIXTURE_INPUTS, ids=FIXTURE_LABELS)
def test_fakes_are_consumed_through_the_protocol_not_their_concrete_class(
    fixture: SyntheticObservation,
) -> None:
    # The annotated assignment is the conformance assertion: a fake that did not satisfy
    # SourceProvider would fail mypy here rather than silently passing a runtime duck-type.
    provider: SourceProvider = FixtureProvider(fixture)
    result = asyncio.run(collect_once(provider, synthetic_source()))
    assert isinstance(result, Success)
    assert result.ok is True
    assert result.value.state == fixture.state
    assert result.value.retrieval == fixture.retrieval
    assert result.value.extraction == fixture.extraction


def test_configuration_failure_is_consumed_through_the_protocol_too() -> None:
    provider: SourceProvider = ConfigurationFailureProvider()
    result = asyncio.run(collect_once(provider, synthetic_source()))
    assert isinstance(result, Failure)
    assert result.ok is False
    assert result.error.code == "unavailable"
    assert result.error.message_key == CONFIGURATION_MESSAGE_KEY
    assert result.error.retryable is False
    assert "value" not in result.model_dump()
    # A static catalog key only: no exception text or input value leaks through.
    assert "http" not in result.model_dump_json()


def test_network_is_actually_refused_during_these_tests() -> None:
    # Without this, the module-wide "no network" claim would be vacuous.
    with pytest.raises(NetworkAccessAttemptedError):
        socket.getaddrinfo("example.invalid", 443)
    with pytest.raises(NetworkAccessAttemptedError):
        socket.create_connection(("example.invalid", 443))


@pytest.mark.parametrize("fixture", SYNTHETIC_FIXTURE_INPUTS, ids=FIXTURE_LABELS)
def test_source_identity_survives_serialization(fixture: SyntheticObservation) -> None:
    provider: SourceProvider = FixtureProvider(fixture)
    result = asyncio.run(collect_once(provider, synthetic_source()))
    assert isinstance(result, Success)
    payload = result.model_dump_json()
    assert "example.invalid" in payload
    roundtripped: Result[SourceObservation] = TypeAdapter(Result[SourceObservation]).validate_json(
        payload
    )
    assert isinstance(roundtripped, Success)
    assert roundtripped.value.provenance.source == synthetic_source()
    assert str(roundtripped.value.provenance.source.source_id) == str(SOURCE_ID)
    assert roundtripped.value.provenance.source.authority == "synthetic-authority"


@pytest.mark.parametrize("fixture", SYNTHETIC_FIXTURE_INPUTS, ids=FIXTURE_LABELS)
def test_observation_timestamps_survive_serialization(fixture: SyntheticObservation) -> None:
    provider: SourceProvider = FixtureProvider(fixture)
    result = asyncio.run(collect_once(provider, synthetic_source()))
    assert isinstance(result, Success)
    roundtripped: Result[SourceObservation] = TypeAdapter(Result[SourceObservation]).validate_json(
        result.model_dump_json()
    )
    assert isinstance(roundtripped, Success)
    assert roundtripped.value.provenance.observed_at == OBSERVED_AT
    assert roundtripped.value.provenance.source_time == fixture.source_time
    assert roundtripped.value.observation_id == OBSERVATION_ID


@pytest.mark.parametrize(
    "fixture",
    [f for f in SYNTHETIC_FIXTURE_INPUTS if f.source_time is None],
    ids=[f.label for f in SYNTHETIC_FIXTURE_INPUTS if f.source_time is None],
)
def test_unknown_source_time_stays_unknown_through_serialization(
    fixture: SyntheticObservation,
) -> None:
    provider: SourceProvider = FixtureProvider(fixture)
    result = asyncio.run(collect_once(provider, synthetic_source()))
    assert isinstance(result, Success)
    assert result.value.provenance.source_time is None
    assert '"source_time":null' in result.model_dump_json()
    roundtripped: Result[SourceObservation] = TypeAdapter(Result[SourceObservation]).validate_json(
        result.model_dump_json()
    )
    assert isinstance(roundtripped, Success)
    assert roundtripped.value.provenance.source_time is None


@pytest.mark.parametrize("fixture", SYNTHETIC_FIXTURE_INPUTS, ids=FIXTURE_LABELS)
def test_repeated_calls_with_the_same_fixture_are_deterministic(
    fixture: SyntheticObservation,
) -> None:
    provider: SourceProvider = FixtureProvider(fixture)
    source = synthetic_source()
    results = [asyncio.run(collect_once(provider, source)) for _ in range(3)]
    assert results[0] == results[1] == results[2]
    assert len({result.model_dump_json() for result in results}) == 1


def test_invalid_failed_retrieval_cannot_masquerade_as_no_departures() -> None:
    data = observation_for(SYNTHETIC_FIXTURE_INPUTS[0]).model_dump()
    data.update(state=SourceState.NO_DEPARTURES, retrieval=RetrievalState.FAILED)
    with pytest.raises(ValidationError):
        SourceObservation.model_validate(data)


def test_invalid_absence_provider_cannot_bypass_domain_validation() -> None:
    provider: SourceProvider = InvalidAbsenceProvider()
    with pytest.raises(ValidationError):
        asyncio.run(collect_once(provider, synthetic_source()))


def test_failed_retrieval_is_reported_as_an_explicit_failure_state_not_absence() -> None:
    provider: SourceProvider = FixtureProvider(SYNTHETIC_FIXTURE_INPUTS[0])
    result = asyncio.run(collect_once(provider, synthetic_source()))
    assert isinstance(result, Success)
    assert result.value.state == SourceState.UNREACHABLE
    assert result.value.state not in {SourceState.NO_DEPARTURES, SourceState.FRESH}
    serialized = result.model_dump_json()
    assert '"state":"source_unreachable"' in serialized
    assert "no_departures_published" not in serialized
    assert result.value.confidence_reasons == ("retrieval_failed",)


def test_restricted_fixture_keeps_uncertainty_and_no_source_time() -> None:
    fixture = next(f for f in SYNTHETIC_FIXTURE_INPUTS if f.label == "restricted")
    provider: SourceProvider = FixtureProvider(fixture)
    result = asyncio.run(collect_once(provider, synthetic_source()))
    assert isinstance(result, Success)
    assert result.value.state == SourceState.RESTRICTED
    assert result.value.provenance.source_time is None
    assert result.value.retrieval == RetrievalState.NOT_ATTEMPTED
    assert result.value.parser_version is None
    assert result.value.content_hash is None


def test_fixture_inputs_are_frozen_and_cover_the_required_conditions() -> None:
    assert set(FIXTURE_LABELS) == {
        "unreachable",
        "missing",
        "changed_unparsed",
        "restricted",
        "no_departures_published",
    }
    assert len(set(FIXTURE_LABELS)) == len(FIXTURE_LABELS)
    for fixture in SYNTHETIC_FIXTURE_INPUTS:
        assert fixture.confidence_reasons
        with pytest.raises(dataclasses.FrozenInstanceError):
            # setattr, not assignment: mypy rejects assigning to a frozen field, but the
            # runtime dataclass must still refuse the write.
            setattr(fixture, "label", "mutated")  # noqa: B010


def test_no_fixture_carries_a_credential_or_non_synthetic_host() -> None:
    for fixture in SYNTHETIC_FIXTURE_INPUTS:
        payload = observation_for(fixture).model_dump_json().lower()
        assert "example.invalid" in payload
        for prohibited in ("password", "api_key", "apikey", "token", "secret", "bearer"):
            assert prohibited not in payload


def test_conformance_module_imports_no_network_client() -> None:
    """Belt and braces with the runtime guard: the fakes must not gain a network client.

    ``socket`` is imported only so the ``no_network`` fixture can refuse it; no HTTP or
    scraper client may appear here at all.
    """
    tree = ast.parse(pathlib.Path(__file__).read_text())
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])
    forbidden = {"httpx", "requests", "urllib", "aiohttp", "http", "ssl", "firecrawl"}
    assert imported & forbidden == set()
    assert imported  # the parse found real imports, so the check is not vacuous
